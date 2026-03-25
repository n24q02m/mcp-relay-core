"""Cryptographic primitives: ECDH, AES-256-GCM, HKDF-SHA256."""

from mcp_relay_core.crypto.aes import decrypt, encrypt
from mcp_relay_core.crypto.ecdh import (
    derive_shared_secret,
    export_public_key,
    generate_key_pair,
    import_public_key,
)
from mcp_relay_core.crypto.kdf import derive_aes_key

__all__ = [
    "decrypt",
    "derive_aes_key",
    "derive_shared_secret",
    "encrypt",
    "export_public_key",
    "generate_key_pair",
    "import_public_key",
]
