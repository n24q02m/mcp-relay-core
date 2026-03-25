# Deploying MCP Servers in HTTP Mode

This guide covers deploying better-telegram-mcp and better-email-mcp as persistent HTTP services, enabling remote access from any MCP client (Claude Desktop, Cursor, etc.) without local installation.

## Architecture

```
User's MCP client  --(SSE/HTTP)--> CF Tunnel/Caddy --> MCP Server (HTTP mode)
                                                       |
                                                       +--> Relay Server (credential exchange)
                                                       +--> /data volume (encrypted credentials)
```

In HTTP mode, each MCP server:
- Listens on port 8080 (internal)
- Accepts Streamable HTTP connections from MCP clients
- Stores credentials encrypted at rest (AES-256-GCM, key derived from CREDENTIAL_SECRET)
- Authenticates via relay-based zero-env-config flow on first connection

## Prerequisites

- Docker and Docker Compose
- A running [mcp-relay-server](../packages/relay-server/) instance (or use the hosted one)
- A domain with HTTPS (e.g., via Cloudflare Tunnel or Caddy)
- A strong CREDENTIAL_SECRET (generate with `openssl rand -hex 32`)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TRANSPORT_MODE` | Yes | Set to `http` |
| `CREDENTIAL_SECRET` | Yes | 256-bit hex secret for encrypting credentials at rest |

Server-specific variables (e.g., `TELEGRAM_BOT_TOKEN`, `EMAIL_CREDENTIALS`) are **not needed** -- credentials are provided through the relay flow and stored encrypted.

## Docker Compose

Each repo contains a `docker-compose.http.yml` overlay for HTTP mode.

### better-telegram-mcp (port 8081)

```bash
cd better-telegram-mcp
docker compose -f docker-compose.http.yml up -d
```

### better-email-mcp (port 8082)

```bash
cd better-email-mcp
docker compose -f docker-compose.http.yml up -d
```

### Combined deployment

To run both side-by-side, create a shared `docker-compose.yml`:

```yaml
services:
  telegram:
    image: ghcr.io/n24q02m/better-telegram-mcp:latest
    environment:
      - TRANSPORT_MODE=http
      - CREDENTIAL_SECRET=${CREDENTIAL_SECRET}
    ports:
      - "8081:8080"
    volumes:
      - telegram-data:/data
    restart: unless-stopped

  email:
    image: ghcr.io/n24q02m/better-email-mcp:latest
    environment:
      - TRANSPORT_MODE=http
      - CREDENTIAL_SECRET=${CREDENTIAL_SECRET}
    ports:
      - "8082:8080"
    volumes:
      - email-data:/data
    restart: unless-stopped

volumes:
  telegram-data:
  email-data:
```

## Reverse Proxy Configuration

HTTP mode requires HTTPS termination in front of the MCP servers. Two recommended approaches:

### Cloudflare Tunnel (recommended for production)

1. Create a tunnel in the Cloudflare dashboard
2. Add public hostnames:

| Hostname | Service |
|---|---|
| `telegram-mcp.example.com` | `http://localhost:8081` |
| `email-mcp.example.com` | `http://localhost:8082` |

3. Enable "No TLS Verify" if using self-signed certs internally

### Caddy (self-hosted)

```caddyfile
telegram-mcp.example.com {
    reverse_proxy localhost:8081
}

email-mcp.example.com {
    reverse_proxy localhost:8082
}
```

Caddy automatically provisions Let's Encrypt certificates.

## Security Considerations (Tier B Trust Model)

HTTP mode operates under a **Tier B trust model** -- the server operator has access to:

1. **Encrypted credential store**: Credentials are AES-256-GCM encrypted at rest in the `/data` volume. The encryption key is derived from `CREDENTIAL_SECRET` using PBKDF2.

2. **In-memory credentials**: While the server is running, decrypted credentials exist in process memory. The server operator (whoever controls the Docker host) could theoretically access them.

3. **Network traffic**: All MCP protocol messages pass through the server. HTTPS protects the transport, but the server itself sees plaintext tool calls and responses.

**Implications**:
- Self-hosting is the most secure option -- you control the Docker host
- For shared/managed hosting, trust the operator as you would trust them with your credentials
- Never expose MCP servers directly to the internet without HTTPS
- Rotate `CREDENTIAL_SECRET` periodically (requires re-authentication)

### Hardening checklist

- [ ] Use a unique, randomly generated `CREDENTIAL_SECRET` (256-bit)
- [ ] Run containers as non-root (already configured in Dockerfiles)
- [ ] Use named volumes (not bind mounts) for credential storage
- [ ] Enable HTTPS via Cloudflare Tunnel or Caddy
- [ ] Restrict network access to trusted IPs if possible
- [ ] Monitor container logs for unauthorized access attempts

## Relay Pages -- Mode Agnostic

The relay pages (`pages/`) work identically for both stdio and HTTP modes:

- **stdio mode**: The CLI puts its ECDH public key in the URL fragment (`#k=<pubkey>`)
- **HTTP mode**: The server puts its ECDH public key in the URL fragment via the relay session

The browser-side crypto is the same in both cases -- it reads the public key from the fragment, performs ECDH key exchange, and encrypts the credentials. The relay server never sees plaintext credentials.

## Troubleshooting

**Container won't start**: Check that `CREDENTIAL_SECRET` is set. The server will exit if this variable is missing in HTTP mode.

**Relay flow not working**: Ensure the relay server URL is accessible from both the MCP server container and the user's browser. The default relay URL is `https://better-telegram-mcp.n24q02m.com` (telegram) or `https://better-email-mcp.n24q02m.com` (email).

**Credentials lost after restart**: Verify that the Docker volume is persistent. Named volumes survive `docker compose down` but not `docker compose down -v`.
