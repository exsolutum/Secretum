# SECRETUM

**Self-hosted, end-to-end encrypted, IPv6-ready private chat room.**

> 这是一个秘密 👿

---

## Features

- **End-to-end encryption** — SM4 (GB/T 32907-2016) + Ed25519, WASM-accelerated
- **Zero knowledge** — Server never sees plaintext; all crypto runs in the browser
- **Self-hosted** — Single binary, zero external dependencies
- **Room-based** — Create or join rooms with a shared secret
- **Admin controls** — Kick, ban, unban, lock/unlock, destroy, transfer admin
- **Mainstream chat features**:
  - Typing indicators
  - Read receipts
  - Message replies (threaded)
  - Emoji reactions with picker
  - File sharing (encrypted, drag & drop)
  - Message search (Ctrl+K)
  - Online presence indicators
  - Keyboard shortcuts (Ctrl+K search, Esc dismiss)
  - Drag & drop file upload
  - Notification system
  - Context menus
  - Auto-destroy empty rooms
- **Holographic glass UI** — Precision instrument aesthetic, no Material Design
- **Anti-replay** — Ed25519 signature cache prevents message replay attacks
- **Configurable** — Single `secretum.toml`, auto-creates from embedded defaults
- **Embedded frontend** — React + Vite + WASM compiled into the binary

## Quick Start

### Build from Source

```bash
# Prerequisites
cargo install wasm-pack

# Clone
git clone https://github.com/exsolutum/Secretum.git
cd Secretum

# Build WASM crypto core
wasm-pack build wasm --target web --out-dir pkg

# Build frontend
cd frontend && npm install && npm run build && cd ..

# Build backend (includes embedded frontend)
cargo build --release

# Run
./target/release/secretum
```

### Docker

```bash
docker compose up -d
```

Or build manually:

```bash
docker build -t secretum .
docker run -p 3000:3000 -v ./secretum.toml:/app/secretum.toml secretum
```

### Termux (Android)

**方式一：直接下载预编译二进制（推荐）**

```bash
# 下载 aarch64 静态链接二进制（适用于绝大多数 Android 设备）
wget https://github.com/exsolutum/Secretum/releases/download/v1.0.0/secretum-v1.0.0-aarch64-linux-musl

# 赋予执行权限
chmod +x secretum-v1.0.0-aarch64-linux-musl

# 直接运行（无需安装任何依赖！）
./secretum-v1.0.0-aarch64-linux-musl

# 在手机浏览器打开 http://127.0.0.1:3000
```

> 该二进制为 **静态链接** (musl libc)，不依赖 Android 系统库，可直接在 Termux 中运行。

**方式二：从源码编译**

```bash
# Install dependencies
pkg install rust nodejs

# Install wasm-pack
cargo install wasm-pack

# Clone and build
git clone https://github.com/exsolutum/Secretum.git
cd Secretum

# Build WASM
wasm-pack build wasm --target web --out-dir pkg

# Build frontend
cd frontend && npm install && npm run build && cd ..

# Build and run
cargo run --release
```

### Dynamic DNS with Caddy

For IPv6 access from outside your local network:

```bash
# Install Caddy
# Configure Caddyfile:
your-domain.duckdns.org {
    reverse_proxy localhost:3000
}

# Set up DuckDNS
echo "https://www.duckdns.org/update?domains=your-domain&token=your-token&ip=" | curl -k -L -
```

## Configuration

On first run, `secretum.toml` is auto-generated with defaults:

```toml
bind_address = "127.0.0.1"
port = 3000
static_files_embedded = true
persistence_enabled = false
db_path = "secretum.db"
db_encryption_key = ""
log_level = "info"
max_connections = 100
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  ┌─────────┐  ┌──────────────────────────┐  │
│  │  React   │  │   WASM Crypto Core       │  │
│  │  + Vite  │  │   SM4 + Ed25519 + PBKDF2 │  │
│  └────┬─────┘  └────────────┬─────────────┘  │
│       └──────────┬──────────┘                 │
│            WebSocket (encrypted)               │
└──────────────────┬────────────────────────────┘
                   │
┌──────────────────┴────────────────────────────┐
│              Rust + Axum Server                │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Auth    │ │  Rooms   │ │  Persistence  │  │
│  │  Ed25519 │ │  Argon2  │ │  (optional)   │  │
│  └──────────┘ └──────────┘ └───────────────┘  │
└───────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust + Axum 0.7 |
| Crypto (WASM) | SM4 + Ed25519 + PBKDF2 + Argon2id |
| Frontend | React 18 + TypeScript + Vite |
| Type Bridge | ts-rs (Rust → TypeScript auto-generation) |
| Persistence | Encrypted SQLite (optional, feature flag) |
| Config | TOML with embedded defaults |
| Deployment | Single binary with rust-embed |

## Security Model

1. **Key Generation**: Ed25519 keypair generated in-browser via WASM
2. **Room Secret**: Argon2id-hashed on server, never stored plaintext
3. **Message Encryption**: SM4-128-CBC with per-message random IV
4. **Key Derivation**: PBKDF2-SHA256 derives SM4 key from room secret
5. **Anti-Replay**: Ed25519 signature cache prevents replay attacks
6. **Zero Knowledge**: Server only sees encrypted blobs; plaintext never leaves the browser

## Testing

```bash
# Backend tests
cargo test -p secretum

# Frontend tests
cd frontend && npm test

# WASM tests (requires wasm-pack)
wasm-pack test wasm --node
```

## Project Structure

```
Secretum/
├── backend/           # Rust + Axum server
│   ├── src/
│   │   ├── main.rs    # WebSocket handler, routing
│   │   ├── lib.rs     # Public API for testing
│   │   ├── auth.rs    # Ed25519 identity, anti-replay
│   │   ├── config.rs  # TOML config loader
│   │   ├── messages.rs# Message types (ts-rs exported)
│   │   ├── room.rs    # Room management, Argon2
│   │   ├── persistence.rs # SQLite (optional)
│   │   └── static_files.rs # rust-embed handler
│   └── tests/         # Integration tests
├── wasm/              # WASM crypto core
│   ├── src/lib.rs     # SM4, Ed25519, PBKDF2, SHA-256
│   └── tests/         # WASM tests
├── frontend/          # React + Vite
│   └── src/
│       ├── components/ # UI components (all hand-written)
│       ├── hooks/      # useChat, useWasm
│       ├── types/      # TypeScript types
│       ├── styles/     # Holographic glass CSS
│       └── __tests__/  # Vitest + React Testing Library
├── config/            # Example configuration
├── Dockerfile         # Docker support
├── docker-compose.yml # Docker Compose
└── Cargo.toml         # Workspace root
```

## License

AGPL-3.0
