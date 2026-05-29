FROM rust:1.82-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/Cargo.toml
COPY wasm/Cargo.toml wasm/Cargo.toml

# Create dummy source files to cache dependencies
RUN mkdir -p backend/src && echo "fn main(){}" > backend/src/main.rs && \
    mkdir -p wasm/src && echo "" > wasm/src/lib.rs

# Build dependencies (cached layer)
RUN cargo build --release -p secretum 2>/dev/null || true

# Copy actual source files
COPY backend/src/ backend/src/
COPY wasm/src/ wasm/src/
COPY frontend/ frontend/
COPY config/ config/

# Build WASM
RUN wasm-pack build wasm --target web --out-dir pkg

# Build frontend
RUN cd frontend && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install && \
    npm run build

# Build final binary
RUN cargo build --release -p secretum

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/secretum /usr/local/bin/secretum

EXPOSE 3000

CMD ["secretum"]
