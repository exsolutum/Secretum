import React, { useState, useEffect, useCallback } from 'react';
import { DisplayMessage } from '../types/messages';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  },
  {
    name: 'Gestures',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  },
  {
    name: 'Objects',
    emojis: ['🔥', '⭐', '🌟', '💫', '✨', '⚡', '☄️', '💥', '💢', '💦', '💨', '🕳️', '💣', '💬', '💭', '🗯️', '📌', '📎', '🔒', '🔓', '🔑', '🗝️', '🛡️', '⚙️', '🧲', '💎', '🔔', '🔕', '🎵', '🎶', '🎤', '🎧', '📱', '💻', '🖥️', '📷', '📹', '🎮', '🕹️'],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose, position }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(position.x, window.innerWidth - 320);
  const adjustedY = Math.min(position.y, window.innerHeight - 400);

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter((_, i) => i % 3 === 0) // Simple filter
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        width: '300px',
        maxHeight: '380px',
        background: 'var(--bg-panel-solid)',
        border: '1px solid var(--accent-cyan-border)',
        borderRadius: 'var(--radius)',
        zIndex: 10001,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search */}
      <div style={{ padding: '8px', borderBottom: '1px solid var(--accent-cyan-border)' }}>
        <input
          className="input"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search emoji..."
          style={{ width: '100%', fontSize: '12px', padding: '4px 8px' }}
          autoFocus
        />
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--accent-cyan-border)',
        overflow: 'auto',
      }}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            style={{
              background: activeCategory === i ? 'var(--accent-cyan-dim)' : 'transparent',
              border: 'none',
              borderBottom: activeCategory === i ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: activeCategory === i ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              padding: '6px 10px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div style={{
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '2px',
        overflow: 'auto',
        maxHeight: '260px',
      }}>
        {filteredEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => { onSelect(emoji); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
              borderRadius: '2px',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = 'var(--accent-cyan-dim)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = 'none';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

import { useRef } from 'react';
