import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  DisplayMessage,
  RoomUser,
  ChatMessageType,
} from '../types/messages';
import { initWasm, getWasm, WasmCrypto } from './useWasm';

// Safe wasm helper - returns null if wasm not loaded
function safeWasm(): WasmCrypto | null {
  try { return getWasm(); } catch { return null; }
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UseChatReturn {
  connectionState: ConnectionState;
  messages: DisplayMessage[];
  users: RoomUser[];
  typingUsers: Map<string, boolean>;
  roomInfo: { room_id: string; is_locked: boolean; user_count: number } | null;
  isAdmin: boolean;
  myUid: string;
  myNickname: string;
  error: string | null;
  connect: (nickname: string, roomId: string, roomSecret: string) => void;
  sendMessage: (content: string, replyTo?: string) => void;
  sendTyping: (isTyping: boolean) => void;
  sendReadReceipt: (messageId: string) => void;
  sendReaction: (messageId: string, emoji: string, remove?: boolean) => void;
  executeAdminCommand: (command: string, targetUid?: string, reason?: string) => void;
  searchMessages: (query: string) => void;
  searchResults: DisplayMessage[];
  disconnect: () => void;
  unreadCount: number;
  clearUnread: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;
const MAX_MESSAGE_HISTORY = 500;

export function useChat(): UseChatReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map());
  const [roomInfo, setRoomInfo] = useState<{ room_id: string; is_locked: boolean; user_count: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUid, setMyUid] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DisplayMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const roomIdRef = useRef<string>('');
  const nicknameRef = useRef<string>('');
  const roomSecretRef = useRef<string>('');
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Initialize WASM
  useEffect(() => {
    initWasm().catch(console.error);
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not available
    }
  }, []);

  // Send queued messages
  const flushMessageQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      if (msg) wsRef.current.send(msg);
    }
  }, []);

  // Send message helper
  const send = useCallback((msgType: ClientMessageType, payload: unknown) => {
    const msg: ClientMessage = {
      msg_type: msgType,
      payload: JSON.stringify(payload),
      timestamp: Date.now(),
      message_id: null,
    };
    const json = JSON.stringify(msg);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(json);
    } else {
      messageQueueRef.current.push(json);
    }
  }, []);

  // Handle incoming server messages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.msg_type) {
      case 'AuthOk': {
        const data = JSON.parse(msg.payload);
        setMyUid(data.uid || '');
        setMyNickname(nicknameRef.current);
        setConnectionState('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Join room after auth
        send('Join', {
          room_id: roomIdRef.current,
          room_secret: roomSecretRef.current,
          nickname: nicknameRef.current,
        });
        break;
      }
      case 'AuthError': {
        setError(msg.payload || 'Authentication failed');
        setConnectionState('error');
        break;
      }
      case 'Joined': {
        const data = JSON.parse(msg.payload);
        setRoomInfo(data.room_info || null);
        setIsAdmin(data.is_admin || false);
        setConnectionState('connected');
        setError(null);
        break;
      }
      case 'UserJoined': {
        const data = JSON.parse(msg.payload);
        setUsers(prev => {
          const exists = prev.find(u => u.uid === data.uid);
          if (exists) return prev;
          return [...prev, {
            uid: data.uid,
            nickname: data.nickname,
            is_admin: data.is_admin || false,
            status: 'Online' as const,
            joined_at: data.joined_at || Date.now(),
          }];
        });
        break;
      }
      case 'UserLeft': {
        const data = JSON.parse(msg.payload);
        setUsers(prev => prev.filter(u => u.uid !== data.uid));
        break;
      }
      case 'UserList': {
        try {
          const data = JSON.parse(msg.payload);
          if (Array.isArray(data)) {
            setUsers(data.map((u: any) => ({
              uid: u.uid,
              nickname: u.nickname,
              is_admin: u.is_admin || false,
              status: u.status || 'Online',
              joined_at: u.joined_at || Date.now(),
            })));
          }
        } catch { /* ignore parse errors */ }
        break;
      }
      case 'Chat': {
        try {
          const data = JSON.parse(msg.payload);
          const wasm = safeWasm();
          let content = data.encrypted_content || '';
          try {
            if (wasm) {
              const key = wasm.derive_key(roomSecretRef.current, roomIdRef.current, 100000);
              content = wasm.sm4_decrypt(key, data.encrypted_content, data.iv);
              content = wasm.hex_to_text(content);
            }
          } catch {
            content = '[Encrypted message]';
          }

          const displayMsg: DisplayMessage = {
            id: data.message_id || Date.now().toString(),
            sender_uid: data.sender_uid || '',
            sender_nickname: data.sender_nickname || 'Unknown',
            content,
            timestamp: data.timestamp || Date.now(),
            message_type: data.message_type || 'Text',
            reply_to: data.reply_to || null,
            mentions: data.mentions || [],
            reactions: new Map(Object.entries(data.reactions || {})),
            read_by: new Set(data.read_by || []),
            is_self: (data.sender_uid || '') === myUid,
          };

          setMessages(prev => {
            const next = [...prev, displayMsg];
            return next.length > MAX_MESSAGE_HISTORY ? next.slice(-MAX_MESSAGE_HISTORY) : next;
          });

          // Increment unread if not from self and window not focused
          if (!displayMsg.is_self && !document.hasFocus()) {
            setUnreadCount(prev => prev + 1);
            playNotificationSound();
          }
        } catch { /* ignore parse errors */ }
        break;
      }
      case 'System': {
        const sysMsg: DisplayMessage = {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: msg.payload,
          timestamp: msg.timestamp,
          message_type: 'System',
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        };
        setMessages(prev => [...prev, sysMsg]);
        break;
      }
      case 'Typing': {
        try {
          const data = JSON.parse(msg.payload);
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.set(data.uid, data.is_typing);
            return next;
          });
          // Clear typing after timeout
          if (data.is_typing) {
            const existing = typingTimeoutRef.current.get(data.uid);
            if (existing) clearTimeout(existing);
            typingTimeoutRef.current.set(data.uid, setTimeout(() => {
              setTypingUsers(prev => {
                const next = new Map(prev);
                next.set(data.uid, false);
                return next;
              });
            }, 3000));
          }
        } catch { /* ignore */ }
        break;
      }
      case 'Read': {
        try {
          const data = JSON.parse(msg.payload);
          setMessages(prev => prev.map(m => {
            if (m.id === data.message_id) {
              const next = new Set(m.read_by);
              next.add(data.uid);
              return { ...m, read_by: next };
            }
            return m;
          }));
        } catch { /* ignore */ }
        break;
      }
      case 'Presence': {
        try {
          const data = JSON.parse(msg.payload);
          setUsers(prev => prev.map(u =>
            u.uid === data.uid ? { ...u, status: data.status } : u
          ));
        } catch { /* ignore */ }
        break;
      }
      case 'Kicked': {
        setError('You have been kicked from the room');
        setConnectionState('error');
        break;
      }
      case 'Banned': {
        setError('You have been banned from the room');
        setConnectionState('error');
        break;
      }
      case 'RoomLocked':
      case 'RoomUnlocked': {
        setRoomInfo(prev => prev ? { ...prev, is_locked: msg.msg_type === 'RoomLocked' } : null);
        break;
      }
      case 'RoomDestroyed': {
        setError('Room has been destroyed');
        setConnectionState('error');
        break;
      }
      case 'AdminTransferred': {
        try {
          const data = JSON.parse(msg.payload);
          setIsAdmin(data.new_admin_uid === myUid);
          setUsers(prev => prev.map(u => ({
            ...u,
            is_admin: u.uid === data.new_admin_uid,
          })));
        } catch { /* ignore */ }
        break;
      }
      case 'History': {
        try {
          const data = JSON.parse(msg.payload);
          if (Array.isArray(data.messages)) {
            const wasm = safeWasm();
            const historyMsgs: DisplayMessage[] = data.messages.map((m: any) => {
              let content = m.encrypted_content || '';
              try {
                if (wasm) {
                  const key = wasm.derive_key(roomSecretRef.current, roomIdRef.current, 100000);
                  content = wasm.sm4_decrypt(key, m.encrypted_content, m.iv);
                  content = wasm.hex_to_text(content);
                }
              } catch {
                content = '[Encrypted message]';
              }
              return {
                id: m.message_id || Date.now().toString(),
                sender_uid: m.sender_uid || '',
                sender_nickname: m.sender_nickname || 'Unknown',
                content,
                timestamp: m.timestamp || Date.now(),
                message_type: m.message_type || 'Text',
                reply_to: m.reply_to || null,
                mentions: m.mentions || [],
                reactions: new Map(Object.entries(m.reactions || {})),
                read_by: new Set(m.read_by || []),
                is_self: (m.sender_uid || '') === myUid,
              };
            });
            setMessages(prev => [...historyMsgs, ...prev].slice(-MAX_MESSAGE_HISTORY));
          }
        } catch { /* ignore */ }
        break;
      }
      case 'SearchResult': {
        try {
          const data = JSON.parse(msg.payload);
          if (Array.isArray(data.messages)) {
            const wasm = safeWasm();
            const results: DisplayMessage[] = data.messages.map((m: any) => {
              let content = m.encrypted_content || '';
              try {
                if (wasm) {
                  const key = wasm.derive_key(roomSecretRef.current, roomIdRef.current, 100000);
                  content = wasm.sm4_decrypt(key, m.encrypted_content, m.iv);
                  content = wasm.hex_to_text(content);
                }
              } catch {
                content = '[Encrypted message]';
              }
              return {
                id: m.message_id || Date.now().toString(),
                sender_uid: m.sender_uid || '',
                sender_nickname: m.sender_nickname || 'Unknown',
                content,
                timestamp: m.timestamp || Date.now(),
                message_type: m.message_type || 'Text',
                reply_to: m.reply_to || null,
                mentions: m.mentions || [],
                reactions: new Map(Object.entries(m.reactions || {})),
                read_by: new Set(m.read_by || []),
                is_self: (m.sender_uid || '') === myUid,
              };
            });
            setSearchResults(results);
          }
        } catch { /* ignore */ }
        break;
      }
      case 'Reaction': {
        try {
          const data = JSON.parse(msg.payload);
          setMessages(prev => prev.map(m => {
            if (m.id === data.message_id) {
              const next = new Map(m.reactions);
              if (data.remove) {
                const list = next.get(data.emoji) || [];
                const filtered = list.filter(u => u !== data.uid);
                if (filtered.length > 0) {
                  next.set(data.emoji, filtered);
                } else {
                  next.delete(data.emoji);
                }
              } else {
                const list = next.get(data.emoji) || [];
                if (!list.includes(data.uid)) {
                  next.set(data.emoji, [...list, data.uid]);
                }
              }
              return { ...m, reactions: next };
            }
            return m;
          }));
        } catch { /* ignore */ }
        break;
      }
      case 'File': {
        try {
          const data = JSON.parse(msg.payload);
          const fileMsg: DisplayMessage = {
            id: data.message?.message_id || Date.now().toString(),
            sender_uid: data.message?.sender_uid || '',
            sender_nickname: data.message?.sender_nickname || 'Unknown',
            content: `📎 File: ${data.file?.filename || 'unknown'} (${formatFileSize(data.file?.size || 0)})`,
            timestamp: data.message?.timestamp || Date.now(),
            message_type: 'File',
            reply_to: null,
            mentions: [],
            reactions: new Map(),
            read_by: new Set(),
            is_self: (data.message?.sender_uid || '') === myUid,
            file: data.file,
          };
          setMessages(prev => [...prev, fileMsg]);
          if (!fileMsg.is_self && !document.hasFocus()) {
            setUnreadCount(prev => prev + 1);
            playNotificationSound();
          }
        } catch { /* ignore */ }
        break;
      }
      case 'Error': {
        setError(msg.payload);
        break;
      }
    }
  }, [myUid, send, playNotificationSound]);

  // Connect to WebSocket
  const connect = useCallback((nickname: string, roomId: string, roomSecret: string) => {
    nicknameRef.current = nickname;
    roomIdRef.current = roomId;
    roomSecretRef.current = roomSecret;

    setConnectionState('connecting');
    setError(null);
    setMessages([]);
    setUsers([]);
    setSearchResults([]);
    setUnreadCount(0);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Generate keypair and authenticate
      const wasm = safeWasm();
      if (!wasm) {
        setError('Crypto module not loaded');
        setConnectionState('error');
        return;
      }
      const keypair = wasm.generate_keypair();
      const timestamp = Date.now();
      const message = `${keypair.public_key}:${timestamp}`;
      const messageHex = wasm.text_to_hex(message);
      const signature = wasm.sign(keypair.private_key, messageHex);

      send('Auth', {
        public_key: keypair.public_key,
        timestamp,
        signature,
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      // Auto-reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        setConnectionState('reconnecting');
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect(nickname, roomId, roomSecret);
        }, delay);
      }
    };

    ws.onerror = () => {
      setError('Connection failed');
      setConnectionState('error');
    };
  }, [send, handleServerMessage]);

  // Send a chat message
  const sendMessage = useCallback((content: string, replyTo?: string) => {
    const wasm = safeWasm();
    if (!wasm) return;
    const iv = wasm.random_bytes(16);
    const key = wasm.derive_key(roomSecretRef.current, roomIdRef.current, 100000);
    const contentHex = wasm.text_to_hex(content);
    const encrypted = wasm.sm4_encrypt(key, contentHex, iv);

    send('Chat', {
      room_id: roomIdRef.current,
      encrypted_content: encrypted,
      iv,
      timestamp: Date.now(),
      message_type: 'Text',
      reply_to: replyTo || null,
      mentions: [],
    });
  }, [send]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    send('Typing', {
      room_id: roomIdRef.current,
      is_typing: isTyping,
    });
  }, [send]);

  // Send read receipt
  const sendReadReceipt = useCallback((messageId: string) => {
    send('Read', {
      room_id: roomIdRef.current,
      message_id: messageId,
      timestamp: Date.now(),
    });
  }, [send]);

  // Send reaction
  const sendReaction = useCallback((messageId: string, emoji: string, remove = false) => {
    send('Reaction', {
      room_id: roomIdRef.current,
      message_id: messageId,
      emoji,
      remove,
    });
  }, [send]);

  // Execute admin command
  const executeAdminCommand = useCallback((command: string, targetUid?: string, reason?: string) => {
    send('Admin', {
      command,
      target_uid: targetUid || null,
      reason: reason || null,
    });
  }, [send]);

  // Search messages
  const searchMessages = useCallback((query: string) => {
    send('Search', {
      room_id: roomIdRef.current,
      query,
      limit: 50,
    });
  }, [send]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    if (wsRef.current) {
      send('Leave', { room_id: roomIdRef.current });
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
    setMessages([]);
    setUsers([]);
    setRoomInfo(null);
    setIsAdmin(false);
  }, [send]);

  // Clear unread count
  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      typingTimeoutRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Update document title with unread count
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) SECRETUM`;
    } else {
      document.title = 'SECRETUM';
    }
  }, [unreadCount]);

  return {
    connectionState,
    messages,
    users,
    typingUsers,
    roomInfo,
    isAdmin,
    myUid,
    myNickname,
    error,
    connect,
    sendMessage,
    sendTyping,
    sendReadReceipt,
    sendReaction,
    executeAdminCommand,
    searchMessages,
    searchResults,
    disconnect,
    unreadCount,
    clearUnread,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
