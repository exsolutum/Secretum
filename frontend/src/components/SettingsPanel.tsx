import React, { useState } from 'react';
import { isSoundEnabled, toggleSound } from '../hooks/useSounds';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundOn(newState);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}
    onClick={onClose}
    >
      <div className="panel" style={{
        padding: '24px',
        maxWidth: '360px',
        width: '90%',
      }}
      onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{
            color: 'var(--accent-cyan)',
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '2px',
            margin: 0,
          }}>
            SETTINGS
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Sound toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid var(--accent-cyan-border)',
        }}>
          <div>
            <div style={{
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}>
              Sound Notifications
            </div>
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: '11px',
              marginTop: '2px',
            }}>
              Play sounds for new messages
            </div>
          </div>
          <button
            onClick={handleToggleSound}
            style={{
              background: soundOn ? 'var(--accent-cyan-dim)' : 'var(--input-bg)',
              border: `1px solid ${soundOn ? 'var(--accent-cyan-border)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 'var(--radius)',
              color: soundOn ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              padding: '6px 16px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            {soundOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Keyboard shortcuts */}
        <div style={{
          padding: '12px 0',
        }}>
          <div style={{
            color: 'var(--text-primary)',
            fontSize: '13px',
            marginBottom: '8px',
          }}>
            Keyboard Shortcuts
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '4px 12px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--accent-cyan)' }}>Ctrl+K</span>
            <span style={{ color: 'var(--text-secondary)' }}>Search messages</span>
            <span style={{ color: 'var(--accent-cyan)' }}>Esc</span>
            <span style={{ color: 'var(--text-secondary)' }}>Close / Cancel</span>
            <span style={{ color: 'var(--accent-cyan)' }}>Enter</span>
            <span style={{ color: 'var(--text-secondary)' }}>Send message</span>
            <span style={{ color: 'var(--accent-cyan)' }}>Shift+Enter</span>
            <span style={{ color: 'var(--text-secondary)' }}>New line</span>
          </div>
        </div>

        {/* About */}
        <div style={{
          padding: '12px 0',
          borderTop: '1px solid var(--accent-cyan-border)',
          color: 'var(--text-secondary)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '1px',
          textAlign: 'center',
        }}>
          SECRETUM v1.0.0<br />
          SM4 + Ed25519 ENCRYPTED
        </div>
      </div>
    </div>
  );
};
