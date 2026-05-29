import { initWasm, getWasm, WasmCrypto } from './useWasm';

// Safe wasm helper - returns null if wasm not loaded
function safeWasm(): WasmCrypto | null {
  try { return getWasm(); } catch { return null; }
}

// ============ Web Crypto API fallback (proper encryption, Chinese-friendly) ============

async function webCryptoEncrypt(plaintext: string, roomSecret: string, roomId: string): Promise<{ encrypted: string; iv: string }> {
  // Derive key from room secret using PBKDF2
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('secretum-' + roomId);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function webCryptoDecrypt(encryptedB64: string, ivB64: string, roomSecret: string, roomId: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('secretum-' + roomId);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

// ============ Unified encrypt/decrypt API ============

export async function encryptMessage(plaintext: string, roomSecret: string, roomId: string): Promise<{ encrypted: string; iv: string }> {
  const wasm = safeWasm();
  if (wasm) {
    try {
      const iv = wasm.random_bytes(16);
      const key = wasm.derive_key(roomSecret, roomId, 100000);
      const contentHex = wasm.text_to_hex(plaintext);
      const encrypted = wasm.sm4_encrypt(key, contentHex, iv);
      return { encrypted, iv };
    } catch (e) {
      console.warn('WASM encrypt failed, using Web Crypto fallback:', e);
    }
  }
  // Fallback to Web Crypto API (AES-GCM, proper encryption)
  return webCryptoEncrypt(plaintext, roomSecret, roomId);
}

export async function decryptMessage(encrypted: string, iv: string, roomSecret: string, roomId: string): Promise<string> {
  const wasm = safeWasm();
  if (wasm) {
    try {
      const key = wasm.derive_key(roomSecret, roomId, 100000);
      const decrypted = wasm.sm4_decrypt(key, encrypted, iv);
      return wasm.hex_to_text(decrypted);
    } catch (e) {
      console.warn('WASM decrypt failed, trying Web Crypto fallback:', e);
    }
  }
  // Fallback to Web Crypto API
  return webCryptoDecrypt(encrypted, iv, roomSecret, roomId);
}

// Re-export from useWasm
export { initWasm, getWasm, safeWasm };
export type { WasmCrypto as WasmCryptoType };
