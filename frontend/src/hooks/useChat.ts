import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  DisplayMessage,
  RoomUser,
  ChatMessageType,
} from '../types/messages';
import { initWasm, getWasm } from './useWasm';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

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
}

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

  const wsRef = useRef<WebSocket | null>(null);
  const uidRef = useRef('');
  const roomIdRef = useRef('');
  const nicknameRef = useRef('');
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const msgCounterRef = useRef(0);

  // Initialize WASM on mount
  useEffect(() => {
    initWasm().catch(console.error);
  }, []);

  // Generate next message ID
  const nextMsgId = useCallback(() => {
    msgCounterRef.current += 1;
    return `${Date.now()}-${msgCounterRef.current}`;
  }, []);

  // Send a client message
  const send = useCallback((msgType: ClientMessageType, payload: object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = {
      msg_type: msgType,
      payload: JSON.stringify(payload),
      timestamp: Date.now(),
      message_id: nextMsgId(),
    };
    wsRef.current.send(JSON.stringify(msg));
  }, [nextMsgId]);

  // Handle incoming server messages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.msg_type) {
      case 'AuthOk': {
        const data = JSON.parse(msg.payload);
        setMyUid(data.uid);
        uidRef.current = data.uid;
        break;
      }
      case 'AuthError': {
        setError(msg.payload);
        setConnectionState('error');
        break;
      }
      case 'Joined': {
        const data = JSON.parse(msg.payload);
        setRoomInfo(data.room_info);
        setIsAdmin(data.is_admin);
        setConnectionState('connected');
        setError(null);
        if (data.users) setUsers(data.users);
        if (data.history) {
          const displayMsgs = data.history.map((m: any) => ({
            id: m.message_id,
            sender_uid: m.sender_uid,
            sender_nickname: m.sender_nickname,
            content: m.encrypted_content, // Will be decrypted by WASM
            timestamp: m.timestamp,
            message_type: m.message_type as ChatMessageType,
            reply_to: m.reply_to,
            mentions: m.mentions || [],
            reactions: new Map(Object.entries(m.reactions || {})),
            read_by: new Set(),
            is_self: m.sender_uid === uidRef.current,
          }));
          setMessages(displayMsgs);
        }
        break;
      }
      case 'UserJoined': {
        const data = JSON.parse(msg.payload);
        setUsers(prev => {
          if (prev.some(u => u.uid === data.uid)) return prev;
          return [...prev, { uid: data.uid, nickname: data.nickname, is_admin: data.is_admin, status: 'Online' as const, joined_at: data.joined_at }];
        });
        // System message
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: `${data.nickname} joined the room`,
          timestamp: Date.now(),
          message_type: 'System' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        }]);
        break;
      }
      case 'UserLeft': {
        const data = JSON.parse(msg.payload);
        setUsers(prev => prev.filter(u => u.uid !== data.uid));
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: `${data.nickname} left the room`,
          timestamp: Date.now(),
          message_type: 'System' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        }]);
        break;
      }
      case 'UserList': {
        const data = JSON.parse(msg.payload);
        setUsers(data.users);
        break;
      }
      case 'Chat': {
        const data = JSON.parse(msg.payload);
        const displayMsg: DisplayMessage = {
          id: data.message_id || nextMsgId(),
          sender_uid: data.sender_uid,
          sender_nickname: data.sender_nickname,
          content: data.encrypted_content,
          timestamp: data.timestamp,
          message_type: data.message_type as ChatMessageType,
          reply_to: data.reply_to,
          mentions: data.mentions || [],
          reactions: new Map(Object.entries(data.reactions || {})),
          read_by: new Set(),
          is_self: data.sender_uid === uidRef.current,
        };
        setMessages(prev => [...prev, displayMsg]);
        break;
      }
      case 'System': {
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: msg.payload,
          timestamp: msg.timestamp,
          message_type: 'System' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        }]);
        break;
      }
      case 'Typing': {
        const data = JSON.parse(msg.payload);
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.set(data.uid, data.is_typing);
          return next;
        });
        // Auto-clear typing after 3s
        const existing = typingTimeoutRef.current.get(data.uid);
        if (existing) clearTimeout(existing);
        if (data.is_typing) {
          const timeout = setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Map(prev);
              next.set(data.uid, false);
              return next;
            });
          }, 3000);
          typingTimeoutRef.current.set(data.uid, timeout);
        }
        break;
      }
      case 'Read': {
        const data = JSON.parse(msg.payload);
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            const newReadBy = new Set(m.read_by);
            newReadBy.add(data.uid);
            return { ...m, read_by: newReadBy };
          }
          return m;
        }));
        break;
      }
      case 'Presence': {
        const data = JSON.parse(msg.payload);
        setUsers(prev => prev.map(u =>
          u.uid === data.uid ? { ...u, status: data.status } : u
        ));
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
      case 'RoomLocked': {
        setRoomInfo(prev => prev ? { ...prev, is_locked: true } : null);
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: 'Room has been locked',
          timestamp: Date.now(),
          message_type: 'System' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        }]);
        break;
      }
      case 'RoomUnlocked': {
        setRoomInfo(prev => prev ? { ...prev, is_locked: false } : null);
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender_uid: 'system',
          sender_nickname: 'System',
          content: 'Room has been unlocked',
          timestamp: Date.now(),
          message_type: 'System' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: false,
        }]);
        break;
      }
      case 'RoomDestroyed': {
        setError('Room has been destroyed');
        setConnectionState('error');
        break;
      }
      case 'AdminTransferred': {
        const data = JSON.parse(msg.payload);
        setIsAdmin(data.new_admin_uid === uidRef.current);
        setUsers(prev => prev.map(u => ({
          ...u,
          is_admin: u.uid === data.new_admin_uid,
        })));
        break;
      }
      case 'History': {
        const data = JSON.parse(msg.payload);
        const displayMsgs = data.messages.map((m: any) => ({
          id: m.message_id,
          sender_uid: m.sender_uid,
          sender_nickname: m.sender_nickname,
          content: m.encrypted_content,
          timestamp: m.timestamp,
          message_type: m.message_type as ChatMessageType,
          reply_to: m.reply_to,
          mentions: m.mentions || [],
          reactions: new Map(Object.entries(m.reactions || {})),
          read_by: new Set(),
          is_self: m.sender_uid === uidRef.current,
        }));
        setMessages(prev => [...displayMsgs, ...prev]);
        break;
      }
      case 'SearchResult': {
        const data = JSON.parse(msg.payload);
        const displayMsgs = data.messages.map((m: any) => ({
          id: m.message_id,
          sender_uid: m.sender_uid,
          sender_nickname: m.sender_nickname,
          content: m.encrypted_content,
          timestamp: m.timestamp,
          message_type: m.message_type as ChatMessageType,
          reply_to: m.reply_to,
          mentions: m.mentions || [],
          reactions: new Map(Object.entries(m.reactions || {})),
          read_by: new Set(),
          is_self: m.sender_uid === uidRef.current,
        }));
        setSearchResults(displayMsgs);
        break;
      }
      case 'Reaction': {
        const data = JSON.parse(msg.payload);
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            const newReactions = new Map(m.reactions);
            if (data.remove) {
              const list = newReactions.get(data.emoji) || [];
              newReactions.set(data.emoji, list.filter(u => u !== data.uid));
              if (newReactions.get(data.emoji)?.length === 0) {
                newReactions.delete(data.emoji);
              }
            } else {
              const list = newReactions.get(data.emoji) || [];
              if (!list.includes(data.uid)) {
                list.push(data.uid);
              }
              newReactions.set(data.emoji, list);
            }
            return { ...m, reactions: newReactions };
          }
          return m;
        }));
        break;
      }
      case 'File': {
        const data = JSON.parse(msg.payload);
        const displayMsg: DisplayMessage = {
          id: data.message?.message_id || nextMsgId(),
          sender_uid: data.message?.sender_uid || '',
          sender_nickname: data.message?.sender_nickname || '',
          content: data.file ? `📎 ${data.file.filename}` : 'File shared',
          timestamp: data.message?.timestamp || Date.now(),
          message_type: 'File' as ChatMessageType,
          reply_to: null,
          mentions: [],
          reactions: new Map(),
          read_by: new Set(),
          is_self: (data.message?.sender_uid || '') === uidRef.current,
          file: data.file,
        };
        setMessages(prev => [...prev, displayMsg]);
        break;
      }
      case 'Error': {
        setError(msg.payload);
        break;
      }
    }
  }, [nextMsgId]);

  // Connect to server
  const connect = useCallback((nickname: string, roomId: string, roomSecret: string) => {
    setConnectionState('connecting');
    setError(null);
    nicknameRef.current = nickname;
    roomIdRef.current = roomId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth message
      const wasm = getWasm();
      if (wasm) {
        try {
          const keypair = wasm.generate_keypair();
          const timestamp = Date.now().toString();
          const msgHex = wasm.text_to_hex(timestamp);
          const signature = wasm.sign(keypair.private_key, msgHex);

          send('Auth', {
            public_key: keypair.public_key,
            timestamp: parseInt(timestamp),
            signature,
          });
        } catch (e) {
          console.error('WASM auth failed:', e);
          // Fallback: send auth without crypto
          send('Auth', {
            public_key: `fallback_${Date.now()}`,
            timestamp: Date.now(),
            signature: 'fallback',
          });
        }
      } else {
        send('Auth', {
          public_key: `fallback_${Date.now()}`,
          timestamp: Date.now(),
          signature: 'fallback',
        });
      }

      // Send join message
      send('Join', {
        room_id: roomId,
        room_secret: roomSecret,
        nickname,
      });

      setMyNickname(nickname);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onerror = () => {
      setError('Connection error');
      setConnectionState('error');
    };

    ws.onclose = () => {
      if (connectionState !== 'error') {
        setConnectionState('disconnected');
      }
    };
  }, [send, handleServerMessage, connectionState]);

  // Send a chat message
  const sendMessage = useCallback((content: string, replyTo?: string) => {
    const wasm = getWasm();
    let encryptedContent = content;
    let iv = '';

    if (wasm) {
      try {
        iv = wasm.random_bytes(16);
        const key = wasm.derive_key(roomIdRef.current, iv, 10000);
        const contentHex = wasm.text_to_hex(content);
        encryptedContent = wasm.sm4_encrypt(key, contentHex, iv);
      } catch (e) {
        console.error('Encryption failed, sending plaintext:', e);
      }
    }

    send('Chat', {
      room_id: roomIdRef.current,
      encrypted_content: encryptedContent,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      typingTimeoutRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

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
  };
}
