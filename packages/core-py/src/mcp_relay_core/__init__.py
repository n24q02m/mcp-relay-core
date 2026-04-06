"""Zero-env-config credential relay for MCP servers."""

from mcp_relay_core.crypto.aes import decrypt, encrypt
from mcp_relay_core.crypto.ecdh import (
    derive_shared_secret,
    export_public_key,
    generate_key_pair,
    import_public_key,
)
from mcp_relay_core.crypto.kdf import derive_aes_key
from mcp_relay_core.relay.browser import try_open_browser
from mcp_relay_core.relay.client import (
    RelaySession,
    create_session,
    generate_passphrase,
    poll_for_responses,
    poll_for_result,
    send_message,
)
from mcp_relay_core.storage.config_file import (
    delete_config,
    export_config,
    import_config,
    list_configs,
    read_config,
    write_config,
)
from mcp_relay_core.storage.mode import clear_mode, get_mode, set_local_mode
from mcp_relay_core.storage.resolver import resolve_config
from mcp_relay_core.storage.session_lock import (
    SessionInfo,
    acquire_session_lock,
    release_session_lock,
    write_session_lock,
)

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
    "poll_for_responses",
    "poll_for_result",
    "send_message",
    "try_open_browser",
    "delete_config",
    "export_config",
    "import_config",
    "list_configs",
    "read_config",
    "write_config",
    "resolve_config",
    "SessionInfo",
    "acquire_session_lock",
    "write_session_lock",
    "release_session_lock",
    "set_local_mode",
    "get_mode",
    "clear_mode",
]
