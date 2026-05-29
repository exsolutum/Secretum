import React, { useState } from 'react';

interface JoinRoomProps {
  onJoin: (nickname: string, roomId: string, roomSecret: string) => void;
  connectionState: string;
  error: string | null;
}

export const JoinRoom: React.FC<JoinRoomProps> = ({ onJoin, connectionState, error }) => {
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomSecret, setRoomSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomId.trim() || !roomSecret.trim()) return;
    onJoin(nickname.trim(), roomId.trim(), roomSecret.trim());
  };

  const isConnecting = connectionState === 'connecting';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      padding: '20px',
    }}>
      <div className="panel" style={{
        padding: '48px 40px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '8px' }}>
          <h1 style={{
            color: 'var(--accent-cyan)',
            fontSize: '2.4rem',
            fontWeight: 700,
            letterSpacing: '12px',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            margin: 0,
          }}>
            SECRETUM
          </h1>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '4px',
            marginTop: '4px',
          }}>
            ENCRYPTED CHAT PROTOCOL
          </div>
        </div>

        {/* Decorative line */}
        <div style={{
          width: '60px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)',
          margin: '24px auto',
        }} />

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}>
              CALLSIGN
            </label>
            <input
              className="input"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Your nickname"
              autoFocus
              maxLength={20}
              style={{ marginTop: '4px' }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}>
              ROOM ID
            </label>
            <input
              className="input"
              type="text"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              placeholder="Room identifier"
              maxLength={64}
              style={{ marginTop: '4px' }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}>
              ROOM SECRET
            </label>
            <div style={{ position: 'relative', marginTop: '4px' }}>
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                value={roomSecret}
                onChange={e => setRoomSecret(e.target.value)}
                placeholder="Encryption passphrase"
                style={{ paddingRight: '60px' }}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {showSecret ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              color: 'var(--danger)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              padding: '8px 12px',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid rgba(255, 71, 87, 0.3)',
              borderRadius: 'var(--radius)',
            }}>
              {error}
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={isConnecting || !nickname.trim() || !roomId.trim() || !roomSecret.trim()}
            style={{ marginTop: '8px', width: '100%' }}
          >
            {isConnecting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px' }} />
                CONNECTING
              </span>
            ) : 'ENTER ROOM'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          color: 'var(--text-secondary)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '1px',
          lineHeight: '1.8',
        }}>
          SM4 + Ed25519 ENCRYPTED<br />
          ZERO KNOWLEDGE / SELF HOSTED
        </div>
      </div>
    </div>
  );
};
