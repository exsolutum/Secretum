import React, { useState } from 'react';

interface AdminPanelProps {
  isAdmin: boolean;
  isLocked: boolean;
  onCommand: (command: string) => void;
  onSearch: (query: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isAdmin, isLocked, onCommand, onSearch }) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <button
        className="btn btn-sm"
        onClick={() => setShowSearch(!showSearch)}
        style={{ fontSize: '10px', padding: '4px 10px' }}
      >
        ⌕ SEARCH
      </button>

      {showSearch && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <input
            className="input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                onSearch(searchQuery.trim());
              }
            }}
            placeholder="Search messages..."
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              width: '180px',
            }}
          />
          <button
            className="btn btn-sm"
            onClick={() => {
              if (searchQuery.trim()) onSearch(searchQuery.trim());
            }}
            style={{ fontSize: '10px', padding: '4px 8px' }}
          >
            GO
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            background: 'var(--accent-cyan-border)',
            margin: '0 4px',
          }} />
          <button
            className={`btn btn-sm ${isLocked ? 'btn-orange' : ''}`}
            onClick={() => onCommand(isLocked ? 'UnlockRoom' : 'LockRoom')}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {isLocked ? '⊘ UNLOCK' : '⊘ LOCK'}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm('Destroy this room? This cannot be undone.')) {
                onCommand('DestroyRoom');
              }
            }}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            ✕ DESTROY
          </button>
        </>
      )}
    </div>
  );
};
