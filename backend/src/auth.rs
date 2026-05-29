use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;

/// User identity derived from Ed25519 public key
#[derive(Debug, Clone)]
pub struct UserIdentity {
    pub uid: String,
    pub public_key: String,
    pub nickname: String,
    pub authenticated: bool,
}

impl UserIdentity {
    /// Create a new user identity from a public key hex string
    pub fn from_public_key(public_key_hex: &str) -> Self {
        let uid = Self::compute_uid(public_key_hex);
        Self {
            uid,
            public_key: public_key_hex.to_string(),
            nickname: String::new(),
            authenticated: false,
        }
    }

    /// Compute UID as SHA-256 hash of public key bytes
    pub fn compute_uid(public_key_hex: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(public_key_hex.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }

    /// Verify an Ed25519 signature for a given message
    pub fn verify_signature(
        public_key_hex: &str,
        message: &[u8],
        signature_hex: &str,
    ) -> bool {
        let pk_bytes = match hex::decode(public_key_hex) {
            Ok(b) => b,
            Err(_) => return false,
        };
        if pk_bytes.len() < 32 {
            return false;
        }
        let verifying_key = match VerifyingKey::from_bytes(&pk_bytes[..32].try_into().unwrap_or([0u8; 32])) {
            Ok(vk) => vk,
            Err(_) => return false,
        };
        let sig_bytes = match hex::decode(signature_hex) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let signature = match Signature::from_slice(&sig_bytes) {
            Ok(s) => s,
            Err(_) => return false,
        };
        verifying_key.verify(message, &signature).is_ok()
    }
}

/// Anti-replay signature cache
#[derive(Debug, Default)]
pub struct SignatureCache {
    seen: HashSet<String>,
}

impl SignatureCache {
    pub fn new() -> Self {
        Self {
            seen: HashSet::new(),
        }
    }

    /// Check if a signature has been seen before, and add it if not
    pub fn check_and_add(&mut self, signature: &str) -> bool {
        self.seen.insert(signature.to_string())
    }

    /// Clean old entries
    pub fn clear(&mut self) {
        self.seen.clear();
    }
}

/// Shared authentication state
pub type SharedAuthState = Arc<RwLock<AuthState>>;

#[derive(Debug)]
pub struct AuthState {
    pub signature_cache: SignatureCache,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            signature_cache: SignatureCache::new(),
        }
    }

    pub fn shared() -> SharedAuthState {
        Arc::new(RwLock::new(Self::new()))
    }
}
