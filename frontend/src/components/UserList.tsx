import React, { useState } from 'react';
import { RoomUser } from '../types/messages';

interface UserListProps {
  users: RoomUser[];
  myUid: string;
  isAdmin: boolean;
  onAdminCommand: (command: string, targetUid: string, reason?: string) => void;
}

export const UserList: React.FC<UserListProps> = ({ users, myUid, isAdmin, onAdminCommand }) => {
  const [expanded, setExpanded] = useState(false);
  const [adminTarget, setAdminTarget] = useState<string | null>(null);

  const statusClass = (status: string) => {
    switch (status) {
      case 'Online': return 'status-online';
      case 'Away': return 'status-away';
      default: return 'status-offline';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'var(--accent-cyan-dim)',
          border: '1px solid var(--accent-cyan-border)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent-cyan)',
          padding: '4px 12px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '10px' }}>◉</span>
        {users.length}
        <span style={{ fontSize: '8px' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="panel" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          width: '220px',
          maxHeight: '300px',
          overflowY: 'auto',
          padding: '8px',
          zIndex: 100,
        }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-cyan)',
            letterSpacing: '2px',
            marginBottom: '8px',
          }}>
            MEMBERS
          </div>

          {users.map(user => (
            <div
              key={user.uid}
              onClick={() => setAdminTarget(adminTarget === user.uid ? null : user.uid)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 4px',
                cursor: isAdmin && user.uid !== myUid ? 'pointer' : 'default',
                borderRadius: 'var(--radius)',
                background: adminTarget === user.uid ? 'var(--accent-cyan-dim)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <span className={`status-dot ${statusClass(user.status)}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  color: user.uid === myUid ? 'var(--accent-orange)' : 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.nickname}
                  {user.is_admin && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '9px',
                      color: 'var(--accent-orange)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      [ADMIN]
                    </span>
                  )}
                </div>
                {user.uid === myUid && (
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    (YOU)
                  </span>
                )}
              </div>
            </div>
          ))}

          {isAdmin && adminTarget && adminTarget !== myUid && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid var(--accent-cyan-border)',
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
            }}>
              <button
                className="btn btn-sm btn-orange"
                onClick={() => { onAdminCommand('Kick', adminTarget); setAdminTarget(null); }}
              >
                KICK
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => { onAdminCommand('Ban', adminTarget); setAdminTarget(null); }}
              >
                BAN
              </button>
              <button
                className="btn btn-sm"
                onClick={() => { onAdminCommand('TransferAdmin', adminTarget); setAdminTarget(null); }}
              >
                TRANSFER
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
