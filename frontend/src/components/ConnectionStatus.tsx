import React from 'react';
import { ConnectionState } from '../hooks/useChat';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempt?: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ state, reconnectAttempt }) => {
  const getStatusInfo = () => {
    switch (state) {
      case 'connected':
        return { color: 'var(--success)', label: 'CONNECTED', icon: '◉' };
      case 'connecting':
        return { color: 'var(--warning)', label: 'CONNECTING', icon: '◎' };
      case 'reconnecting':
        return { color: 'var(--warning)', label: `RECONNECTING${reconnectAttempt ? ` (${reconnectAttempt}/5)` : ''}`, icon: '◎' };
      case 'error':
        return { color: 'var(--danger)', label: 'ERROR', icon: '✕' };
      case 'disconnected':
      default:
        return { color: 'var(--text-secondary)', label: 'OFFLINE', icon: '○' };
    }
  };

  const { color, label, icon } = getStatusInfo();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '10px',
      fontFamily: 'var(--font-mono)',
      color,
      letterSpacing: '1px',
    }}>
      <span style={{
        fontSize: '8px',
        animation: state === 'connecting' || state === 'reconnecting' ? 'pulse 2s infinite' : 'none',
      }}>
        {icon}
      </span>
      {label}
    </div>
  );
};
