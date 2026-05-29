import React, { useState, useCallback, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { JoinRoom } from './JoinRoom';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { UserList } from './UserList';
import { AdminPanel } from './AdminPanel';
import { FileUpload } from './FileUpload';
import { NotificationSystem, useNotifications } from './Notifications';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ConnectionStatus } from './ConnectionStatus';
import { SettingsPanel } from './SettingsPanel';

export const ChatRoom: React.FC = () => {
  const chat = useChat();
  const [replyTo, setReplyTo] = useState<{ messageId: string; nickname: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { notifications, addNotification, dismissNotification } = useNotifications();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setContextMenu(null);
        setReplyTo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Connection notifications
  useEffect(() => {
    if (chat.connectionState === 'connected') addNotification('success', '已连接到房间');
    else if (chat.connectionState === 'error') addNotification('error', chat.error || '连接失败');
  }, [chat.connectionState]);

  // Clear unread on focus
  useEffect(() => {
    const handleFocus = () => chat.clearUnread();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [chat]);

  const handleReply = useCallback((messageId: string, nickname: string) => setReplyTo({ messageId, nickname }), []);
  const handleReaction = useCallback((messageId: string, emoji: string) => chat.sendReaction(messageId, emoji), [chat]);
  const handleAdminCommand = useCallback((command: string, targetUid?: string, reason?: string) => chat.executeAdminCommand(command, targetUid, reason), [chat]);

  const handleFileUpload = useCallback((file: { name: string; mime: string; data: string; size: number }) => {
    chat.sendMessage(`📎 ${file.name} (${formatFileSize(file.size)})`);
  }, [chat]);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: '回复', action: () => handleReply(msg.id, msg.sender_nickname) },
        { label: '复制文字', action: () => navigator.clipboard?.writeText(msg.content) },
        { separator: true, label: '', action: () => {} },
        ...REACTION_EMOJIS.map(emoji => ({
          label: emoji, action: () => handleReaction(msg.id, emoji),
        })),
      ],
    });
  }, [handleReply, handleReaction]);

  if (chat.connectionState === 'disconnected' || chat.connectionState === 'error') {
    return <JoinRoom onJoin={chat.connect} connectionState={chat.connectionState} error={chat.error} />;
  }

  const typingNicknames = Array.from(chat.typingUsers.entries())
    .filter(([_, isTyping]) => isTyping)
    .map(([uid]) => chat.users.find(u => u.uid === uid)?.nickname || uid.substring(0, 8));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
    }}>
      {/* Notifications */}
      <NotificationSystem notifications={notifications} onDismiss={dismissNotification} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />
      )}

      {/* Header */}
      <header className="panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        flexShrink: 0,
        gap: '12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: 0,
          flex: 1,
        }}>
          <ConnectionStatus state={chat.connectionState} />
          <div style={{ width: '1px', height: '14px', background: 'var(--accent-cyan-border)', flexShrink: 0 }} />
          <span style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {chat.roomInfo?.room_id || '...'}
          </span>
          {chat.roomInfo?.is_locked && (
            <span style={{ color: 'var(--accent-orange)', fontSize: '11px' }}>⊘</span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}>
          <UserList
            users={chat.users}
            myUid={chat.myUid}
            isAdmin={chat.isAdmin}
            onAdminCommand={handleAdminCommand}
          />
          <AdminPanel
            isAdmin={chat.isAdmin}
            isLocked={chat.roomInfo?.is_locked || false}
            onCommand={chat.executeAdminCommand}
            onSearch={(q) => { chat.searchMessages(q); setShowSearch(true); }}
          />
          <button className="btn btn-sm" onClick={() => setShowSettings(true)} style={{ fontSize: '10px', padding: '4px 10px' }}>
            ⚙
          </button>
          <button className="btn btn-sm btn-danger" onClick={chat.disconnect} style={{ fontSize: '10px', padding: '4px 10px' }}>
            退出
          </button>
        </div>
      </header>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Messages */}
      <MessageList
        messages={chat.messages}
        myUid={chat.myUid}
        onReply={handleReply}
        onReaction={handleReaction}
        onRead={chat.sendReadReceipt}
      />

      {/* Typing indicator */}
      {typingNicknames.length > 0 && (
        <div style={{
          padding: '4px 16px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <span className="typing-dots"><span /><span /><span /></span>
          <span>{typingNicknames.join('、')} 正在输入...</span>
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="panel" style={{
          margin: '0 16px 8px',
          padding: '12px',
          maxHeight: '200px',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '11px',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '2px',
            }}>
              搜索结果
            </span>
            <button onClick={() => setShowSearch(false)} style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '14px',
            }}>
              ✕
            </button>
          </div>
          {chat.searchResults.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '8px 0' }}>
              暂无结果
            </div>
          )}
          {chat.searchResults.map(msg => (
            <div key={msg.id} style={{
              padding: '6px 8px',
              borderBottom: '1px solid rgba(0, 240, 255, 0.08)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            onClick={() => setShowSearch(false)}
            >
              <span style={{ color: 'var(--accent-cyan)', fontSize: '11px' }}>
                {msg.sender_nickname}
              </span>
              <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                {msg.content.substring(0, 100)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
        padding: '10px 16px',
        borderTop: '1px solid var(--accent-cyan-border)',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}>
        <FileUpload onUpload={handleFileUpload} disabled={chat.connectionState !== 'connected'} />
        <div style={{ flex: 1 }}>
          <MessageInput
            onSend={chat.sendMessage}
            onTyping={chat.sendTyping}
            disabled={chat.connectionState !== 'connected'}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </div>
      </div>
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
