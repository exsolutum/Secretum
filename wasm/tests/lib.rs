use wasm_bindgen_test::*;
use secretum_wasm::*;

#[wasm_bindgen_test]
fn test_sm4_roundtrip() {
    let key = "0123456789abcdef0123456789abcdef"; // 32 hex = 16 bytes
    let iv = "abcdef0123456789abcdef0123456789";   // 32 hex = 16 bytes
    let plaintext = "48656c6c6f20576f726c64";       // "Hello World" in hex

    let encrypted = sm4_encrypt(key, plaintext, iv).unwrap();
    let decrypted = sm4_decrypt(key, &encrypted, iv).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[wasm_bindgen_test]
fn test_ed25519_sign_verify() {
    let keypair = generate_keypair().unwrap();
    let keypair_array = js_sys::Array::from(&keypair);
    let private_key = keypair_array.get(0).as_string().unwrap();
    let public_key = keypair_array.get(1).as_string().unwrap();

    let message = "48656c6c6f";
    let signature = sign(&private_key, message).unwrap();
    let valid = verify(&public_key, message, &signature).unwrap();
    assert!(valid);

    // Wrong message should fail
    let invalid = verify(&public_key, "deadbeef", &signature).unwrap();
    assert!(!invalid);
}

#[wasm_bindgen_test]
fn test_sha256() {
    let result = sha256("48656c6c6f").unwrap();
    assert!(!result.is_empty());
    assert_eq!(result.len(), 64); // SHA-256 produces 64 hex chars
}

#[wasm_bindgen_test]
fn test_hmac_sha256() {
    let key = "0123456789abcdef";
    let data = "48656c6c6f";
    let result = hmac_sha256(key, data).unwrap();
    assert!(!result.is_empty());
    assert_eq!(result.len(), 64);
}

#[wasm_bindgen_test]
fn test_derive_key() {
    let password = "my_room_secret";
    let salt = "0123456789abcdef0123456789abcdef";
    let key1 = derive_key(password, salt, 100_000).unwrap();
    let key2 = derive_key(password, salt, 100_000).unwrap();
    assert_eq!(key1, key2); // Same inputs produce same key

    // Different password produces different key
    let key3 = derive_key("wrong_password", salt, 100_000).unwrap();
    assert_ne!(key1, key3);
}

#[wasm_bindgen_test]
fn test_random_bytes() {
    let r1 = random_bytes(32);
    let r2 = random_bytes(32);
    assert_ne!(r1, r2); // Extremely unlikely to be equal
    assert_eq!(r1.len(), 64); // 32 bytes = 64 hex chars
}

#[wasm_bindgen_test]
fn test_text_hex_roundtrip() {
    let text = "Hello, Secretum! 你好世界";
    let hex = text_to_hex(text);
    let decoded = hex_to_text(&hex).unwrap();
    assert_eq!(text, decoded);
}

#[wasm_bindgen_test]
fn test_compute_uid() {
    let pk = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    let uid1 = compute_uid(pk).unwrap();
    let uid2 = compute_uid(pk).unwrap();
    assert_eq!(uid1, uid2); // Same input produces same UID
    assert!(!uid1.is_empty());
}
