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
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      // Escape to close search/context menu
      if (e.key === 'Escape') {
        setShowSearch(false);
        setContextMenu(null);
        setReplyTo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Notification for connection state changes
  useEffect(() => {
    if (chat.connectionState === 'connected') {
      addNotification('success', 'Connected to room');
    } else if (chat.connectionState === 'error') {
      addNotification('error', chat.error || 'Connection failed');
    }
  }, [chat.connectionState]);

  // Clear unread count when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      chat.clearUnread();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [chat]);

  const handleReply = useCallback((messageId: string, nickname: string) => {
    setReplyTo({ messageId, nickname });
  }, []);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    chat.sendReaction(messageId, emoji);
  }, [chat]);

  const handleFileUpload = useCallback((file: { name: string; mime: string; data: string; size: number }) => {
    chat.sendMessage(`[FILE] ${file.name} (${formatFileSize(file.size)})`);
    addNotification('info', `File "${file.name}" queued for encrypted upload`);
  }, [chat, addNotification]);

  const handleAdminCommand = useCallback((command: string, targetUid?: string, reason?: string) => {
    chat.executeAdminCommand(command, targetUid, reason);
    addNotification('info', `Admin command: ${command}`);
  }, [chat, addNotification]);

  const handleContextMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  if (chat.connectionState === 'disconnected' || chat.connectionState === 'error') {
    return <JoinRoom onJoin={chat.connect} connectionState={chat.connectionState} error={chat.error} />;
  }

  const typingNicknames = Array.from(chat.typingUsers.entries())
    .filter(([_, isTyping]) => isTyping)
    .map(([uid]) => {
      const user = chat.users.find(u => u.uid === uid);
      return user?.nickname || uid.substring(0, 8);
    });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
    }}>
      <NotificationSystem notifications={notifications} onDismiss={dismissNotification} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--accent-cyan-border)',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            color: 'var(--accent-cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '4px',
          }}>
            SECRETUM
          </span>
          <div style={{
            width: '1px',
            height: '16px',
            background: 'var(--accent-cyan-border)',
          }} />
          <ConnectionStatus state={chat.connectionState} />
          <div style={{
            width: '1px',
            height: '16px',
            background: 'var(--accent-cyan-border)',
          }} />
          <span style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          }}>
            {chat.roomInfo?.room_id || '...'}
          </span>
          {chat.roomInfo?.is_locked && (
            <span style={{ color: 'var(--accent-orange)', fontSize: '11px' }}>⊘ LOCKED</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AdminPanel
            isAdmin={chat.isAdmin}
            isLocked={chat.roomInfo?.is_locked || false}
            onCommand={handleAdminCommand}
            onSearch={(q) => { chat.searchMessages(q); setShowSearch(true); }}
          />
          <UserList
            users={chat.users}
            myUid={chat.myUid}
            isAdmin={chat.isAdmin}
            onAdminCommand={handleAdminCommand}
          />
          <button
            className="btn btn-sm"
            onClick={() => setShowSettings(true)}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            ⚙ SETTINGS
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={chat.disconnect}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            LEAVE
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
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>
          <span className="typing-dots">
            <span>●</span><span>●</span><span>●</span>
          </span>
          {' '}{typingNicknames.join(', ')} {typingNicknames.length === 1 ? 'is' : 'are'} typing
        </div>
      )}

      {/* Search results overlay */}
      {showSearch && chat.searchResults.length > 0 && (
        <div className="panel" style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          width: '320px',
          maxHeight: '400px',
          overflow: 'auto',
          zIndex: 100,
          padding: '12px',
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
              SEARCH RESULTS
            </span>
            <button
              onClick={() => setShowSearch(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          </div>
          {chat.searchResults.map(msg => (
            <div key={msg.id} style={{
              padding: '6px 8px',
              borderBottom: '1px solid var(--accent-cyan-border)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            onClick={() => {
              // Scroll to message
              const el = document.querySelector(`[data-msg-id="${msg.id}"]`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setShowSearch(false);
            }}
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
        gap: '4px',
        padding: '8px 16px',
        borderTop: '1px solid var(--accent-cyan-border)',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
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
