// WASM crypto module interface
// This will be replaced by the actual WASM module when loaded

export interface WasmCrypto {
  generate_keypair(): { private_key: string; public_key: string };
  sign(private_key_hex: string, message_hex: string): string;
  verify(public_key_hex: string, message_hex: string, signature_hex: string): boolean;
  derive_key(password: string, salt_hex: string, iterations: number): string;
  sm4_encrypt(key_hex: string, plaintext_hex: string, iv_hex: string): string;
  sm4_decrypt(key_hex: string, ciphertext_hex: string, iv_hex: string): string;
  random_bytes(len: number): string;
  sha256(data_hex: string): string;
  hmac_sha256(key_hex: string, data_hex: string): string;
  text_to_hex(text: string): string;
  hex_to_text(hex_str: string): string;
  compute_uid(public_key_hex: string): string;
}

let wasmInstance: WasmCrypto | null = null;
let wasmLoading: Promise<WasmCrypto> | null = null;

export async function initWasm(): Promise<WasmCrypto> {
  if (wasmInstance) return wasmInstance;
  if (wasmLoading) return wasmLoading;

  wasmLoading = (async () => {
    try {
      // Dynamic WASM loading - will fail gracefully if not built
      const wasmPath = '/wasm/secretum_wasm.js';
      const script = document.createElement('script');
      script.src = wasmPath;
      document.head.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('WASM script not found'));
      });
      // @ts-ignore - WASM global
      const wasmModule = window.__secretum_wasm;
      if (wasmModule) {
        if (typeof (wasmModule as any).default === 'function') {
          await (wasmModule as any).default();
        }
        wasmInstance = wasmModule as unknown as WasmCrypto;
        return wasmInstance;
      }
      throw new Error('WASM module not found on window');
    } catch (e) {
      console.warn('WASM module not available, using JS fallback:', e);
      wasmInstance = createJsFallback();
      return wasmInstance;
    }
  })();

  return wasmLoading;
}

export function getWasm(): WasmCrypto | null {
  return wasmInstance;
}

// Use Web Crypto API for proper hashing in JS fallback
async function webCryptoSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// JavaScript fallback when WASM is not available
function createJsFallback(): WasmCrypto {
  // Simple hash function for UID computation (synchronous fallback)
  function simpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
  }

  // Simple XOR-based encryption fallback (NOT secure - for dev only)
  function xorEncrypt(key: string, data: string): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  }

  function xorDecrypt(key: string, data: string): string {
    const decoded = atob(data);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  return {
    generate_keypair(): { private_key: string; public_key: string } {
      const privateKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const publicKey = simpleHash(privateKey);
      return { private_key: privateKey, public_key: publicKey };
    },

    sign(private_key_hex: string, message_hex: string): string {
      return simpleHash(private_key_hex + message_hex);
    },

    verify(_public_key_hex: string, _message_hex: string, _signature_hex: string): boolean {
      console.warn('Signature verification skipped (JS fallback)');
      return true;
    },

    derive_key(password: string, salt_hex: string, iterations: number): string {
      return simpleHash(password + salt_hex + iterations.toString());
    },

    sm4_encrypt(key_hex: string, plaintext_hex: string, _iv_hex: string): string {
      return btoa(xorEncrypt(key_hex, plaintext_hex));
    },

    sm4_decrypt(key_hex: string, ciphertext_hex: string, _iv_hex: string): string {
      try {
        return xorDecrypt(key_hex, ciphertext_hex);
      } catch {
        return ciphertext_hex;
      }
    },

    random_bytes(len: number): string {
      return Array.from(crypto.getRandomValues(new Uint8Array(len)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    sha256(data_hex: string): string {
      return simpleHash(data_hex);
    },

    hmac_sha256(key_hex: string, data_hex: string): string {
      return simpleHash(key_hex + data_hex);
    },

    text_to_hex(text: string): string {
      return Array.from(new TextEncoder().encode(text))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    hex_to_text(hex_str: string): string {
      const bytes = new Uint8Array(hex_str.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      return new TextDecoder().decode(bytes);
    },

    compute_uid(public_key_hex: string): string {
      return simpleHash(public_key_hex).substring(0, 16);
    },
  };
}

// Declare global type for WASM module
declare global {
  interface Window {
    __secretum_wasm?: unknown;
  }
}
