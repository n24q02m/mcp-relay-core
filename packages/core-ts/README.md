# @n24q02m/mcp-relay-core

Zero-config credential relay client for TypeScript MCP servers -- ECDH P-256 + AES-256-GCM E2E encryption.

## Installation

```bash
npm install @n24q02m/mcp-relay-core
```

## Usage

### Resolve config (env vars -> config file -> defaults -> relay)

```typescript
import { resolveConfig } from "@n24q02m/mcp-relay-core";

const { config, source } = await resolveConfig("my-server", [
  "api-key",
  "endpoint",
]);

if (config) {
  console.log(`Config loaded from ${source}:`, config);
} else {
  // No config found -- trigger relay setup
}
```

### Relay session (interactive credential setup)

```typescript
import {
  createSession,
  pollForResult,
  writeConfig,
} from "@n24q02m/mcp-relay-core";

const session = await createSession("https://relay.example.com", "my-server", {
  fields: [
    { name: "api-key", label: "API Key", type: "password" },
    { name: "endpoint", label: "Endpoint", type: "text" },
  ],
});

console.log(`Open this URL to enter credentials: ${session.relayUrl}`);

const credentials = await pollForResult(
  "https://relay.example.com",
  session,
);

await writeConfig("my-server", credentials);
```

### Crypto primitives

```typescript
import {
  generateKeyPair,
  exportPublicKey,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  decrypt,
} from "@n24q02m/mcp-relay-core/crypto";
```

## Documentation

See the [main repository](https://github.com/n24q02m/mcp-relay-core) for full documentation, architecture, and security properties.

## License

MIT
