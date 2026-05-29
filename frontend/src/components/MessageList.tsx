import React, { useState, useRef, useEffect } from 'react';
import { DisplayMessage } from '../types/messages';
import { Avatar } from './Avatar';

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
  if (d.toDateString() === today.toDateString()) return '今天';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function shouldShowDateSeparator(msg: DisplayMessage, prev?: DisplayMessage): boolean {
  if (!prev) return true;
  const day1 = new Date(msg.timestamp).toDateString();
  const day2 = new Date(prev.timestamp).toDateString();
  return day1 !== day2;
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

  // Auto-scroll
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

  return (
    <div
      ref={listRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      {messages.map((msg, i) => {
        const prev = i > 0 ? messages[i - 1] : undefined;
        const isSelf = msg.is_self;
        const isSystem = msg.message_type === 'System';
        const showDate = shouldShowDateSeparator(msg, prev);
        const isGrouped = prev && !isSystem && !prev.message_type.includes('System')
          && prev.sender_uid === msg.sender_uid
          && msg.timestamp - prev.timestamp < 60000;

        return (
          <React.Fragment key={msg.id}>
            {/* Date separator */}
            {showDate && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '16px 0 8px',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0, 240, 255, 0.1)' }} />
                <span style={{
                  color: 'var(--text-dim)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                }}>
                  {formatDate(msg.timestamp)}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0, 240, 255, 0.1)' }} />
              </div>
            )}

            {/* System message */}
            {isSystem ? (
              <div style={{
                textAlign: 'center',
                padding: '6px 0',
                margin: '4px 0',
              }}>
                <span style={{
                  color: 'var(--text-dim)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                }}>
                  ▶ {msg.content}
                </span>
              </div>
            ) : (
              /* Normal message */
              <div
                data-msg-id={msg.id}
                onMouseEnter={() => setHoveredMsg(msg.id)}
                onMouseLeave={() => { setHoveredMsg(null); setShowReactionPicker(null); }}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: isGrouped ? '2px 8px' : '8px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: hoveredMsg === msg.id ? 'var(--msg-bg)' : 'transparent',
                  transition: 'background 0.15s ease',
                  flexDirection: isSelf ? 'row-reverse' : 'row',
                  position: 'relative',
                }}
              >
                {/* Avatar - only show if not grouped */}
                {!isGrouped ? (
                  <Avatar uid={msg.sender_uid} nickname={msg.sender_nickname} size={36} />
                ) : (
                  <div style={{ width: '36px', flexShrink: 0 }} />
                )}

                {/* Content */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  maxWidth: '75%',
                  minWidth: '0',
                }}>
                  {/* Name + time - only show if not grouped */}
                  {!isGrouped && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      flexDirection: isSelf ? 'row-reverse' : 'row',
                    }}>
                      <span style={{
                        color: isSelf ? 'var(--accent-orange)' : 'var(--accent-cyan)',
                        fontSize: '13px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {msg.sender_nickname}
                      </span>
                      <span style={{
                        color: 'var(--text-dim)',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0,
                      }}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* Reply reference */}
                  {msg.reply_to && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-dim)',
                      padding: '2px 8px',
                      borderLeft: isSelf ? 'none' : '2px solid var(--accent-cyan-border)',
                      borderRight: isSelf ? '2px solid var(--accent-orange-border)' : 'none',
                      marginBottom: '2px',
                    }}>
                      ↩ 回复
                    </div>
                  )}

                  {/* Message body */}
                  <div style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    lineHeight: '1.65',
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
                      marginTop: '4px',
                      flexWrap: 'wrap',
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
                </div>

                {/* Hover actions */}
                {hoveredMsg === msg.id && !isSystem && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    [isSelf ? 'left' : 'right']: '48px',
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--bg-panel-solid)',
                    border: '1px solid var(--accent-cyan-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px',
                    zIndex: 10,
                  }}>
                    <button
                      onClick={() => onReply(msg.id, msg.sender_nickname)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px 6px', fontSize: '12px',
                      }}
                      title="回复"
                    >
                      ↩
                    </button>
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px 6px', fontSize: '12px',
                      }}
                      title="表情"
                    >
                      😊
                    </button>
                  </div>
                )}

                {/* Reaction picker */}
                {showReactionPicker === msg.id && (
                  <div style={{
                    position: 'absolute',
                    top: '-36px',
                    [isSelf ? 'left' : 'right']: '48px',
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--bg-panel-solid)',
                    border: '1px solid var(--accent-cyan-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px',
                    zIndex: 20,
                  }}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { onReaction(msg.id, emoji); setShowReactionPicker(null); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '18px', padding: '2px 4px', borderRadius: '2px',
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
