use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub bind_address: String,
    pub port: u16,
    pub static_files_embedded: bool,
    pub persistence_enabled: bool,
    pub db_path: String,
    pub db_encryption_key: String,
    pub log_level: String,
    pub max_connections: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            port: 3000,
            static_files_embedded: true,
            persistence_enabled: false,
            db_path: "secretum.db".to_string(),
            db_encryption_key: String::new(),
            log_level: "info".to_string(),
            max_connections: 100,
        }
    }
}

impl Config {
    /// Load config from secretum.toml, or create default with example file
    pub fn load() -> Self {
        let config_path = "secretum.toml";
        if Path::new(config_path).exists() {
            match fs::read_to_string(config_path) {
                Ok(content) => match toml::from_str(&content) {
                    Ok(config) => return config,
                    Err(e) => {
                        tracing::warn!("Failed to parse config: {}, using defaults", e);
                    }
                },
                Err(e) => {
                    tracing::warn!("Failed to read config: {}, using defaults", e);
                }
            }
        }
        // Generate example config file
        let default = Self::default();
        let example = include_str!("../../config/secretum.example.toml");
        if let Err(e) = fs::write(config_path, example) {
            tracing::warn!("Failed to write example config: {}", e);
        } else {
            tracing::info!("Generated example config at {}", config_path);
        }
        default
    }

    /// Get the full bind address string
    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.bind_address, self.port)
    }
}
