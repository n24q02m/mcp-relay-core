# mcp-relay-core

Zero-env-config credential relay for MCP servers. End-to-end encrypted with ECDH + AES-256-GCM -- the relay server never sees plaintext credentials.

## How It Works

```
User (browser)                    Relay Server                MCP Server (CLI)
     |                                |                            |
     |  1. Generate ECDH keypair      |                            |
     |  2. Open relay page            |                            |
     |         #k=pubkey&p=passphrase |                            |
     |                                |                            |
     |  3. Enter credentials in form  |                            |
     |  4. Encrypt with ECDH shared   |                            |
     |     secret + passphrase        |                            |
     |  5. POST /session (encrypted)  |                            |
     |  ------------------------------>                            |
     |                                |  6. Poll GET /session/:id  |
     |                                |  <-------------------------|
     |                                |  7. Return encrypted blob  |
     |                                |  ------------------------->|
     |                                |  8. Decrypt with ECDH      |
     |                                |     shared secret          |
     |                                |  9. Store in config file   |
     |                                |     (AES-256-GCM at rest)  |
```

The URL fragment (`#k=...&p=...`) is never sent to the server per RFC 3986. The relay server only ever handles opaque encrypted blobs.

## Packages

| Package | Description | Registry |
|---------|-------------|----------|
| `packages/core-ts` | ECDH crypto, config storage, relay client | npm: `@n24q02m/mcp-relay-core` |
| `packages/core-py` | Same as core-ts, Python implementation | PyPI: `mcp-relay-core` |
| `packages/relay-server` | Express API for session relay | npm: `@n24q02m/mcp-relay-server` |
| `pages/` | Static HTML relay forms per MCP server | GitHub Pages |

## Quick Start

```bash
# Prerequisites: mise (manages node, bun, python, uv)
mise run setup
```

## Security Properties

- Relay server is zero-knowledge (never sees plaintext)
- Sessions: 10-minute TTL, one-shot consumption, max 10 per IP
- Config file encrypted at rest with machine-bound key (PBKDF2)
- Passphrase: 4-word Diceware (~52 bits entropy)

## License

MIT
