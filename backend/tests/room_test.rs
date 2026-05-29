use secretum::messages::ChatMessageType;
use secretum::room::{hash_room_secret, verify_room_secret, Room, RoomConnection, StoredMessage};
use std::collections::{HashMap, HashSet};

#[test]
fn test_hash_and_verify_room_secret() {
    let secret = "my_super_secret_password";
    let hash = hash_room_secret(secret);
    assert!(!hash.is_empty());
    assert!(verify_room_secret(secret, &hash));
    assert!(!verify_room_secret("wrong_password", &hash));
}

#[test]
fn test_room_creation() {
    let room = Room::new("test-room", "admin-uid-123", "secret123");
    assert_eq!(room.room_id, "test-room");
    assert_eq!(room.admin_uid, "admin-uid-123");
    assert!(!room.is_locked);
    assert!(room.connections.is_empty());
    assert!(room.blacklist.is_empty());
    assert!(room.message_history.is_empty());
}

#[test]
fn test_room_add_connection() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    let conn = RoomConnection {
        uid: "user-1".to_string(),
        nickname: "Alice".to_string(),
        public_key: "pk123".to_string(),
        joined_at: 1000,
        is_typing: false,
        last_read: 0,
    };
    room.add_connection(conn);
    assert_eq!(room.connections.len(), 1);
    assert!(room.connections.contains_key("user-1"));
}

#[test]
fn test_room_remove_connection() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    let conn = RoomConnection {
        uid: "user-1".to_string(),
        nickname: "Alice".to_string(),
        public_key: "pk123".to_string(),
        joined_at: 1000,
        is_typing: false,
        last_read: 0,
    };
    room.add_connection(conn);
    let removed = room.remove_connection("user-1");
    assert!(removed.is_some());
    assert!(room.connections.is_empty());
}

#[test]
fn test_room_blacklist() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    room.add_to_blacklist("bad-user");
    assert!(room.is_blacklisted("bad-user"));
    assert!(!room.is_blacklisted("good-user"));
    room.remove_from_blacklist("bad-user");
    assert!(!room.is_blacklisted("bad-user"));
}

#[test]
fn test_room_admin() {
    let room = Room::new("test-room", "admin-uid", "secret");
    assert!(room.is_admin("admin-uid"));
    assert!(!room.is_admin("other-uid"));
}

#[test]
fn test_room_transfer_admin() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    // Add the new admin as a connection first (transfer_admin requires user in room)
    let conn = RoomConnection {
        uid: "new-admin".to_string(),
        nickname: "Bob".to_string(),
        public_key: "pk456".to_string(),
        joined_at: 1000,
        is_typing: false,
        last_read: 0,
    };
    room.add_connection(conn);
    let transferred = room.transfer_admin("new-admin");
    assert!(transferred);
    assert_eq!(room.admin_uid, "new-admin");
    assert!(room.is_admin("new-admin"));
}

#[test]
fn test_room_lock() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    room.is_locked = true;
    assert!(room.is_locked);
    room.is_locked = false;
    assert!(!room.is_locked);
}

#[test]
fn test_room_store_message() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    let msg = StoredMessage {
        message_id: "msg-1".to_string(),
        sender_uid: "user-1".to_string(),
        sender_nickname: "Alice".to_string(),
        encrypted_content: "encrypted_data".to_string(),
        iv: "iv123".to_string(),
        timestamp: 1000,
        message_type: ChatMessageType::Text,
        reply_to: None,
        mentions: vec![],
        reactions: HashMap::new(),
        read_by: HashSet::new(),
    };
    room.store_message(msg);
    assert_eq!(room.message_history.len(), 1);
}

#[test]
fn test_room_reactions() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    let msg = StoredMessage {
        message_id: "msg-1".to_string(),
        sender_uid: "user-1".to_string(),
        sender_nickname: "Alice".to_string(),
        encrypted_content: "encrypted_data".to_string(),
        iv: "iv123".to_string(),
        timestamp: 1000,
        message_type: ChatMessageType::Text,
        reply_to: None,
        mentions: vec![],
        reactions: HashMap::new(),
        read_by: HashSet::new(),
    };
    room.store_message(msg);
    let added = room.add_reaction("msg-1", "👍", "user-2");
    assert!(added);
    let removed = room.remove_reaction("msg-1", "👍", "user-2");
    assert!(removed);
}

#[test]
fn test_room_mark_read() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    let msg = StoredMessage {
        message_id: "msg-1".to_string(),
        sender_uid: "user-1".to_string(),
        sender_nickname: "Alice".to_string(),
        encrypted_content: "encrypted_data".to_string(),
        iv: "iv123".to_string(),
        timestamp: 1000,
        message_type: ChatMessageType::Text,
        reply_to: None,
        mentions: vec![],
        reactions: HashMap::new(),
        read_by: HashSet::new(),
    };
    room.store_message(msg);
    let marked = room.mark_read("msg-1", "user-2");
    assert!(marked);
}

#[test]
fn test_room_history_limit() {
    let mut room = Room::new("test-room", "admin-uid", "secret");
    for i in 0..150 {
        let msg = StoredMessage {
            message_id: format!("msg-{}", i),
            sender_uid: "user-1".to_string(),
            sender_nickname: "Alice".to_string(),
            encrypted_content: format!("encrypted-{}", i),
            iv: "iv123".to_string(),
            timestamp: 1000 + i,
            message_type: ChatMessageType::Text,
            reply_to: None,
            mentions: vec![],
            reactions: HashMap::new(),
            read_by: HashSet::new(),
        };
        room.store_message(msg);
    }
    let history = room.get_history(50);
    assert_eq!(history.len(), 50);
    assert_eq!(history[0].message_id, "msg-100");
}

#[test]
fn test_room_verify_secret() {
    let room = Room::new("test-room", "admin-uid", "my_secret");
    assert!(room.verify_secret("my_secret"));
    assert!(!room.verify_secret("wrong_secret"));
}
