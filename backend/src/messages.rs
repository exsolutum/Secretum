use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Authentication message - must be the first message after WebSocket connection
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct AuthMessage {
    pub public_key: String,
    pub timestamp: i64,
    pub signature: String,
}

/// Join room request
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct JoinMessage {
    pub room_id: String,
    pub room_secret: String,
    pub nickname: String,
}

/// Chat message (encrypted)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct ChatMessage {
    pub room_id: String,
    pub encrypted_content: String,
    pub iv: String,
    pub timestamp: i64,
    pub message_type: ChatMessageType,
    pub reply_to: Option<String>,
    pub mentions: Vec<String>,
}

/// Type of chat message
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub enum ChatMessageType {
    Text,
    Image,
    File,
    System,
    Reaction,
}

/// Typing indicator
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct TypingIndicator {
    pub room_id: String,
    pub is_typing: bool,
}

/// Read receipt
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct ReadReceipt {
    pub room_id: String,
    pub message_id: String,
    pub timestamp: i64,
}

/// User presence status
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub enum UserStatus {
    Online,
    Away,
    Offline,
}

/// Presence update notification
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct PresenceUpdate {
    pub uid: String,
    pub nickname: String,
    pub status: UserStatus,
}

/// Admin command
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct AdminCommand {
    pub command: AdminCommandType,
    pub target_uid: Option<String>,
    pub reason: Option<String>,
}

/// Admin command types
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub enum AdminCommandType {
    Kick,
    Ban,
    Unban,
    LockRoom,
    UnlockRoom,
    DestroyRoom,
    TransferAdmin,
}

/// User info in room
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct RoomUser {
    pub uid: String,
    pub nickname: String,
    pub is_admin: bool,
    pub status: UserStatus,
    pub joined_at: i64,
}

/// Room info
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct RoomInfo {
    pub room_id: String,
    pub is_locked: bool,
    pub user_count: usize,
    pub max_connections: usize,
}

/// Search request
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct SearchRequest {
    pub room_id: String,
    pub query: String,
    pub limit: usize,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct SearchResult {
    pub messages: Vec<StoredMessagePayload>,
    pub total: usize,
}

/// File upload metadata
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct FileMetadata {
    pub filename: String,
    pub mime_type: String,
    pub size: usize,
    pub encrypted_data: String,
    pub iv: String,
}

/// Reaction message
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct ReactionMessage {
    pub room_id: String,
    pub message_id: String,
    pub emoji: String,
    pub remove: bool,
}

/// Stored message payload (for history and search results)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct StoredMessagePayload {
    pub message_id: String,
    pub sender_uid: String,
    pub sender_nickname: String,
    pub encrypted_content: String,
    pub iv: String,
    pub timestamp: i64,
    pub message_type: ChatMessageType,
    pub reply_to: Option<String>,
    pub mentions: Vec<String>,
    pub reactions: std::collections::HashMap<String, Vec<String>>,
    pub read_by_count: usize,
}

/// Client -> Server message type
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub enum ClientMessageType {
    Auth,
    Join,
    Chat,
    Typing,
    Read,
    Presence,
    Admin,
    Leave,
    RequestHistory,
    Search,
    Reaction,
    File,
}

/// Client -> Server message wrapper
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct ClientMessage {
    pub msg_type: ClientMessageType,
    pub payload: String,
    pub timestamp: i64,
    pub message_id: Option<String>,
}

/// Server -> Client message type
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub enum ServerMessageType {
    AuthOk,
    AuthError,
    Joined,
    UserJoined,
    UserLeft,
    UserList,
    Chat,
    System,
    Typing,
    Read,
    Presence,
    Kicked,
    Banned,
    RoomLocked,
    RoomUnlocked,
    RoomDestroyed,
    AdminTransferred,
    History,
    SearchResult,
    Reaction,
    File,
    Error,
}

/// Server -> Client message wrapper
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export_to = "../frontend/src/types/")]
pub struct ServerMessage {
    pub msg_type: ServerMessageType,
    pub payload: String,
    pub timestamp: i64,
    pub message_id: Option<String>,
}

impl ServerMessage {
    pub fn new(msg_type: ServerMessageType, payload: String) -> Self {
        Self {
            msg_type,
            payload,
            timestamp: chrono::Utc::now().timestamp(),
            message_id: None,
        }
    }

    pub fn error(msg: &str) -> Self {
        Self::new(ServerMessageType::Error, msg.to_string())
    }

    pub fn system(msg: &str) -> Self {
        Self::new(ServerMessageType::System, msg.to_string())
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}
