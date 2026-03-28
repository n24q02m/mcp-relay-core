# CLAUDE.md - mcp-relay-core

Zero-env-config credential relay for MCP servers.
Monorepo: core-ts (npm), core-py (PyPI), relay-server (Node.js), pages (static HTML).

## Commands

### TypeScript (per-package)
```
bun install                    # Install all TS deps (root workspace)

# core-ts
cd packages/core-ts
bun run test                   # vitest
bun run check                  # Biome + tsc

# relay-server
cd packages/relay-server
bun run test                   # vitest
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
- packages/relay-server/: Express API for session relay (npm: @n24q02m/mcp-relay-server)
  - Bidirectional messaging: server->browser (OAuth device codes, status) + browser->server (skip)
  - Rate limits: 30/min mutations, 120/min polling
- pages/: Static HTML/JS per-server relay forms (WebCrypto, message polling)
- e2e/: Playwright E2E tests

## Crypto

- Key exchange: ECDH P-256
- Encryption: AES-256-GCM
- Key derivation: HKDF-SHA256(shared_secret, passphrase)
- Config file: AES-256-GCM, key = PBKDF2(machine-id + username)
- Passphrase: 4-word Diceware (~52 bits entropy, EFF long wordlist)

## Release & Deploy

- Conventional Commits. Tag format: `v{version}` (config: `semantic-release.toml`)
- CD: workflow_dispatch, chon beta/stable
- Pipeline: PSR v10 -> npm publish (core-ts + relay-server) + PyPI publish (core-py) -> Docker multi-arch (amd64 + arm64) -> DockerHub + GHCR
- All 3 packages share the same version. PSR bumps pyproject.toml (version_toml); CD injects version into package.json before npm publish
- Docker images: `n24q02m/mcp-relay-server`, `ghcr.io/n24q02m/mcp-relay-core/relay-server`
- OCI VM deploy: Docker Compose + Watchtower. Port 3080, Caddy routes for subdomains

## Security

- Relay server NEVER sees plaintext credentials
- URL fragment (#k=...&p=...) never sent to server (RFC 3986)
- Sessions: 10-min TTL, one-shot, max 10 per IP
- Config file: encrypted at rest, key derived at runtime (never persisted)
