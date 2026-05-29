import React, { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onDismiss }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '360px',
    }}>
      {notifications.map(n => (
        <div
          key={n.id}
          className="fade-in"
          style={{
            padding: '12px 16px',
            background: n.type === 'error' ? 'rgba(255, 71, 87, 0.15)' :
              n.type === 'success' ? 'rgba(46, 213, 115, 0.15)' :
              n.type === 'warning' ? 'rgba(255, 165, 2, 0.15)' :
              'var(--bg-panel)',
            border: `1px solid ${
              n.type === 'error' ? 'rgba(255, 71, 87, 0.4)' :
              n.type === 'success' ? 'rgba(46, 213, 115, 0.4)' :
              n.type === 'warning' ? 'rgba(255, 165, 2, 0.4)' :
              'var(--accent-cyan-border)'
            }`,
            borderRadius: 'var(--radius)',
            color: n.type === 'error' ? 'var(--danger)' :
              n.type === 'success' ? 'var(--success)' :
              n.type === 'warning' ? 'var(--warning)' :
              'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
          }}
          onClick={() => onDismiss(n.id)}
        >
          <span>{n.message}</span>
          <span style={{ opacity: 0.5, fontSize: '10px' }}>✕</span>
        </div>
      ))}
    </div>
  );
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((type: Notification['type'], message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    setNotifications(prev => [...prev, { id, type, message, timestamp: Date.now() }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, addNotification, dismissNotification };
}
