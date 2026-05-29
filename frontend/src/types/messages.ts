// Auto-generated types from ts-rs - these will be overwritten by cargo build
// For now, define them manually to match the Rust types

export interface AuthMessage {
  public_key: string;
  timestamp: number;
  signature: string;
}

export interface JoinMessage {
  room_id: string;
  room_secret: string;
  nickname: string;
}

export interface ChatMessage {
  room_id: string;
  encrypted_content: string;
  iv: string;
  timestamp: number;
  message_type: ChatMessageType;
  reply_to: string | null;
  mentions: string[];
}

export type ChatMessageType = 'Text' | 'Image' | 'File' | 'System' | 'Reaction';

export interface TypingIndicator {
  room_id: string;
  is_typing: boolean;
}

export interface ReadReceipt {
  room_id: string;
  message_id: string;
  timestamp: number;
}

export interface PresenceUpdate {
  uid: string;
  nickname: string;
  status: UserStatus;
}

export type UserStatus = 'Online' | 'Away' | 'Offline';

export interface AdminCommand {
  command: AdminCommandType;
  target_uid: string | null;
  reason: string | null;
}

export type AdminCommandType = 'Kick' | 'Ban' | 'Unban' | 'LockRoom' | 'UnlockRoom' | 'DestroyRoom' | 'TransferAdmin';

export interface RoomUser {
  uid: string;
  nickname: string;
  is_admin: boolean;
  status: UserStatus;
  joined_at: number;
}

export interface RoomInfo {
  room_id: string;
  is_locked: boolean;
  user_count: number;
  max_connections: number;
}

export interface SearchRequest {
  room_id: string;
  query: string;
  limit: number;
}

export interface SearchResult {
  messages: ChatMessage[];
  total: number;
}

export interface FileMetadata {
  filename: string;
  mime_type: string;
  size: number;
  encrypted_data: string;
  iv: string;
}

export interface ReactionMessage {
  room_id: string;
  message_id: string;
  emoji: string;
  remove: boolean;
}

// Client -> Server message wrapper
export interface ClientMessage {
  msg_type: ClientMessageType;
  payload: string;
  timestamp: number;
  message_id: string | null;
}

export type ClientMessageType = 'Auth' | 'Join' | 'Chat' | 'Typing' | 'Read' | 'Presence' | 'Admin' | 'Leave' | 'RequestHistory' | 'Search' | 'Reaction' | 'File';

// Server -> Client message wrapper
export interface ServerMessage {
  msg_type: ServerMessageType;
  payload: string;
  timestamp: number;
  message_id: string | null;
}

export type ServerMessageType = 'AuthOk' | 'AuthError' | 'Joined' | 'UserJoined' | 'UserLeft' | 'UserList' | 'Chat' | 'System' | 'Typing' | 'Read' | 'Presence' | 'Kicked' | 'Banned' | 'RoomLocked' | 'RoomUnlocked' | 'RoomDestroyed' | 'AdminTransferred' | 'History' | 'SearchResult' | 'Reaction' | 'File' | 'Error';

// Decrypted message for UI display
export interface DisplayMessage {
  id: string;
  sender_uid: string;
  sender_nickname: string;
  content: string;
  timestamp: number;
  message_type: ChatMessageType;
  reply_to: string | null;
  mentions: string[];
  reactions: Map<string, string[]>;
  read_by: Set<string>;
  is_self: boolean;
  file?: FileMetadata;
}
