pub mod auth;
pub mod config;
pub mod messages;
pub mod persistence;
pub mod room;
pub mod static_files;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use messages::*;
use room::{hash_room_secret, Room, RoomConnection, SharedRooms, StoredMessage};
use auth::{AuthState, SharedAuthState, UserIdentity};
use config::Config;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Application shared state
#[derive(Clone)]
pub struct AppState {
    pub rooms: SharedRooms,
    pub auth_state: SharedAuthState,
    pub config: Config,
    pub connections: SharedConnections,
}

/// Active connections: uid -> (room_id, sender channel)
pub type SharedConnections = Arc<RwLock<HashMap<String, ConnectionHandle>>>;

#[derive(Clone)]
pub struct ConnectionHandle {
    pub room_id: String,
    pub uid: String,
    pub nickname: String,
    pub tx: mpsc::UnboundedSender<String>,
}

#[tokio::main]
async fn main() {
    let config = Config::load();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&config.log_level)),
        )
        .init();

    tracing::info!("╔══════════════════════════════════════╗");
    tracing::info!("║          S E C R E T U M             ║");
    tracing::info!("║   Encrypted Private Chat Room        ║");
    tracing::info!("╚══════════════════════════════════════╝");
    tracing::info!("Listening on {}", config.bind_addr());

    let state = AppState {
        rooms: Arc::new(RwLock::new(HashMap::new())),
        auth_state: AuthState::shared(),
        config: config.clone(),
        connections: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .fallback(static_files::static_handler)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr()).await.unwrap();
    tracing::info!("Server ready at ws://{}", config.bind_addr());
    axum::serve(listener, app).await.unwrap();
}

/// WebSocket upgrade handler
async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle a WebSocket connection
async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Connection state
    let mut uid = String::new();
    let mut nickname = String::new();
    let mut room_id = String::new();
    let mut authenticated = false;

    // Create channel for broadcasting to this connection
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Spawn task to forward messages from broadcast channel to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Process incoming messages
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                let text_str = text.to_string();
                let client_msg: ClientMessage = match serde_json::from_str(&text_str) {
                    Ok(m) => m,
                    Err(e) => {
                        let _ = tx.send(ServerMessage::error(&format!("Invalid message: {}", e)).to_json());
                        continue;
                    }
                };

                match client_msg.msg_type {
                    ClientMessageType::Auth => {
                        handle_auth(
                            &client_msg.payload, &state, &tx, &mut uid, &mut nickname, &mut authenticated,
                        ).await;
                    }
                    ClientMessageType::Join => {
                        if !authenticated {
                            let _ = tx.send(ServerMessage::error("Not authenticated").to_json());
                            continue;
                        }
                        handle_join(
                            &client_msg.payload, &state, &tx, &uid, &nickname, &mut room_id,
                        ).await;
                    }
                    ClientMessageType::Chat => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_chat(&client_msg, &state, &uid, &nickname, &room_id).await;
                    }
                    ClientMessageType::Typing => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_typing(&client_msg.payload, &state, &uid, &room_id).await;
                    }
                    ClientMessageType::Read => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_read(&client_msg.payload, &state, &uid, &room_id).await;
                    }
                    ClientMessageType::Reaction => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_reaction(&client_msg.payload, &state, &uid, &room_id).await;
                    }
                    ClientMessageType::File => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_file(&client_msg.payload, &state, &uid, &nickname, &room_id).await;
                    }
                    ClientMessageType::Admin => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_admin(&client_msg.payload, &state, &uid, &room_id).await;
                    }
                    ClientMessageType::Leave => {
                        if !room_id.is_empty() {
                            handle_leave(&state, &uid, &nickname, &room_id).await;
                            room_id.clear();
                        }
                    }
                    ClientMessageType::RequestHistory => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_history(&client_msg.payload, &state, &tx, &room_id).await;
                    }
                    ClientMessageType::Search => {
                        if !authenticated || room_id.is_empty() {
                            continue;
                        }
                        handle_search(&client_msg.payload, &state, &tx, &room_id).await;
                    }
                    ClientMessageType::Presence => {
                        // Presence is handled implicitly through connection state
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Cleanup: remove connection
    if !uid.is_empty() {
        // Remove from connections map
        {
            let mut conns = state.connections.write().await;
            conns.remove(&uid);
        }

        // Remove from room
        if !room_id.is_empty() {
            let mut rooms = state.rooms.write().await;
            if let Some(room) = rooms.get_mut(&room_id) {
                room.connections.remove(&uid);
                // Broadcast user left
                let payload = serde_json::json!({
                    "uid": uid,
                    "nickname": nickname,
                    "timestamp": chrono::Utc::now().timestamp(),
                }).to_string();
                broadcast_to_room(&state, &room_id, &ServerMessage::new(ServerMessageType::UserLeft, payload)).await;

                // System message
                let sys_msg = ServerMessage::system(&format!("{} left the room", nickname));
                broadcast_to_room(&state, &room_id, &sys_msg).await;

                // Auto-destroy empty rooms
                if room.connections.is_empty() {
                    tracing::info!("Room {} is empty, auto-destroying", room_id);
                    rooms.remove(&room_id);
                }
            }
        }
    }

    send_task.abort();
}

/// Handle authentication
async fn handle_auth(
    payload: &str,
    state: &AppState,
    tx: &mpsc::UnboundedSender<String>,
    uid: &mut String,
    nickname: &mut String,
    authenticated: &mut bool,
) {
    let auth_msg: AuthMessage = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(e) => {
            let _ = tx.send(ServerMessage::error(&format!("Invalid auth message: {}", e)).to_json());
            return;
        }
    };

    // Compute UID from public key
    let computed_uid = UserIdentity::compute_uid(&auth_msg.public_key);

    // Verify signature (anti-replay)
    let mut auth_state = state.auth_state.write().await;
    if !auth_state.signature_cache.check_and_add(&auth_msg.signature) {
        let _ = tx.send(ServerMessage::error("Signature replay detected").to_json());
        return;
    }
    drop(auth_state);

    // For now, accept all auth (in production, verify the signature)
    *uid = computed_uid.clone();
    *nickname = format!("user_{}", &computed_uid[..8]);
    *authenticated = true;

    let response = serde_json::json!({
        "uid": *uid,
        "public_key": auth_msg.public_key,
    }).to_string();

    let _ = tx.send(ServerMessage::new(ServerMessageType::AuthOk, response).to_json());
    tracing::info!("User authenticated: {}", uid);
}

/// Handle join room
async fn handle_join(
    payload: &str,
    state: &AppState,
    tx: &mpsc::UnboundedSender<String>,
    uid: &str,
    _nickname: &str,
    room_id: &mut String,
) {
    let join_msg: JoinMessage = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(e) => {
            let _ = tx.send(ServerMessage::error(&format!("Invalid join message: {}", e)).to_json());
            return;
        }
    };

    let mut rooms = state.rooms.write().await;

    // Check if room exists
    if let Some(room) = rooms.get_mut(&join_msg.room_id) {
        // Check blacklist
        if room.blacklist.contains(uid) {
            let _ = tx.send(ServerMessage::error("You are banned from this room").to_json());
            return;
        }

        // Check if locked
        if room.is_locked && room.admin_uid != uid {
            let _ = tx.send(ServerMessage::error("Room is locked").to_json());
            return;
        }

        // Verify room secret
        if !room.verify_secret(&join_msg.room_secret) {
            let _ = tx.send(ServerMessage::error("Invalid room secret").to_json());
            return;
        }

        // Check max connections
        if room.connections.len() >= state.config.max_connections {
            let _ = tx.send(ServerMessage::error("Room is full").to_json());
            return;
        }

        // Add connection to room
        let conn = RoomConnection {
            uid: uid.to_string(),
            nickname: join_msg.nickname.clone(),
            public_key: String::new(),
            joined_at: chrono::Utc::now().timestamp(),
            is_typing: false,
            last_read: 0,
        };
        room.connections.insert(uid.to_string(), conn);

        // Send history
        let history = room.get_history(100);
        let history_payloads: Vec<StoredMessagePayload> = history.iter().map(|m| m.to_payload()).collect();
        let history_json = serde_json::to_string(&history_payloads).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::History, history_json).to_json());

        // Send user list
        let user_list: Vec<RoomUser> = room.connections.values().map(|c| RoomUser {
            uid: c.uid.clone(),
            nickname: c.nickname.clone(),
            is_admin: room.admin_uid == c.uid,
            status: UserStatus::Online,
            joined_at: c.joined_at,
        }).collect();
        let user_list_json = serde_json::to_string(&user_list).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::UserList, user_list_json).to_json());

        // Send room info
        let room_info = RoomInfo {
            room_id: room.room_id.clone(),
            is_locked: room.is_locked,
            user_count: room.connections.len(),
            max_connections: state.config.max_connections,
        };
        let room_info_json = serde_json::to_string(&room_info).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::Joined, room_info_json).to_json());

        // Broadcast user joined
        let join_payload = serde_json::json!({
            "uid": uid,
            "nickname": join_msg.nickname,
            "timestamp": chrono::Utc::now().timestamp(),
        }).to_string();
        broadcast_to_room_no_lock(state, &join_msg.room_id, &ServerMessage::new(ServerMessageType::UserJoined, join_payload)).await;

        // System message
        let sys_msg = ServerMessage::system(&format!("{} joined the room", join_msg.nickname));
        broadcast_to_room_no_lock(state, &join_msg.room_id, &sys_msg).await;
    } else {
        // Create new room
        let hashed_secret = hash_room_secret(&join_msg.room_secret);
        let mut new_room = Room {
            room_id: join_msg.room_id.clone(),
            admin_uid: uid.to_string(),
            hashed_secret,
            is_locked: false,
            connections: HashMap::new(),
            blacklist: HashSet::new(),
            message_history: Vec::new(),
            created_at: chrono::Utc::now().timestamp(),
        };

        let conn = RoomConnection {
            uid: uid.to_string(),
            nickname: join_msg.nickname.clone(),
            public_key: String::new(),
            joined_at: chrono::Utc::now().timestamp(),
            is_typing: false,
            last_read: 0,
        };
        new_room.connections.insert(uid.to_string(), conn);

        // Send room info
        let room_info = RoomInfo {
            room_id: new_room.room_id.clone(),
            is_locked: false,
            user_count: 1,
            max_connections: state.config.max_connections,
        };
        let room_info_json = serde_json::to_string(&room_info).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::Joined, room_info_json).to_json());

        // Send user list
        let user_list: Vec<RoomUser> = new_room.connections.values().map(|c| RoomUser {
            uid: c.uid.clone(),
            nickname: c.nickname.clone(),
            is_admin: true,
            status: UserStatus::Online,
            joined_at: c.joined_at,
        }).collect();
        let user_list_json = serde_json::to_string(&user_list).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::UserList, user_list_json).to_json());

        // System message
        let sys_msg = ServerMessage::system(&format!("Room created. {} is the admin.", join_msg.nickname));
        let _ = tx.send(sys_msg.to_json());

        rooms.insert(join_msg.room_id.clone(), new_room);
    }

    // Register connection handle
    *room_id = join_msg.room_id.clone();
    {
        let mut conns = state.connections.write().await;
        conns.insert(uid.to_string(), ConnectionHandle {
            room_id: join_msg.room_id.clone(),
            uid: uid.to_string(),
            nickname: join_msg.nickname.clone(),
            tx: tx.clone(),
        });
    }
}

/// Handle chat message
async fn handle_chat(
    client_msg: &ClientMessage,
    state: &AppState,
    uid: &str,
    nickname: &str,
    room_id: &str,
) {
    let chat_msg: ChatMessage = match serde_json::from_str(&client_msg.payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    let msg_id = uuid::Uuid::new_v4().to_string();
    let stored = StoredMessage {
        message_id: msg_id.clone(),
        sender_uid: uid.to_string(),
        sender_nickname: nickname.to_string(),
        encrypted_content: chat_msg.encrypted_content,
        iv: chat_msg.iv,
        timestamp: chat_msg.timestamp,
        message_type: chat_msg.message_type,
        reply_to: chat_msg.reply_to,
        mentions: chat_msg.mentions,
        reactions: HashMap::new(),
        read_by: {
            let mut s = HashSet::new();
            s.insert(uid.to_string());
            s
        },
    };

    let payload = stored.to_payload();
    let json = serde_json::to_string(&payload).unwrap_or_default();

    // Store message
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            room.message_history.push(stored);
        }
    }

    // Broadcast
    broadcast_to_room(state, room_id, &ServerMessage {
        msg_type: ServerMessageType::Chat,
        payload: json,
        timestamp: chrono::Utc::now().timestamp(),
        message_id: Some(msg_id),
    }).await;
}

/// Handle typing indicator
async fn handle_typing(
    payload: &str,
    state: &AppState,
    uid: &str,
    room_id: &str,
) {
    let typing: TypingIndicator = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    // Update room state
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            if let Some(conn) = room.connections.get_mut(uid) {
                conn.is_typing = typing.is_typing;
            }
        }
    }

    let broadcast_payload = serde_json::json!({
        "uid": uid,
        "is_typing": typing.is_typing,
    }).to_string();

    broadcast_to_room(state, room_id, &ServerMessage::new(ServerMessageType::Typing, broadcast_payload)).await;
}

/// Handle read receipt
async fn handle_read(
    payload: &str,
    state: &AppState,
    uid: &str,
    room_id: &str,
) {
    let receipt: ReadReceipt = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    // Mark message as read
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            room.mark_read(&receipt.message_id, uid);
        }
    }

    let broadcast_payload = serde_json::json!({
        "uid": uid,
        "message_id": receipt.message_id,
        "timestamp": chrono::Utc::now().timestamp(),
    }).to_string();

    broadcast_to_room(state, room_id, &ServerMessage::new(ServerMessageType::Read, broadcast_payload)).await;
}

/// Handle reaction
async fn handle_reaction(
    payload: &str,
    state: &AppState,
    uid: &str,
    room_id: &str,
) {
    let reaction: ReactionMessage = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            if reaction.remove {
                room.remove_reaction(&reaction.message_id, &reaction.emoji, uid);
            } else {
                room.add_reaction(&reaction.message_id, &reaction.emoji, uid);
            }
        }
    }

    let broadcast_payload = serde_json::json!({
        "uid": uid,
        "message_id": reaction.message_id,
        "emoji": reaction.emoji,
        "remove": reaction.remove,
    }).to_string();

    broadcast_to_room(state, room_id, &ServerMessage::new(ServerMessageType::Reaction, broadcast_payload)).await;
}

/// Handle file upload
async fn handle_file(
    payload: &str,
    state: &AppState,
    uid: &str,
    nickname: &str,
    room_id: &str,
) {
    let file: FileMetadata = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    let msg_id = uuid::Uuid::new_v4().to_string();
    let stored = StoredMessage {
        message_id: msg_id.clone(),
        sender_uid: uid.to_string(),
        sender_nickname: nickname.to_string(),
        encrypted_content: file.encrypted_data.clone(),
        iv: file.iv.clone(),
        timestamp: chrono::Utc::now().timestamp(),
        message_type: ChatMessageType::File,
        reply_to: None,
        mentions: Vec::new(),
        reactions: HashMap::new(),
        read_by: {
            let mut s = HashSet::new();
            s.insert(uid.to_string());
            s
        },
    };

    let payload_data = serde_json::json!({
        "message": stored.to_payload(),
        "file": file,
    });
    let json = serde_json::to_string(&payload_data).unwrap_or_default();

    // Store message
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            room.message_history.push(stored);
        }
    }

    broadcast_to_room(state, room_id, &ServerMessage {
        msg_type: ServerMessageType::File,
        payload: json,
        timestamp: chrono::Utc::now().timestamp(),
        message_id: Some(msg_id),
    }).await;
}

/// Handle admin command
async fn handle_admin(
    payload: &str,
    state: &AppState,
    uid: &str,
    room_id: &str,
) {
    let cmd: AdminCommand = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    let mut rooms = state.rooms.write().await;
    if let Some(room) = rooms.get_mut(room_id) {
        // Verify admin
        if room.admin_uid != uid {
            return;
        }

        match cmd.command {
            AdminCommandType::Kick => {
                if let Some(target_uid) = &cmd.target_uid {
                    room.connections.remove(target_uid);
                    // Notify kicked user
                    let conns = state.connections.read().await;
                    if let Some(handle) = conns.get(target_uid) {
                        let _ = handle.tx.send(ServerMessage::new(ServerMessageType::Kicked, "You have been kicked".to_string()).to_json());
                    }
                    // Broadcast
                    let sys_msg = ServerMessage::system(&format!("User {} has been kicked", target_uid));
                    broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
                }
            }
            AdminCommandType::Ban => {
                if let Some(target_uid) = &cmd.target_uid {
                    room.blacklist.insert(target_uid.clone());
                    room.connections.remove(target_uid);
                    let conns = state.connections.read().await;
                    if let Some(handle) = conns.get(target_uid) {
                        let _ = handle.tx.send(ServerMessage::new(ServerMessageType::Banned, "You have been banned".to_string()).to_json());
                    }
                    let sys_msg = ServerMessage::system(&format!("User {} has been banned", target_uid));
                    broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
                }
            }
            AdminCommandType::Unban => {
                if let Some(target_uid) = &cmd.target_uid {
                    room.blacklist.remove(target_uid);
                    let sys_msg = ServerMessage::system(&format!("User {} has been unbanned", target_uid));
                    broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
                }
            }
            AdminCommandType::LockRoom => {
                room.is_locked = true;
                let sys_msg = ServerMessage::new(ServerMessageType::RoomLocked, "Room has been locked".to_string());
                broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
            }
            AdminCommandType::UnlockRoom => {
                room.is_locked = false;
                let sys_msg = ServerMessage::new(ServerMessageType::RoomUnlocked, "Room has been unlocked".to_string());
                broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
            }
            AdminCommandType::DestroyRoom => {
                // Notify all users
                let sys_msg = ServerMessage::new(ServerMessageType::RoomDestroyed, "Room has been destroyed".to_string());
                broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
                rooms.remove(room_id);
            }
            AdminCommandType::TransferAdmin => {
                if let Some(target_uid) = &cmd.target_uid {
                    if room.connections.contains_key(target_uid) {
                        room.admin_uid = target_uid.clone();
                        let sys_msg = ServerMessage::new(ServerMessageType::AdminTransferred, format!("Admin transferred to {}", target_uid));
                        broadcast_to_room_with_conns(&state, room_id, &sys_msg).await;
                    }
                }
            }
        }
    }
}

/// Handle leave room
async fn handle_leave(
    state: &AppState,
    uid: &str,
    nickname: &str,
    room_id: &str,
) {
    let mut rooms = state.rooms.write().await;
    if let Some(room) = rooms.get_mut(room_id) {
        room.connections.remove(uid);

        let payload = serde_json::json!({
            "uid": uid,
            "nickname": nickname,
            "timestamp": chrono::Utc::now().timestamp(),
        }).to_string();

        broadcast_to_room_with_conns(state, room_id, &ServerMessage::new(ServerMessageType::UserLeft, payload)).await;
        let sys_msg = ServerMessage::system(&format!("{} left the room", nickname));
        broadcast_to_room_with_conns(state, room_id, &sys_msg).await;
    }

    // Remove from connections
    let mut conns = state.connections.write().await;
    conns.remove(uid);
}

/// Handle history request
async fn handle_history(
    payload: &str,
    state: &AppState,
    tx: &mpsc::UnboundedSender<String>,
    room_id: &str,
) {
    let limit = serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|v| v.get("limit").and_then(|l| l.as_u64()))
        .unwrap_or(100) as usize;

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(room_id) {
        let history = room.get_history(limit);
        let payloads: Vec<StoredMessagePayload> = history.iter().map(|m| m.to_payload()).collect();
        let json = serde_json::to_string(&payloads).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::History, json).to_json());
    }
}

/// Handle search request
async fn handle_search(
    payload: &str,
    state: &AppState,
    tx: &mpsc::UnboundedSender<String>,
    room_id: &str,
) {
    let search_req: SearchRequest = match serde_json::from_str(payload) {
        Ok(m) => m,
        Err(_) => return,
    };

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(room_id) {
        // Search by sender UID (since content is encrypted)
        let results: Vec<StoredMessagePayload> = room.message_history.iter()
            .filter(|m| m.sender_uid.contains(&search_req.query) || m.sender_nickname.contains(&search_req.query))
            .take(search_req.limit)
            .map(|m| m.to_payload())
            .collect();

        let total = results.len();
        let search_result = SearchResult { messages: results, total };
        let json = serde_json::to_string(&search_result).unwrap_or_default();
        let _ = tx.send(ServerMessage::new(ServerMessageType::SearchResult, json).to_json());
    }
}

/// Broadcast a message to all connections in a room
async fn broadcast_to_room(state: &AppState, room_id: &str, msg: &ServerMessage) {
    let json = msg.to_json();
    let conns = state.connections.read().await;
    for (_, handle) in conns.iter() {
        if handle.room_id == room_id {
            let _ = handle.tx.send(json.clone());
        }
    }
}

/// Broadcast without holding rooms lock
async fn broadcast_to_room_no_lock(state: &AppState, room_id: &str, msg: &ServerMessage) {
    broadcast_to_room(state, room_id, msg).await;
}

/// Broadcast using connections map (for when rooms lock is already held)
async fn broadcast_to_room_with_conns(state: &AppState, room_id: &str, msg: &ServerMessage) {
    let json = msg.to_json();
    let conns = state.connections.read().await;
    for (_, handle) in conns.iter() {
        if handle.room_id == room_id {
            let _ = handle.tx.send(json.clone());
        }
    }
}
