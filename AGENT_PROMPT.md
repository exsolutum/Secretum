# Secretum – 自主开发指令

你是全栈 Agent，负责从零构建 Secretum——一个运行在 Android 手机上的自托管、端到端加密、基于 IPv6 动态地址的私密聊天室。  
仓库：`https://github.com/exsolutum/Secretum`  
环境变量 `GITHUB_TOKEN` 已注入（`repo` 权限），你可以直接 `git push`。

## 核心约束
你没有浏览器，一切前端效果必须通过 **编译、测试和设计约定** 保证。每次修改后必须依次执行：
1. `cargo check --all`
2. `cargo test --all`（含 WASM）
3. `npm run build`（前端无 TS 错误）
4. `npm test`（前端测试必须通过）
任何一步失败必须修正，**严禁跳过直接提交**。

## 技术栈
- 后端：Rust + Axum，监听 `127.0.0.1:3000`
- WASM 加密核心：SM4 + Ed25519，编译到 `wasm/pkg/`
- 前端：React + TypeScript + Vite，产物为纯静态文件
- 类型桥梁：`ts-rs` 自动生成消息类型至 `frontend/src/types/`
- 配置：单一 `secretum.toml`，缺失时自动从内嵌默认值创建
- 动态 DNS：Caddy + DuckDNS（仅在 README 给出部署指南）
- 持久化（可选）：加密 SQLite，默认纯内存运行
- 最终产物：单个 `secretum` 可执行文件，前端和 WASM 全部嵌入

## UI 设计铁律：次世代科技风
采用 **全息玻璃 / 精密仪器** 风格，杜绝 Material 圆润感。所有组件必须手写，不得使用 MUI、Ant Design 等库。

### 样式变量（定义在 `global.css`）
- 背景：`#0B0E14`
- 面板背景：`rgba(20, 25, 35, 0.8)`
- 文字：`#E0E8F0`
- 强调色：`#00F0FF`（电光青）
- 次要强调：`#FF6B35`（暖橙）
- 辅助文字：`#7B8BA3`
- 字体正文：`'Inter', 'Noto Sans SC', sans-serif`
- 字体等宽：`'Fira Code', monospace`

### 组件规则
- 主面板：`backdrop-filter: blur(12px) saturate(150%)`，`border-radius: 4px`
- 所有边框：`1px solid rgba(0, 240, 255, 0.3)`，hover 时增亮并加外发光 `0 0 8px rgba(0, 240, 255, 0.2)`
- 输入框：背景 `rgba(255,255,255,0.05)`，下边框 `2px solid rgba(0, 240, 255, 0.5)`，聚焦时下边框变为 `#00F0FF`
- 按钮：文字大写，字间距 `2px`，背景 `rgba(0, 240, 255, 0.15)`，hover 变亮，active 缩放 0.98
- 消息显示：左侧竖线区分（他人 `#00F0FF`，自己 `#FF6B35`），背景 `rgba(255,255,255,0.03)`，无气泡
- 系统消息：颜色 `#7B8BA3`，前缀 `▶ `
- 动画：仅允许 `transition: all 0.2s ease`，加载指示器用细环旋转

### UI 验证手段
- 快照测试及 `getComputedStyle` 断言（检查颜色、字体族等）
- 结构测试确保系统消息前缀 `▶ ` 存在
- 禁止任何 Material 色彩出现

## 目录结构
```

/
├── backend/                 # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── messages.rs
│   │   ├── auth.rs
│   │   ├── room.rs
│   │   ├── persistence.rs
│   │   └── static_files.rs
│   ├── Cargo.toml
│   └── tests/
├── wasm/                    # Rust WASM 加密库
│   ├── src/lib.rs
│   ├── Cargo.toml
│   └── tests/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/ (App, JoinRoom, ChatRoom, MessageList, InputArea, AdminPanel)
│   │   ├── hooks/useWebSocket.ts
│   │   ├── types/ (由 ts-rs 自动生成)
│   │   ├── styles/global.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── config/
│   └── secretum.example.toml
├── AGENT_PROMPT.md
├── README.md
└── LICENSE

```

## 分步实施计划

### 第一步：骨架与嵌入式构建
1. 初始化以上目录，创建 `Cargo.toml`（后端加入 `rust-embed`）、`wasm/Cargo.toml`，前端 Vite 项目。
2. 编写 `secretum.example.toml`，字段：`bind_address`, `port`, `static_files_embedded`, `persistence_enabled`, `db_path`, `db_encryption_key`, `log_level`, `max_connections`。
3. 实现配置加载：先查找 `secretum.toml`，缺失则用内嵌默认值并生成示例文件。
4. 最小 Axum 服务：`/` 和所有非 `/ws` 路由 serve 嵌入式静态文件（使用 `rust-embed`），`/ws` 预留。
5. 前端显示 `<h1>SECRETUM</h1>`，加载 WASM 并控制台输出 `WASM READY`。
6. 配置构建流程：确保 `cargo build --release` 自动将 `frontend/dist/` 嵌入二进制。在 `build.rs` 中调用 `npm run build` 并拷贝产物，或直接 `include_dir!` 指向 `frontend/dist`。
7. CI：安装 `wasm-pack`，构建 WASM 和前端，`cargo check`。
8. 全绿后 push。

### 第二步：WASM 加密核心与消息类型
1. 实现 `wasm/src/lib.rs`：
   - `sm4_encrypt`, `sm4_decrypt`（自行实现 SM4-CBC/CTR，保持一致）
   - `generate_keypair`, `sign`, `verify`（Ed25519）
   - `derive_key(room_secret, salt) -> [u8;16]`（PBKDF2-HMAC-SHA256，10 万次迭代）
2. 在 `wasm/tests/` 中编写往返测试。
3. 在 `backend/src/messages.rs` 定义所有消息类型（`Auth`, `Join`, `Chat`, `Kick`, `Ban` 等），派生 `ts_rs::TS`。
4. `build.rs` 将生成的 TS 类型输出到 `frontend/src/types/`。
5. 前端在 `useWebSocket` 中使用这些类型。
6. 验证编译全绿，push。

### 第三步：身份与房间权限
1. `auth.rs`：WebSocket 连接后首条消息必须为 `Auth`，验证 Ed25519 签名（`timestamp`），绑定公钥哈希为 uid。时间戳容差 30 秒，缓存签名防重放。
2. `room.rs`：
   - 房间结构：`room_id`, `admin_uid`, `hashed_secret` (Argon2id), `is_locked`, 连接集合, 黑名单。
   - 首次 `Join` 自动创建房间并设置管理员。
   - 验证密码，广播加入/离开。
   - `Chat` 广播密文，不解密。
   - 管理员命令：`Kick`, `Ban`, `Unban`, `LockRoom`, `UnlockRoom`, `DestroyRoom`, `TransferAdmin`，全部需签名。
3. 连接断开时清理，空房间销毁。
4. 可选持久化：开启时用 SQLite 存储房间和黑名单，启动恢复。
5. 单元测试覆盖所有权限逻辑。
6. push。

### 第四步：科技风 UI 实现
1. 编写 `global.css`，定义所有变量和基础样式（body 渐变背景，磨砂面板）。
2. 实现组件：
   - `JoinRoom`：全屏居中磨砂卡片，标题 `SECRETUM` 用青色，输入框和按钮风格化。
   - `ChatRoom`：顶栏显示房间信息，消息列表，底部输入区。
   - `MessageList`：消息左边框，时间戳等宽，系统消息加前缀 `▶ `。
   - `AdminPanel`：工具栏按钮，显示当前管理员功能。
3. 集成 WASM：连接时生成密钥对并存入 `localStorage`，加入房间时派生密钥，发送加密接收解密。
4. 测试：断言标题颜色为 `rgb(0, 240, 255)`，系统消息前缀存在，面板有 `backdrop-filter` 样式。
5. 构建通过，push。

### 第五步：单二进制与文档
1. 完善 `build.rs`，使 `cargo build --release` 输出单个可执行文件 `secretum`。前端构建失败时应给出清晰提示。
2. 集成测试：用 `reqwest` 验证启动后根路径返回 200 并包含 `SECRETUM`。
3. 编写 `README.md`：项目简介、特性、科技风 UI 示意图（ASCII）、快速开始（Termux + 单文件运行）、配置说明、部署步骤。
4. 添加 `LICENSE`（AGPL-3.0）。
5. 最终全量测试，打 `v1.0.0` 标签，创建 Release 并上传编译好的二进制。

## 防 AI 味自查清单
- [ ] 主面板有 `backdrop-filter: blur()` 磨砂效果
- [ ] 无任何 Material 色彩，全部使用自定义变量
- [ ] 数字和代码使用等宽字体
- [ ] 消息使用左侧彩色竖线，非气泡
- [ ] 系统消息以 `▶ ` 开头
- [ ] 按钮 hover 有外发光
- [ ] 无大圆角、卡片阴影、渐变滥用

## 重要提醒
- `GITHUB_TOKEN` 已通过环境变量提供，**绝对不要**将其写入任何仓库文件或打印到日志。
- 每次提交前务必确保本地测试与构建全部通过，养成习惯。
- 如果某步遇到对接困难，通过增加类型约束或单元测试来捕获问题，不得靠猜测。

现在，开始执行「第一步（？）」。
```