# @n24q02m/mcp-relay-server

Zero-config MCP credential relay server -- ECDH P-256 + AES-256-GCM, rate-limited, zero-knowledge.

The relay server never sees plaintext credentials. It only stores and forwards opaque encrypted blobs between the browser and the MCP server CLI.

## Installation

```bash
npm install @n24q02m/mcp-relay-server
```

## Usage

### Start the server

```typescript
import { createApp } from "@n24q02m/mcp-relay-server";

const app = createApp();
app.listen(3000, () => {
  console.log("Relay server listening on port 3000");
});
```

### Start a local relay (ephemeral, random port)

```typescript
import { startLocalRelay } from "@n24q02m/mcp-relay-server";

const relay = await startLocalRelay("/path/to/pages");
console.log(`Relay running at ${relay.url}`);

// When done:
relay.close();
```

### Docker

```bash
docker build -t mcp-relay-server .
docker run -p 3000:8080 mcp-relay-server
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `PAGES_DIR` | - | Directory for static relay form pages |
| `CORS_ORIGIN` | `*` | CORS allowed origin |

## Security properties

- Zero-knowledge: server never sees plaintext credentials
- Sessions: 10-minute TTL, one-shot consumption, max 5 per IP
- Rate-limited API routes

## Documentation

See the [main repository](https://github.com/n24q02m/mcp-relay-core) for full documentation, architecture, and security properties.

## License

MIT
