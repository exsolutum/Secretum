use crate::messages::*;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

/// A chat room
#[derive(Debug)]
pub struct Room {
    pub room_id: String,
    pub admin_uid: String,
    pub hashed_secret: String,
    pub is_locked: bool,
    pub connections: HashMap<String, RoomConnection>,
    pub blacklist: HashSet<String>,
    pub message_history: Vec<StoredMessage>,
    pub created_at: i64,
}

/// A connection within a room
#[derive(Debug, Clone)]
pub struct RoomConnection {
    pub uid: String,
    pub nickname: String,
    pub public_key: String,
    pub joined_at: i64,
    pub is_typing: bool,
    pub last_read: i64,
}

/// Stored message for history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub message_id: String,
    pub sender_uid: String,
    pub sender_nickname: String,
    pub encrypted_content: String,
    pub iv: String,
    pub timestamp: i64,
    pub message_type: ChatMessageType,
    pub reply_to: Option<String>,
    pub mentions: Vec<String>,
    pub reactions: HashMap<String, Vec<String>>,
    pub read_by: HashSet<String>,
}

/// Shared rooms state
pub type SharedRooms = Arc<RwLock<HashMap<String, Room>>>;

/// Hash a room secret using Argon2id
pub fn hash_room_secret(secret: &str) -> String {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    argon2
        .hash_password(secret.as_bytes(), &salt)
        .map(|h| h.to_string())
        .unwrap_or_default()
}

/// Verify a room secret against its hash
pub fn verify_room_secret(secret: &str, hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default().verify_password(secret.as_bytes(), &parsed_hash).is_ok()
}

impl Room {
    /// Create a new room
    pub fn new(room_id: &str, admin_uid: &str, secret: &str) -> Self {
        Self {
            room_id: room_id.to_string(),
            admin_uid: admin_uid.to_string(),
            hashed_secret: hash_room_secret(secret),
            is_locked: false,
            connections: HashMap::new(),
            blacklist: HashSet::new(),
            message_history: Vec::new(),
            created_at: chrono::Utc::now().timestamp_millis(),
        }
    }

    /// Check if a user is the admin
    pub fn is_admin(&self, uid: &str) -> bool {
        self.admin_uid == uid
    }

    /// Check if a user is blacklisted
    pub fn is_blacklisted(&self, uid: &str) -> bool {
        self.blacklist.contains(uid)
    }

    /// Add a user to the room
    pub fn add_connection(&mut self, conn: RoomConnection) {
        self.connections.insert(conn.uid.clone(), conn);
    }

    /// Remove a user from the room
    pub fn remove_connection(&mut self, uid: &str) -> Option<RoomConnection> {
        self.connections.remove(uid)
    }

    /// Check if the room is empty
    pub fn is_empty(&self) -> bool {
        self.connections.is_empty()
    }

    /// Get user count
    pub fn user_count(&self) -> usize {
        self.connections.len()
    }

    /// Add a user to the blacklist
    pub fn add_to_blacklist(&mut self, uid: &str) {
        self.blacklist.insert(uid.to_string());
    }

    /// Remove a user from the blacklist
    pub fn remove_from_blacklist(&mut self, uid: &str) {
        self.blacklist.remove(uid);
    }

    /// Transfer admin to another user
    pub fn transfer_admin(&mut self, new_admin_uid: &str) -> bool {
        if self.connections.contains_key(new_admin_uid) {
            self.admin_uid = new_admin_uid.to_string();
            true
        } else {
            false
        }
    }

    /// Store a message in history
    pub fn store_message(&mut self, msg: StoredMessage) {
        self.message_history.push(msg);
        // Keep only last 1000 messages
        if self.message_history.len() > 1000 {
            self.message_history.drain(0..100);
        }
    }

    /// Add a reaction to a message
    pub fn add_reaction(&mut self, message_id: &str, emoji: &str, uid: &str) -> bool {
        if let Some(msg) = self.message_history.iter_mut().find(|m| m.message_id == message_id) {
            msg.reactions
                .entry(emoji.to_string())
                .or_insert_with(Vec::new)
                .push(uid.to_string());
            true
        } else {
            false
        }
    }

    /// Remove a reaction from a message
    pub fn remove_reaction(&mut self, message_id: &str, emoji: &str, uid: &str) -> bool {
        if let Some(msg) = self.message_history.iter_mut().find(|m| m.message_id == message_id) {
            if let Some(reactions) = msg.reactions.get_mut(emoji) {
                reactions.retain(|u| u != uid);
                if reactions.is_empty() {
                    msg.reactions.remove(emoji);
                }
            }
            true
        } else {
            false
        }
    }

    /// Mark a message as read by a user
    pub fn mark_read(&mut self, message_id: &str, uid: &str) -> bool {
        if let Some(msg) = self.message_history.iter_mut().find(|m| m.message_id == message_id) {
            msg.read_by.insert(uid.to_string());
            true
        } else {
            false
        }
    }

    /// Get message history (last N messages)
    pub fn get_history(&self, limit: usize) -> &[StoredMessage] {
        let start = if self.message_history.len() > limit {
            self.message_history.len() - limit
        } else {
            0
        };
        &self.message_history[start..]
    }

    /// Search messages by content (encrypted, so search by metadata)
    pub fn search_by_sender(&self, sender_uid: &str, limit: usize) -> Vec<&StoredMessage> {
        self.message_history
            .iter()
            .filter(|m| m.sender_uid == sender_uid)
            .rev()
            .take(limit)
            .collect()
    }

    /// Verify room secret
    pub fn verify_secret(&self, secret: &str) -> bool {
        verify_room_secret(secret, &self.hashed_secret)
    }
}

impl StoredMessage {
    /// Convert to payload for transmission
    pub fn to_payload(&self) -> StoredMessagePayload {
        StoredMessagePayload {
            message_id: self.message_id.clone(),
            sender_uid: self.sender_uid.clone(),
            sender_nickname: self.sender_nickname.clone(),
            encrypted_content: self.encrypted_content.clone(),
            iv: self.iv.clone(),
            timestamp: self.timestamp,
            message_type: self.message_type.clone(),
            reply_to: self.reply_to.clone(),
            mentions: self.mentions.clone(),
            reactions: self.reactions.clone(),
            read_by_count: self.read_by.len(),
        }
    }
}
