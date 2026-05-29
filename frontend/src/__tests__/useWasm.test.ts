import { describe, it, expect } from 'vitest';
import { createJsFallback } from '../hooks/useWasm';

describe('WASM JS Fallback', () => {
  it('generates keypair', () => {
    const wasm = createJsFallback();
    const keypair = wasm.generate_keypair();
    expect(keypair.private_key).toBeDefined();
    expect(keypair.public_key).toBeDefined();
    expect(keypair.private_key).not.toBe(keypair.public_key);
  });

  it('converts text to hex and back', () => {
    const wasm = createJsFallback();
    const text = 'Hello, Secretum!';
    const hex = wasm.text_to_hex(text);
    const decoded = wasm.hex_to_text(hex);
    expect(decoded).toBe(text);
  });

  it('generates random bytes', () => {
    const wasm = createJsFallback();
    const r1 = wasm.random_bytes(32);
    const r2 = wasm.random_bytes(32);
    expect(r1).not.toBe(r2);
    expect(r1.length).toBe(64);
  });

  it('computes consistent SHA-256', () => {
    const wasm = createJsFallback();
    const h1 = wasm.sha256('test');
    const h2 = wasm.sha256('test');
    expect(h1).toBe(h2);
  });

  it('computes consistent UID', () => {
    const wasm = createJsFallback();
    const uid1 = wasm.compute_uid('test_public_key');
    const uid2 = wasm.compute_uid('test_public_key');
    expect(uid1).toBe(uid2);
  });
});
