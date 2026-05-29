use wasm_bindgen_test::*;
use secretum_wasm::*;

#[wasm_bindgen_test]
fn test_sm4_roundtrip() {
    let key = "0123456789abcdef0123456789abcdef";
    let iv = "abcdef0123456789abcdef0123456789";
    let plaintext = "48656c6c6f20576f726c64";

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

    let invalid = verify(&public_key, "deadbeef", &signature).unwrap();
    assert!(!invalid);
}

#[wasm_bindgen_test]
fn test_sha256() {
    let result = sha256("48656c6c6f").unwrap();
    assert!(!result.is_empty());
    assert_eq!(result.len(), 64);
}

#[wasm_bindgen_test]
fn test_random_bytes() {
    let r1 = random_bytes(32);
    let r2 = random_bytes(32);
    assert_ne!(r1, r2);
    assert_eq!(r1.len(), 64);
}

#[wasm_bindgen_test]
fn test_text_hex_roundtrip() {
    let text = "Hello, Secretum!";
    let hex = text_to_hex(text);
    let decoded = hex_to_text(&hex).unwrap();
    assert_eq!(text, decoded);
}
