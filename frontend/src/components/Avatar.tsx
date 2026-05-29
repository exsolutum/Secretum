// Deterministic avatar generation from UID
// Creates a unique SVG avatar based on the user's UID hash

const AVATAR_COLORS = [
  '#00F0FF', '#FF6B35', '#2ED573', '#FFA502', '#FF4757',
  '#7B68EE', '#00CED1', '#FF69B4', '#32CD32', '#FFD700',
  '#8A2BE2', '#00FA9A', '#DC143C', '#4169E1', '#FF8C00',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarColor(uid: string): string {
  const hash = hashString(uid);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitials(nickname: string): string {
  if (!nickname) return '?';
  const parts = nickname.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nickname.substring(0, 2).toUpperCase();
}

export function generateAvatarSvg(uid: string, nickname: string, size: number = 32): string {
  const color = getAvatarColor(uid);
  const initials = getInitials(nickname);
  const fontSize = Math.max(size * 0.4, 10);

  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="${color}" opacity="0.2"/>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
      <text x="${size / 2}" y="${size / 2}" dy="0.35em" text-anchor="middle"
            font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}">
        ${initials}
      </text>
    </svg>
  `)}`;
}

export function Avatar({ uid, nickname, size = 32 }: { uid: string; nickname: string; size?: number }) {
  const src = generateAvatarSvg(uid, nickname, size);
  return (
    <img
      src={src}
      alt={nickname}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.15,
        flexShrink: 0,
      }}
    />
  );
}

import React from 'react';
