# mcp-relay-core

Zero-config credential relay client for Python MCP servers -- ECDH P-256 + AES-256-GCM E2E encryption.

## Installation

```bash
pip install mcp-relay-core
```

## Usage

### Resolve config (env vars -> config file -> defaults -> relay)

```python
from mcp_relay_core import resolve_config

result = resolve_config("my-server", ["api_key", "endpoint"])

if result.config:
    print(f"Config loaded from {result.source}: {result.config}")
else:
    # No config found -- trigger relay setup
    pass
```

### Relay session (interactive credential setup)

```python
import asyncio
from mcp_relay_core import create_session, poll_for_result, write_config

async def setup():
    session = await create_session(
        "https://relay.example.com",
        "my-server",
        {
            "fields": [
                {"name": "api_key", "label": "API Key", "type": "password"},
                {"name": "endpoint", "label": "Endpoint", "type": "text"},
            ]
        },
    )

    print(f"Open this URL to enter credentials: {session.relay_url}")

    credentials = await poll_for_result("https://relay.example.com", session)
    write_config("my-server", credentials)

asyncio.run(setup())
```

### Crypto primitives

```python
from mcp_relay_core.crypto import (
    generate_key_pair,
    export_public_key,
    derive_shared_secret,
    derive_aes_key,
    encrypt,
    decrypt,
)
```

## Documentation

See the [main repository](https://github.com/n24q02m/mcp-relay-core) for full documentation, architecture, and security properties.

## License

MIT
