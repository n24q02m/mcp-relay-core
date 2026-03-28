# Relay E2E Test Plan

Kich ban test day du cho 7 MCP servers. Tai su dung cho moi lan thay doi relay system.

## Test Matrix

### Legend
- **P** = Pass, **F** = Fail, **S** = Skip, **N/A** = Not applicable
- Ghi ngay test va ket qua vao cot cuoi

### Phase 1: Server Startup (khong co credentials)

Moi server PHAI hien relay URL khi khoi dong khong co env vars.

| # | Server | Command | Expected | Result |
|---|--------|---------|----------|--------|
| 1.1 | better-notion-mcp | `bunx @n24q02m/better-notion-mcp` | Relay URL on stderr | |
| 1.2 | better-email-mcp | `bunx @n24q02m/better-email-mcp` | Relay URL on stderr | |
| 1.3 | better-godot-mcp | `bunx @n24q02m/better-godot-mcp` | Relay URL on stderr (30s timeout) | |
| 1.4 | better-telegram-mcp | `uvx better-telegram-mcp` | Relay URL on stderr | |
| 1.5 | better-code-review-graph | `uvx better-code-review-graph` | Relay URL on stderr (30s timeout) | |
| 1.6 | wet-mcp | `uvx wet-mcp` | Relay URL on stderr (30s timeout) | |
| 1.7 | mnemo-mcp | `uvx mnemo-mcp` | Relay URL on stderr (30s timeout) | |

### Phase 2: Relay Page UI

Mo relay URL trong browser. Verify form hien thi dung.

| # | Server | Expected Fields | Modes | Result |
|---|--------|-----------------|-------|--------|
| 2.1 | better-notion-mcp | NOTION_TOKEN (password) | Single | |
| 2.2 | better-email-mcp | EMAIL_CREDENTIALS (text, multi-account) | Single | |
| 2.3 | better-godot-mcp | project_path (text), godot_path (text, optional) | Single | |
| 2.4 | better-telegram-mcp | Bot: BOT_TOKEN (password). User: API_ID, API_HASH, PHONE | Bot / User | |
| 2.5 | better-code-review-graph | GEMINI_API_KEY (password) | Single | |
| 2.6 | wet-mcp | Local: (no fields). SDK: API_KEYS (password). + Drive sync section | Local / SDK | |
| 2.7 | mnemo-mcp | Local: (no fields). Cloud: JINA/GEMINI/OPENAI/COHERE keys. + Drive sync section | Local / Cloud | |

### Phase 3: Credential Submit via Relay

Submit credentials qua relay form. Server PHAI nhan, decrypt, luu config.

| # | Server | Test Data | Expected | Result |
|---|--------|-----------|----------|--------|
| 3.1 | better-notion-mcp | Notion integration token | Server logs "config saved", tools available | |
| 3.2 | better-email-mcp (1 acc) | `email@gmail.com:app_password` | Server logs config, list_messages works | |
| 3.3 | better-email-mcp (multi) | `a@gmail.com:pass1,b@outlook.com:pass2` | Both accounts configured | |
| 3.4 | better-godot-mcp | `/path/to/godot/project` | Server accepts path, tools work | |
| 3.5 | better-telegram-mcp (bot) | Bot token from @BotFather | Server connects, send_message works | |
| 3.6 | better-telegram-mcp (user) | API_ID + API_HASH + phone | MTProto auth triggered | |
| 3.7 | better-code-review-graph | Gemini API key | Cloud embeddings available | |
| 3.8 | wet-mcp (local) | Select "local" mode | Server starts with ONNX | |
| 3.9 | wet-mcp (sdk) | `GEMINI_API_KEY:AIza...` | Cloud search available | |
| 3.10 | mnemo-mcp (local) | Select "local" mode | Server starts with Qwen3 ONNX | |
| 3.11 | mnemo-mcp (cloud) | Gemini API key | Cloud embeddings available | |

### Phase 4: Skip Button

Click "Skip" tren relay page. Server PHAI fallback dung.

| # | Server | Expected Fallback | Result |
|---|--------|-------------------|--------|
| 4.1 | better-notion-mcp | Degraded mode: help + content_convert only | |
| 4.2 | better-email-mcp | No email tools available | |
| 4.3 | better-godot-mcp | Tools work with per-call project_path | |
| 4.4 | better-telegram-mcp | No Telegram tools | |
| 4.5 | better-code-review-graph | Local qwen3-embed ONNX mode | |
| 4.6 | wet-mcp | Local ONNX + SearXNG | |
| 4.7 | mnemo-mcp | Local Qwen3 ONNX + SQLite FTS5 | |

### Phase 5: Timeout (30s servers only)

Khong interact voi relay page. Server tu dong timeout va fallback.

| # | Server | Timeout | Expected | Result |
|---|--------|---------|----------|--------|
| 5.1 | better-godot-mcp | 30s | Fallback to per-call path | |
| 5.2 | better-code-review-graph | 30s | Fallback to local ONNX | |
| 5.3 | wet-mcp | 30s | Fallback to local mode | |
| 5.4 | mnemo-mcp | 30s | Fallback to local mode | |

### Phase 6: Bidirectional Messaging (OAuth Device Code)

Server gui device code qua relay messaging. Browser hien thi code + URL.

| # | Server | Trigger | Expected on Relay Page | Result |
|---|--------|---------|------------------------|--------|
| 6.1 | better-email-mcp (Outlook) | Submit `user@outlook.com` (no password) | Device code + microsoft.com/devicelogin link | |
| 6.2 | wet-mcp (Drive sync) | Enable sync + client ID | Device code + accounts.google.com/o/oauth2/device link | |
| 6.3 | mnemo-mcp (Drive sync) | Enable sync + client ID | Device code + accounts.google.com/o/oauth2/device link | |
| 6.4 | better-telegram-mcp (user) | Submit API_ID + API_HASH + phone | Auth code prompt (MTProto) | |

### Phase 7: Config Persistence

Restart server. Credentials PHAI duoc load tu config file (khong can relay lai).

| # | Server | Test | Expected | Result |
|---|--------|------|----------|--------|
| 7.1 | better-notion-mcp | Restart server | Auto-loads from ~/.config/mcp/config.enc | |
| 7.2 | better-email-mcp | Restart server | Auto-loads accounts from config.enc | |
| 7.3 | better-telegram-mcp | Restart server | Auto-loads from config.enc + .session files | |
| 7.4 | better-code-review-graph | Restart server | Auto-loads from config.enc | |
| 7.5 | wet-mcp | Restart server | Auto-loads from config.enc + tokens/ | |
| 7.6 | mnemo-mcp | Restart server | Auto-loads from config.enc + tokens/ | |
| 7.7 | better-godot-mcp | Restart server | Auto-loads from config.enc | |

### Phase 8: Tool Smoke Test

Sau khi setup xong, verify 1 tool chinh cua moi server hoat dong.

| # | Server | Tool | Test Input | Expected | Result |
|---|--------|------|------------|----------|--------|
| 8.1 | better-notion-mcp | search_pages | query: "test" | Returns page results | |
| 8.2 | better-email-mcp | list_messages | folder: INBOX, limit: 5 | Returns emails | |
| 8.3 | better-godot-mcp | list_scenes | project_path | Returns .tscn files | |
| 8.4 | better-telegram-mcp | list_chats | limit: 5 | Returns chat list | |
| 8.5 | better-code-review-graph | build_graph | repo path | Builds knowledge graph | |
| 8.6 | wet-mcp | search | query: "test" | Returns search results | |
| 8.7 | mnemo-mcp | memory_store | text: "test memory" | Stores successfully | |

### Phase 9: Env Var Override

Set env vars. Server PHAI dung env vars thay vi relay.

| # | Server | Env Var | Expected | Result |
|---|--------|---------|----------|--------|
| 9.1 | better-notion-mcp | NOTION_TOKEN=ntn_xxx | No relay, direct connect | |
| 9.2 | better-email-mcp | EMAIL_CREDENTIALS=a@b:pass | No relay, direct connect | |
| 9.3 | better-telegram-mcp | TELEGRAM_BOT_TOKEN=xxx | No relay, bot mode | |
| 9.4 | better-code-review-graph | GEMINI_API_KEY=AIza... | No relay, cloud mode | |
| 9.5 | wet-mcp | GEMINI_API_KEY=AIza... | No relay, sdk mode | |
| 9.6 | mnemo-mcp | JINA_AI_API_KEY=jina_... | No relay, cloud mode | |

## Execution Notes

### Prerequisites
- Docker running (cho SearXNG trong wet-mcp)
- Browser san sang (mo relay URLs)
- Test credentials san sang (Notion token, email app password, Telegram bot token, API keys)
- `GOOGLE_DRIVE_CLIENT_ID` da set trong Infisical

### Execution Order
1. Phase 1-3: Test tuan tu tung server (start → open URL → submit)
2. Phase 4-5: Test skip/timeout (co the song song)
3. Phase 6: Test OAuth flows (can interact voi browser)
4. Phase 7: Restart va verify persistence
5. Phase 8: Smoke test tools
6. Phase 9: Env var override (co the song song)

### Test Data Sources
- Notion: Integration token tu https://www.notion.so/my-integrations
- Email: Gmail app password (Settings → Security → App passwords)
- Telegram: Bot token tu @BotFather, API ID/Hash tu https://my.telegram.org/apps
- Gemini: API key tu https://aistudio.google.com/apikey
- Godot: Any Godot project directory
- Google Drive: OAuth Client ID tu Infisical

## Test Results — Session 28/03/2026

### better-notion-mcp
| Phase | Test | Result | Notes |
|-------|------|--------|-------|
| 1.1 | Server startup → relay URL | PASS | URL on stderr |
| 2.1 | Relay page UI | PASS | Token field + Send + Skip |
| 3.1 | Submit token via relay | PASS | "Notion token saved. Setup complete!" |
| 7.1 | Config persistence | PASS | "Notion config loaded from file" |
| 8.1 | MCP tools/call workspace.search | PASS | API 200, 2 results returned |
| **E2E** | **Relay → Config → MCP → Notion API** | **PASS** | Full flow verified |

### better-email-mcp
| Phase | Test | Result | Notes |
|-------|------|--------|-------|
| 1.2 | Server startup → relay URL | PASS | URL on stderr |
| 2.2 | Relay page UI | PASS | Email field + Add Account + Skip |
| 3.2 | Submit email via relay | PASS | Config saved, Outlook detected |
| 6.1 | OAuth Device Code (Outlook) | PASS | Code K5AKCWRW shown on relay page |
| 8.2 | MCP tools/call messages.search | PASS | 3 real emails from Outlook IMAP |
| **E2E** | **Relay → OAuth → Token → MCP → IMAP** | **PASS** | Full OAuth + IMAP flow verified |

### Remaining (next session)
- better-telegram-mcp: bot mode + user mode (MTProto)
- better-godot-mcp: project path + skip/timeout
- better-code-review-graph: API key + local ONNX fallback
- wet-mcp: local + sdk + Google Drive sync
- mnemo-mcp: local + cloud + Google Drive sync

Each server needs: relay test + ALL tools + ALL actions + ALL modes + skip/timeout + persistence.
