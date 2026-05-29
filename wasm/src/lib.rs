use wasm_bindgen::prelude::*;
use ed25519_dalek::{SigningKey, Signer, Verifier, VerifyingKey, Signature};
use sha2::{Digest, Sha256};
use hmac::{Hmac, Mac};
use pbkdf2::pbkdf2_hmac;

type HmacSha256 = Hmac<Sha256>;

/// SM4 block cipher implementation
/// SM4 is a Chinese national standard block cipher (GB/T 32907-2016)
const SM4_SBOX: [u8; 256] = [
    0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
    0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
    0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
    0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
    0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
    0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
    0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
    0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
    0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
    0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
    0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
    0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
    0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
    0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
    0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
    0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48,
];

const SM4_CK: [u32; 32] = [
    0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269,
    0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
    0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249,
    0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
    0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229,
    0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
    0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209,
    0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279,
];

const SM4_FK: [u32; 4] = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];

fn sm4_rotl32(x: u32, n: u32) -> u32 {
    (x << n) | (x >> (32 - n))
}

fn sm4_sbox_lookup(x: u32) -> u32 {
    let b0 = SM4_SBOX[((x >> 24) & 0xff) as usize] as u32;
    let b1 = SM4_SBOX[((x >> 16) & 0xff) as usize] as u32;
    let b2 = SM4_SBOX[((x >> 8) & 0xff) as usize] as u32;
    let b3 = SM4_SBOX[(x & 0xff) as usize] as u32;
    (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
}

fn sm4_tau(x: u32) -> u32 {
    let s = sm4_sbox_lookup(x);
    s ^ sm4_rotl32(s, 2) ^ sm4_rotl32(s, 10) ^ sm4_rotl32(s, 18) ^ sm4_rotl32(s, 24)
}

fn sm4_t_prime(x: u32) -> u32 {
    let s = sm4_sbox_lookup(x);
    s ^ sm4_rotl32(s, 13) ^ sm4_rotl32(s, 23)
}

fn sm4_key_expand(key: &[u8; 16]) -> [u32; 32] {
    let mk0 = u32::from_be_bytes([key[0], key[1], key[2], key[3]]);
    let mk1 = u32::from_be_bytes([key[4], key[5], key[6], key[7]]);
    let mk2 = u32::from_be_bytes([key[8], key[9], key[10], key[11]]);
    let mk3 = u32::from_be_bytes([key[12], key[13], key[14], key[15]]);

    let mut k = [0u32; 36];
    k[0] = mk0 ^ SM4_FK[0];
    k[1] = mk1 ^ SM4_FK[1];
    k[2] = mk2 ^ SM4_FK[2];
    k[3] = mk3 ^ SM4_FK[3];

    let mut rk = [0u32; 32];
    for i in 0..32 {
        k[i + 4] = k[i] ^ sm4_t_prime(k[i + 1] ^ k[i + 2] ^ k[i + 3] ^ SM4_CK[i]);
        rk[i] = k[i + 4];
    }
    rk
}

fn sm4_encrypt_block(block: &[u8; 16], rk: &[u32; 32]) -> [u8; 16] {
    let mut x = [0u32; 36];
    x[0] = u32::from_be_bytes([block[0], block[1], block[2], block[3]]);
    x[1] = u32::from_be_bytes([block[4], block[5], block[6], block[7]]);
    x[2] = u32::from_be_bytes([block[8], block[9], block[10], block[11]]);
    x[3] = u32::from_be_bytes([block[12], block[13], block[14], block[15]]);

    for i in 0..32 {
        x[i + 4] = x[i] ^ sm4_tau(x[i + 1] ^ x[i + 2] ^ x[i + 3] ^ rk[i]);
    }

    let mut out = [0u8; 16];
    let y0 = x[35];
    let y1 = x[34];
    let y2 = x[33];
    let y3 = x[32];
    out[0..4].copy_from_slice(&y0.to_be_bytes());
    out[4..8].copy_from_slice(&y1.to_be_bytes());
    out[8..12].copy_from_slice(&y2.to_be_bytes());
    out[12..16].copy_from_slice(&y3.to_be_bytes());
    out
}

fn sm4_decrypt_block(block: &[u8; 16], rk: &[u32; 32]) -> [u8; 16] {
    let mut rev_rk = [0u32; 32];
    for i in 0..32 {
        rev_rk[i] = rk[31 - i];
    }
    sm4_encrypt_block(block, &rev_rk)
}

/// PKCS7 padding
fn pkcs7_pad(data: &[u8]) -> Vec<u8> {
    let block_size = 16;
    let padding_len = block_size - (data.len() % block_size);
    let mut padded = data.to_vec();
    padded.extend(vec![padding_len as u8; padding_len]);
    padded
}

/// PKCS7 unpadding
fn pkcs7_unpad(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.is_empty() {
        return Err("Empty data".to_string());
    }
    let padding_len = *data.last().unwrap() as usize;
    if padding_len == 0 || padding_len > 16 || padding_len > data.len() {
        return Err("Invalid padding".to_string());
    }
    for &b in &data[data.len() - padding_len..] {
        if b as usize != padding_len {
            return Err("Invalid padding".to_string());
        }
    }
    Ok(data[..data.len() - padding_len].to_vec())
}

/// XOR two byte slices
fn xor_bytes(a: &[u8], b: &[u8]) -> Vec<u8> {
    a.iter().zip(b.iter()).map(|(&x, &y)| x ^ y).collect()
}

/// SM4-CBC encrypt
#[wasm_bindgen]
pub fn sm4_encrypt(plaintext_hex: &str, key_hex: &str, iv_hex: &str) -> Result<String, JsValue> {
    let plaintext = hex::decode(plaintext_hex).map_err(|e| JsValue::from_str(&format!("Invalid plaintext hex: {}", e)))?;
    let key_bytes = hex::decode(key_hex).map_err(|e| JsValue::from_str(&format!("Invalid key hex: {}", e)))?;
    let iv = hex::decode(iv_hex).map_err(|e| JsValue::from_str(&format!("Invalid IV hex: {}", e)))?;

    if key_bytes.len() != 16 {
        return Err(JsValue::from_str("Key must be 16 bytes"));
    }
    if iv.len() != 16 {
        return Err(JsValue::from_str("IV must be 16 bytes"));
    }

    let key: [u8; 16] = key_bytes.try_into().unwrap();
    let rk = sm4_key_expand(&key);
    let padded = pkcs7_pad(&plaintext);

    let mut ciphertext = Vec::new();
    let mut prev_block = iv;

    for chunk in padded.chunks(16) {
        let mut block = [0u8; 16];
        block[..chunk.len()].copy_from_slice(chunk);
        let xored = xor_bytes(&block, &prev_block);
        let encrypted = sm4_encrypt_block(&xored.try_into().unwrap(), &rk);
        ciphertext.extend_from_slice(&encrypted);
        prev_block = encrypted.to_vec();
    }

    Ok(hex::encode(ciphertext))
}

/// SM4-CBC decrypt
#[wasm_bindgen]
pub fn sm4_decrypt(ciphertext_hex: &str, key_hex: &str, iv_hex: &str) -> Result<String, JsValue> {
    let ciphertext = hex::decode(ciphertext_hex).map_err(|e| JsValue::from_str(&format!("Invalid ciphertext hex: {}", e)))?;
    let key_bytes = hex::decode(key_hex).map_err(|e| JsValue::from_str(&format!("Invalid key hex: {}", e)))?;
    let iv = hex::decode(iv_hex).map_err(|e| JsValue::from_str(&format!("Invalid IV hex: {}", e)))?;

    if key_bytes.len() != 16 {
        return Err(JsValue::from_str("Key must be 16 bytes"));
    }
    if iv.len() != 16 {
        return Err(JsValue::from_str("IV must be 16 bytes"));
    }
    if ciphertext.len() % 16 != 0 {
        return Err(JsValue::from_str("Ciphertext must be multiple of 16 bytes"));
    }

    let key: [u8; 16] = key_bytes.try_into().unwrap();
    let rk = sm4_key_expand(&key);

    let mut plaintext = Vec::new();
    let mut prev_block = iv;

    for chunk in ciphertext.chunks(16) {
        let block: [u8; 16] = chunk.try_into().unwrap();
        let decrypted = sm4_decrypt_block(&block, &rk);
        let xored = xor_bytes(&decrypted, &prev_block);
        plaintext.extend_from_slice(&xored);
        prev_block = chunk.to_vec();
    }

    let unpadded = pkcs7_unpad(&plaintext).map_err(|e| JsValue::from_str(&e))?;
    Ok(hex::encode(unpadded))
}

/// Generate Ed25519 keypair, returns [private_key_hex, public_key_hex]
#[wasm_bindgen]
pub fn generate_keypair() -> Result<JsValue, JsValue> {
    let mut secret_bytes = [0u8; 32];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut secret_bytes);
    let signing_key = SigningKey::from_bytes(&secret_bytes);
    let verifying_key = signing_key.verifying_key();

    let private_hex = hex::encode(signing_key.to_bytes());
    let public_hex = hex::encode(verifying_key.to_bytes());

    let result = js_sys::Array::new();
    result.push(&JsValue::from_str(&private_hex));
    result.push(&JsValue::from_str(&public_hex));
    Ok(result.into())
}

/// Sign a message with Ed25519 private key
#[wasm_bindgen]
pub fn sign(message_hex: &str, private_key_hex: &str) -> Result<String, JsValue> {
    let message = hex::decode(message_hex).map_err(|e| JsValue::from_str(&format!("Invalid message hex: {}", e)))?;
    let pk_bytes = hex::decode(private_key_hex).map_err(|e| JsValue::from_str(&format!("Invalid private key hex: {}", e)))?;

    let signing_key = SigningKey::from_bytes(&pk_bytes[..32].try_into().map_err(|_| JsValue::from_str("Invalid key length"))?);
    let signature = signing_key.sign(&message);

    Ok(hex::encode(signature.to_bytes()))
}

/// Verify an Ed25519 signature
#[wasm_bindgen]
pub fn verify(message_hex: &str, signature_hex: &str, public_key_hex: &str) -> Result<bool, JsValue> {
    let message = hex::decode(message_hex).map_err(|e| JsValue::from_str(&format!("Invalid message hex: {}", e)))?;
    let sig_bytes = hex::decode(signature_hex).map_err(|e| JsValue::from_str(&format!("Invalid signature hex: {}", e)))?;
    let pk_bytes = hex::decode(public_key_hex).map_err(|e| JsValue::from_str(&format!("Invalid public key hex: {}", e)))?;

    let verifying_key = VerifyingKey::from_bytes(&pk_bytes[..32].try_into().map_err(|_| JsValue::from_str("Invalid key length"))?)
        .map_err(|_| JsValue::from_str("Invalid public key"))?;
    let signature = Signature::from_slice(&sig_bytes)
        .map_err(|_| JsValue::from_str("Invalid signature"))?;

    Ok(verifying_key.verify(&message, &signature).is_ok())
}

/// Derive a 16-byte key from room secret and salt using PBKDF2-HMAC-SHA256
#[wasm_bindgen]
pub fn derive_key(room_secret: &str, salt_hex: &str) -> Result<String, JsValue> {
    let salt = hex::decode(salt_hex).map_err(|e| JsValue::from_str(&format!("Invalid salt hex: {}", e)))?;

    let mut key = [0u8; 16];
    pbkdf2_hmac::<Sha256>(room_secret.as_bytes(), &salt, 100_000, &mut key);

    Ok(hex::encode(key))
}

/// Generate random bytes
#[wasm_bindgen]
pub fn random_bytes(len: usize) -> String {
    let mut buf = vec![0u8; len];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

/// Compute SHA-256 hash
#[wasm_bindgen]
pub fn sha256(data_hex: &str) -> Result<String, JsValue> {
    let data = hex::decode(data_hex).map_err(|e| JsValue::from_str(&format!("Invalid hex: {}", e)))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

/// Compute HMAC-SHA256
#[wasm_bindgen]
pub fn hmac_sha256(key_hex: &str, data_hex: &str) -> Result<String, JsValue> {
    let key = hex::decode(key_hex).map_err(|e| JsValue::from_str(&format!("Invalid key hex: {}", e)))?;
    let data = hex::decode(data_hex).map_err(|e| JsValue::from_str(&format!("Invalid data hex: {}", e)))?;

    let mut mac = HmacSha256::new_from_slice(&key)
        .map_err(|e| JsValue::from_str(&format!("HMAC error: {}", e)))?;
    mac.update(&data);
    let result = mac.finalize().into_bytes();

    Ok(hex::encode(result))
}

/// Text to hex encoding helper
#[wasm_bindgen]
pub fn text_to_hex(text: &str) -> String {
    hex::encode(text.as_bytes())
}

/// Hex to text decoding helper
#[wasm_bindgen]
pub fn hex_to_text(hex_str: &str) -> Result<String, JsValue> {
    let bytes = hex::decode(hex_str).map_err(|e| JsValue::from_str(&format!("Invalid hex: {}", e)))?;
    String::from_utf8(bytes).map_err(|e| JsValue::from_str(&format!("Invalid UTF-8: {}", e)))
}
