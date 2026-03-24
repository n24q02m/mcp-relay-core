# CLAUDE.md - mcp-relay-core

Zero-env-config credential relay for MCP servers.
Monorepo: core-ts (npm), core-py (PyPI), relay-server (Node.js), pages (static HTML).

## Commands

### TypeScript (root + core-ts + relay-server)
```
bun install                    # Install all TS deps
bun run test                   # Run all TS tests (vitest)
bun run check                  # Biome + tsc
```

### Python (core-py)
```
cd packages/core-py
uv sync --group dev            # Install Python deps
uv run pytest                  # Run Python tests
uv run ruff check .            # Lint
uv run ty check                # Type check
```

### E2E
```
bun run test:e2e               # Playwright E2E tests
```

## Architecture

- packages/core-ts/: ECDH crypto, config file storage, relay client (npm: @n24q02m/mcp-relay-core)
- packages/core-py/: Same as core-ts but Python (PyPI: mcp-relay-core)
- packages/relay-server/: Express API for session relay (stateless, npm: @n24q02m/mcp-relay-server)
- pages/: Static HTML/JS per-server relay forms (WebCrypto)
- e2e/: Playwright E2E tests

## Crypto

- Key exchange: ECDH P-256
- Encryption: AES-256-GCM
- Key derivation: HKDF-SHA256(shared_secret, passphrase)
- Config file: AES-256-GCM, key = PBKDF2(machine-id + username)
- Passphrase: 4-word Diceware (~52 bits entropy, EFF long wordlist)

## Security

- Relay server NEVER sees plaintext credentials
- URL fragment (#k=...&p=...) never sent to server (RFC 3986)
- Sessions: 10-min TTL, one-shot, max 5 per IP
- Config file: encrypted at rest, key derived at runtime (never persisted)
