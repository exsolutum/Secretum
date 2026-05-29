import React, { useState, useRef, useEffect } from 'react';
import { DisplayMessage } from '../types/messages';

interface MessageListProps {
  messages: DisplayMessage[];
  myUid: string;
  onReply: (messageId: string, nickname: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onRead: (messageId: string) => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  myUid,
  onReply,
  onReaction,
  onRead,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const prevMsgCountRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current && messages.length > prevMsgCountRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Mark visible messages as read
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const msgId = entry.target.getAttribute('data-msg-id');
            if (msgId) onRead(msgId);
          }
        });
      },
      { threshold: 0.5 }
    );

    const msgElements = listRef.current?.querySelectorAll('[data-msg-id]');
    msgElements?.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, onRead]);

  // Group messages by date
  let lastDate = '';

  return (
    <div ref={listRef} style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    }}>
      {messages.map((msg) => {
        const msgDate = formatDate(msg.timestamp);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;

        const isSystem = msg.message_type === 'System';
        const isSelf = msg.is_self;

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '16px 0 8px',
              }}>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--accent-cyan-border)',
                }} />
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  letterSpacing: '2px',
                }}>
                  {msgDate.toUpperCase()}
                </span>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--accent-cyan-border)',
                }} />
              </div>
            )}

            {isSystem ? (
              <div style={{
                textAlign: 'center',
                padding: '4px 0',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {msg.content}
              </div>
            ) : (
              <div
                data-msg-id={msg.id}
                className="fade-in"
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => { setHoveredMsg(null); setShowReactionPicker(null); }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: isSelf ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  maxWidth: '75%',
                  alignSelf: isSelf ? 'flex-end' : 'flex-start',
                  background: hoveredMsg === msg.id ? 'var(--msg-bg)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '2px',
                  background: isSelf ? 'var(--accent-orange-dim)' : 'var(--accent-cyan-dim)',
                  border: `1px solid ${isSelf ? 'var(--accent-orange-border)' : 'var(--accent-cyan-border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: isSelf ? 'var(--accent-orange)' : 'var(--accent-cyan)',
                  flexShrink: 0,
                }}>
                  {msg.sender_nickname.charAt(0).toUpperCase()}
                </div>

                {/* Message content */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: 0,
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    flexDirection: isSelf ? 'row-reverse' : 'row',
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isSelf ? 'var(--accent-orange)' : 'var(--accent-cyan)',
                    }}>
                      {msg.sender_nickname}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* Reply reference */}
                  {msg.reply_to && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderLeft: '2px solid var(--accent-cyan-border)',
                      background: 'rgba(0, 240, 255, 0.03)',
                    }}>
                      ↩ Reply to message
                    </div>
                  )}

                  {/* Content */}
                  <div style={{
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>

                  {/* Reactions */}
                  {msg.reactions.size > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      marginTop: '4px',
                    }}>
                      {Array.from(msg.reactions.entries()).map(([emoji, uids]) => (
                        <span
                          key={emoji}
                          className="reaction"
                          onClick={() => onReaction(msg.id, emoji)}
                        >
                          {emoji}
                          <span className="reaction-count">{uids.length}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Read receipt */}
                  {isSelf && msg.read_by.size > 0 && (
                    <div className="read-receipt" style={{ alignSelf: 'flex-end' }}>
                      ✓ Read
                    </div>
                  )}
                </div>

                {/* Action buttons on hover */}
                {hoveredMsg === msg.id && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    [isSelf ? 'left' : 'right']: '40px',
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--bg-panel-solid)',
                    border: '1px solid var(--accent-cyan-border)',
                    borderRadius: 'var(--radius)',
                    padding: '2px',
                    zIndex: 10,
                  }}>
                    <button
                      onClick={() => onReply(msg.id, msg.sender_nickname)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        fontSize: '12px',
                      }}
                      title="Reply"
                    >
                      ↩
                    </button>
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        fontSize: '12px',
                      }}
                      title="React"
                    >
                      😊
                    </button>
                  </div>
                )}

                {/* Reaction picker */}
                {showReactionPicker === msg.id && (
                  <div style={{
                    position: 'absolute',
                    top: '-32px',
                    [isSelf ? 'left' : 'right']: '4px',
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--bg-panel-solid)',
                    border: '1px solid var(--accent-cyan-border)',
                    borderRadius: 'var(--radius)',
                    padding: '4px',
                    zIndex: 20,
                  }}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { onReaction(msg.id, emoji); setShowReactionPicker(null); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
