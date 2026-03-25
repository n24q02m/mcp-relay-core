"""Zero-env-config credential relay for MCP servers."""

from mcp_relay_core.crypto.aes import decrypt, encrypt
from mcp_relay_core.crypto.ecdh import (
    derive_shared_secret,
    export_public_key,
    generate_key_pair,
    import_public_key,
)
from mcp_relay_core.crypto.kdf import derive_aes_key
from mcp_relay_core.relay.client import (
    RelaySession,
    create_session,
    generate_passphrase,
    poll_for_result,
)
from mcp_relay_core.storage.config_file import (
    delete_config,
    export_config,
    import_config,
    list_configs,
    read_config,
    write_config,
)
from mcp_relay_core.storage.resolver import resolve_config

__all__ = [
    "decrypt",
    "derive_aes_key",
    "derive_shared_secret",
    "export_public_key",
    "generate_key_pair",
    "import_public_key",
    "encrypt",
    "RelaySession",
    "create_session",
    "generate_passphrase",
    "poll_for_result",
    "delete_config",
    "export_config",
    "import_config",
    "list_configs",
    "read_config",
    "write_config",
    "resolve_config",
]
