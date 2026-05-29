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
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '12px' }}>
          <h1 style={{
            color: 'var(--accent-cyan)',
            fontSize: '2.6rem',
            fontWeight: 700,
            letterSpacing: '14px',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            margin: 0,
          }}>
            SECRETUM
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '4px',
            marginTop: '8px',
          }}>
            ENCRYPTED CHAT
          </p>
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
              display: 'block',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1px',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}>
              昵称
            </label>
            <input
              className="input"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="输入你的昵称"
              autoFocus
              style={{ fontSize: '15px' }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1px',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}>
              房间号
            </label>
            <input
              className="input"
              type="text"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              placeholder="输入或创建房间号"
              style={{ fontSize: '15px' }}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{
              display: 'block',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1px',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}>
              房间密钥
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                value={roomSecret}
                onChange={e => setRoomSecret(e.target.value)}
                placeholder="输入房间密钥"
                style={{ fontSize: '15px', paddingRight: '60px' }}
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
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '4px 6px',
                }}
              >
                {showSecret ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              color: 'var(--danger)',
              fontSize: '13px',
              padding: '10px 14px',
              background: 'rgba(255, 71, 87, 0.08)',
              border: '1px solid rgba(255, 71, 87, 0.25)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'left',
            }}>
              {error}
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={isConnecting || !nickname.trim() || !roomId.trim() || !roomSecret.trim()}
            style={{ marginTop: '8px', width: '100%', padding: '12px' }}
          >
            {isConnecting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px' }} />
                连接中...
              </span>
            ) : '进入房间'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          color: 'var(--text-dim)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '1px',
          lineHeight: '2',
        }}>
          SM4 + Ed25519 端到端加密<br />
          零知识 · 自托管
        </div>
      </div>
    </div>
  );
};
