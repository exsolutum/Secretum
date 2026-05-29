import React, { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (content: string, replyTo?: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo: { messageId: string; nickname: string } | null;
  onCancelReply: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  disabled,
  replyTo,
  onCancelReply,
}) => {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    if (e.target.value.length > 0) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    } else {
      onTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handleSend = () => {
    if (!content.trim() || disabled) return;
    onSend(content.trim(), replyTo?.messageId);
    setContent('');
    onTyping(false);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  return (
    <div style={{
      padding: '8px 16px 16px',
      borderTop: '1px solid var(--accent-cyan-border)',
      background: 'var(--bg-panel)',
      backdropFilter: 'blur(12px)',
    }}>
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          marginBottom: '8px',
          background: 'var(--accent-cyan-dim)',
          borderLeft: '2px solid var(--accent-cyan)',
          borderRadius: '0 var(--radius) var(--radius) 0',
          fontSize: '12px',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Replying to <span style={{ color: 'var(--accent-cyan)' }}>{replyTo.nickname}</span>
          </span>
          <button
            onClick={onCancelReply}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
      }}>
        <textarea
          ref={inputRef}
          className="input"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={disabled ? 'Connecting...' : 'Type a message... (Shift+Enter for new line)'}
          disabled={disabled}
          rows={1}
          style={{
            resize: 'none',
            minHeight: '40px',
            maxHeight: '120px',
            lineHeight: '1.5',
          }}
        />
        <button
          className="btn btn-sm"
          onClick={handleSend}
          disabled={disabled || !content.trim()}
          style={{
            flexShrink: 0,
            height: '40px',
            minWidth: '60px',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
};
