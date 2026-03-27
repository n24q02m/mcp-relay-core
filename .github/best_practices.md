# Style Guide - mcp-relay-core

## Architecture
Zero-env-config credential relay for MCP servers. Monorepo with 3 packages.

## TypeScript (core-ts + relay-server)
- Formatter/Linter: Biome (default config)
- Type checker: tsc --noEmit
- Test: vitest + @vitest/coverage-v8
- Package manager: bun (workspace)
- Runtime: Node.js >= 24
- SDK: express (relay-server), WebCrypto (core-ts)

## Python (core-py)
- Formatter/Linter: Ruff (default config)
- Type checker: ty
- Test: pytest + pytest-asyncio
- Package manager: uv
- Runtime: Python 3.13 only
- Core deps: cryptography, httpx, platformdirs

## Code Patterns
- ECDH P-256 key exchange, AES-256-GCM encryption, HKDF-SHA256 key derivation
- Stateless relay: server never sees plaintext credentials
- URL fragment (#k=...&p=...) for client-side secrets (RFC 3986)
- Sessions: 10-min TTL, one-shot, max 5 per IP
- Config file: AES-256-GCM encrypted at rest, key derived at runtime

## Commits
Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:).

## Security
- Relay server MUST never access plaintext credentials
- SSRF prevention in all HTTP operations
- Rate limiting on all API endpoints
- Input validation for all user-provided data
- No secrets in code -- use Infisical
