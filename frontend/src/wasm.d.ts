/// <reference types="vite/client" />

declare module '../../wasm/pkg/secretum_wasm' {
  export function generate_keypair(): Array<string>;
  export function sign(private_key_hex: string, message_hex: string): string;
  export function verify(public_key_hex: string, message_hex: string, signature_hex: string): boolean;
  export function derive_key(password: string, salt_hex: string, iterations: number): string;
  export function sm4_encrypt(key_hex: string, plaintext_hex: string, iv_hex: string): string;
  export function sm4_decrypt(key_hex: string, ciphertext_hex: string, iv_hex: string): string;
  export function random_bytes(len: number): string;
  export function sha256(data_hex: string): string;
  export function hmac_sha256(key_hex: string, data_hex: string): string;
  export function text_to_hex(text: string): string;
  export function hex_to_text(hex_str: string): string;
  export function compute_uid(public_key_hex: string): string;
  const _default: () => Promise<void>;
  export default _default;
}
