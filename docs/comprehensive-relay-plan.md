# Plan Tong Hop: Relay System Audit + Fix + Full Test

## Muc tieu
Relay la con duong DUY NHAT de setup credentials cho end-user.
Khong bao gio yeu cau user set env vars thu cong.
Moi server PHAI hien relay URL khi khong co credentials.

## Van de phat hien

### A. Relay khong hien cho 3 servers (CRG, wet, mnemo)
**Root cause**: 3 servers Python check `os.environ` cho cloud API keys. Khi chay tu Claude Code,
`settings.local.json` inject env vars vao `os.environ` → relay bi SKIP.
Khi chay KHONG co env vars (end-user scenario), relay van trigger nhung can VERIFY.

**Action**: Test lai 3 servers VOI env vars bi xoa hoan toan (unset ALL cloud keys + remove config).
Neu van khong hien relay URL → debug relay_setup.py.

### B. Godot KHONG CAN relay
User xac nhan: godot khong can default project_path. Tools nhan per-call.
**Action**: Xoa relay setup khoi godot-mcp hoan toan. Xoa relay dependency.

### C. Telegram relay scrollbar (UI bug)
API_ID field bi tran, co scrollbar.
**Action**: Fix CSS trong `pages/telegram/form.js` hoac `pages/telegram/index.html`.

### D. Telegram auth: gop hay tach?
**Hien tai**: 2 he thong rieng biet:
1. Credential relay (mcp-relay-core): nhan API_ID/API_HASH/Phone
2. Auth relay (auth-relay Docker): nhan OTP + 2FA password

**Van de**: Ca 2 dung cung domain `better-telegram-mcp.n24q02m.com`. Caddy route
ALL /api/sessions → mcp-relay-core → auth_client.py fail 400.

**De xuat**: GOP ca 2 vao 1 flow:
1. User submit API_ID + API_HASH + Phone qua relay form
2. Server nhan, bat dau Telethon auth
3. Telethon yeu cau OTP → server gui `type: 'input_required'` qua relay messaging
4. Relay page hien input field cho OTP
5. User nhap OTP → gui qua relay response
6. Server nhan OTP → Telethon tiep tuc → co the yeu cau 2FA password
7. Neu can 2FA → lai gui `type: 'input_required'` lan 2
8. Auth xong → server gui `type: 'complete'`
9. Session file saved

**Benefit**: 1 URL duy nhat, 1 flow lien mach, khong can auth-relay Docker rieng.
Deprecate auth-relay container sau khi done.

### E. mcp-relay-core v0.1.0 bug (DA FIX)
4 Python servers dung v0.1.0 co body.result parsing sai.
**Action**: DA FIX — bumped all to >=1.0.5. DA PUSH. ✅

## Cac mode can test

### Mode 1: Hosted Relay (default, end-user)
- Server chay qua `uvx`/`npx` (khong co source code)
- KHONG co env vars
- Relay URL tro den `*.n24q02m.com` (production relay server)
- User mo browser, nhap credentials, submit
- Config saved to encrypted file
- Restart → load tu file

### Mode 2: Local Mode (developer, skip relay)
- Set env vars truc tiep (API keys, tokens)
- Relay KHONG hien (skip)
- Server dung env vars
- Test: set env var → verify no relay → verify tools work

### Mode 3: Self-hosted Relay
- User tu deploy relay server (Docker/local)
- Set `MCP_RELAY_URL=http://localhost:3080` (hoac custom URL)
- Relay URL tro den self-hosted server
- Flow giong Mode 1 nhung URL khac

### Mode 4: Config File Persistence
- Da setup 1 lan (Mode 1 hoac 3)
- Restart server → auto-load tu config file
- KHONG hien relay
- Test: setup qua relay → kill → restart → verify tools work

### Mode 5: Skip/Timeout
- User click Skip hoac khong interact (30s timeout)
- Server fallback local mode (CRG, wet, mnemo) hoac degraded (notion, email, telegram)
- Test: start server → do nothing → verify fallback

### Mode 6: Google Drive Sync (wet/mnemo only)
- After relay credentials setup → trigger Drive sync
- OAuth Device Code flow qua relay messaging
- Token saved to `~/.{server}/tokens/google_drive.json`
- Test: config relay → setup_sync tool → OAuth → sync works

## Test Matrix FULL

### Phase 1: Fix truoc khi test
| # | Task | Server | Priority |
|---|------|--------|----------|
| 1.1 | Fix telegram relay scrollbar | mcp-relay-core | P1 |
| 1.2 | Remove relay from godot-mcp | better-godot-mcp | P1 |
| 1.3 | Implement telegram OTP via relay messaging | better-telegram-mcp + mcp-relay-core | P1 |
| 1.4 | Verify CRG/wet/mnemo relay hinh khi no env vars | all 3 | P1 |

### Phase 2: Relay E2E (Mode 1 — hosted, no env vars)
Test TUNG server: start → relay URL → open browser → submit → MCP tools work.

| # | Server | Credentials | OAuth Flow | Tools to Verify |
|---|--------|-------------|------------|-----------------|
| 2.1 | better-notion-mcp | NOTION_TOKEN | None | workspace.search, pages.get |
| 2.2 | better-email-mcp (Gmail) | email:app_password | None | messages.search, folders.list |
| 2.3 | better-email-mcp (Outlook) | email (no password) | Device Code | messages.search |
| 2.4 | better-email-mcp (multi) | gmail:pass,outlook | Mixed | messages.search per account |
| 2.5 | better-telegram-mcp (bot) | BOT_TOKEN | None | chats.list, messages.search |
| 2.6 | better-telegram-mcp (user) | API_ID+HASH+Phone | OTP+2FA via relay | chats.list, messages.search |
| 2.7 | better-code-review-graph | GEMINI_API_KEY | None | config.status (cloud mode) |
| 2.8 | wet-mcp (sdk mode) | API keys | None | config.status (cloud), search |
| 2.9 | mnemo-mcp (cloud mode) | API keys | None | config.status (cloud), memory.add |

### Phase 3: Local Mode (Mode 2 — env vars, no relay)
Set env vars → verify NO relay → verify tools.

| # | Server | Env Var | Tool Test |
|---|--------|---------|-----------|
| 3.1 | notion | NOTION_TOKEN | workspace.search |
| 3.2 | email | EMAIL_CREDENTIALS | messages.search |
| 3.3 | telegram (bot) | TELEGRAM_BOT_TOKEN | chats.list |
| 3.4 | telegram (user) | API_ID+HASH+PHONE | chats.list |
| 3.5 | crg | GEMINI_API_KEY | config.status |
| 3.6 | wet | GEMINI_API_KEY | config.status |
| 3.7 | mnemo | JINA_AI_API_KEY | config.status |

### Phase 4: Skip/Timeout (Mode 5)
| # | Server | Timeout | Expected Fallback |
|---|--------|---------|-------------------|
| 4.1 | notion | Skip button | Degraded (help + convert only) |
| 4.2 | email | Skip button | No email tools |
| 4.3 | telegram | Skip button | No telegram tools |
| 4.4 | crg | 30s timeout | Local ONNX |
| 4.5 | wet | 30s timeout | Local ONNX + SearXNG |
| 4.6 | mnemo | 30s timeout | Local Qwen3 ONNX |

### Phase 5: Config Persistence (Mode 4)
| # | Server | Test |
|---|--------|------|
| 5.1 | notion | Relay → save → restart → auto-load → tools work |
| 5.2 | email | Relay → save → restart → OAuth tokens load → IMAP works |
| 5.3 | telegram | Relay → auth → session saved → restart → session load → tools work |
| 5.4 | crg | Relay → save → restart → cloud mode → tools work |
| 5.5 | wet | Relay → save → restart → cloud mode → tools work |
| 5.6 | mnemo | Relay → save → restart → cloud mode → tools work |

### Phase 6: Google Drive Sync (Mode 6)
| # | Server | Test |
|---|--------|------|
| 6.1 | wet-mcp | setup.setup_sync → Device Code → Google auth → token saved → sync works |
| 6.2 | mnemo-mcp | setup.setup_sync → Device Code → Google auth → token saved → sync works |

### Phase 7: Tool Exhaustive Test
Moi server: test TAT CA tools va TAT CA actions.

| Server | Tools x Actions |
|--------|----------------|
| notion | pages (8 actions), databases (10), blocks (5), users (4), workspace (2), comments (3), content_convert (2), file_uploads (5), help |
| email | messages (9 actions), folders (1), attachments (2), send (3), help |
| telegram | messages (search/read/send/forward/delete/pin), chats (list/get/create/archive), media (list/download/upload), contacts (list/search/add), config (status/set/cache_clear), help |
| crg | graph (4 actions), query (4), review, config (3), help |
| wet | search (4 actions), extract (6), media (3), config (4), setup (2), help |
| mnemo | memory (11 actions), config (3), setup (2), help |

## Execution Order

1. **Fix Phase 1** (code changes) → commit + push + verify CI
2. **Test Phase 2** (relay E2E) → tung server, 1-1 voi user
3. **Test Phase 3** (local mode) → co the tu dong
4. **Test Phase 4** (skip/timeout) → co the tu dong
5. **Test Phase 5** (persistence) → can user verify restart
6. **Test Phase 6** (Drive sync) → can user OAuth
7. **Test Phase 7** (exhaustive) → tung tool tung action
