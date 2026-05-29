import React, { useState, useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
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

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 20);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        background: 'var(--bg-panel-solid)',
        border: '1px solid var(--accent-cyan-border)',
        borderRadius: 'var(--radius)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 10000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && i > 0 && (
            <div style={{
              height: '1px',
              background: 'var(--accent-cyan-border)',
              margin: '4px 0',
            }} />
          )}
          <div
            onClick={() => { item.action(); onClose(); }}
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = item.danger
                ? 'rgba(255, 71, 87, 0.15)'
                : 'var(--accent-cyan-dim)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
