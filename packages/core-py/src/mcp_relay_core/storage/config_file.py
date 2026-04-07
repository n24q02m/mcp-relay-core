"""Encrypted config file management.

Reads/writes ~/.config/mcp/config.enc with the same format as the TS version.
"""

import asyncio
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from platformdirs import user_config_dir

from mcp_relay_core.storage.encryption import (
    LEGACY_PBKDF2_ITERATIONS,
    PBKDF2_ITERATIONS,
    V1_LEGACY_PBKDF2_ITERATIONS,
    decrypt_data,
    derive_file_key,
    derive_passphrase_key,
    encrypt_data,
)
from mcp_relay_core.storage.machine_id import get_machine_id, get_username

_DEFAULT_CONFIG_PATH = Path(user_config_dir("mcp", appauthor=False)) / "config.enc"
_MAX_RETRIES = 3
_BASE_DELAY_S = 0.1

# Allow overriding config path for testing
_config_path_override: str | None = None


def set_config_path(path: str | None) -> None:
    """Override config file path (for testing). Pass None to reset."""
    global _config_path_override
    _config_path_override = path


def _get_config_path() -> Path:
    if _config_path_override is not None:
        return Path(_config_path_override)
    return _DEFAULT_CONFIG_PATH


async def _get_key() -> bytes:
    machine_id = await asyncio.to_thread(get_machine_id)
    username = await asyncio.to_thread(get_username)
    return await asyncio.to_thread(derive_file_key, machine_id, username)


async def _with_retry[T](fn: Callable[[], T]) -> T:
    """Retry function on file busy errors."""
    for attempt in range(_MAX_RETRIES):
        try:
            return await asyncio.to_thread(fn)
        except OSError as err:
            is_busy = getattr(err, "errno", None) in (11, 16, 35)  # EAGAIN, EBUSY, etc
            if not is_busy or attempt == _MAX_RETRIES - 1:
                raise
            await asyncio.sleep(_BASE_DELAY_S * (2**attempt))
    msg = "Unreachable"
    raise RuntimeError(msg)


async def _load_store() -> dict[str, Any]:
    config_path = _get_config_path()
    if not await asyncio.to_thread(config_path.exists):
        return {"version": 1, "servers": {}}

    machine_id = await asyncio.to_thread(get_machine_id)
    username = await asyncio.to_thread(get_username)
    data = await asyncio.to_thread(config_path.read_bytes)

    # Try 1M -> 600k -> 100k iterations
    for iters in [
        PBKDF2_ITERATIONS,
        LEGACY_PBKDF2_ITERATIONS,
        V1_LEGACY_PBKDF2_ITERATIONS,
    ]:
        try:
            key = await asyncio.to_thread(derive_file_key, machine_id, username, iters)
            json_str = await asyncio.to_thread(decrypt_data, key, data)
            store = await asyncio.to_thread(json.loads, json_str)

            if iters != PBKDF2_ITERATIONS:
                # Auto-migrate to current iterations
                await _save_store(store)
            return store
        except Exception:
            if iters == V1_LEGACY_PBKDF2_ITERATIONS:
                raise
            continue

    msg = "Unreachable"
    raise RuntimeError(msg)


async def _save_store(store: dict[str, Any]) -> None:
    config_path = _get_config_path()
    await asyncio.to_thread(config_path.parent.mkdir, parents=True, exist_ok=True)
    key = await _get_key()
    json_str = await asyncio.to_thread(json.dumps, store)
    encrypted = await asyncio.to_thread(encrypt_data, key, json_str)

    def _write() -> None:
        config_path.write_bytes(encrypted)

    await _with_retry(_write)


async def read_config(server_name: str) -> dict[str, str] | None:
    """Read config for a server.

    Args:
        server_name: Server identifier.

    Returns:
        Config dict or None if not found.
    """
    store = await _load_store()
    return store["servers"].get(server_name)


async def write_config(server_name: str, config: dict[str, str]) -> None:
    """Write config for a server (merges with existing servers).

    Args:
        server_name: Server identifier.
        config: Key-value config dict.
    """
    store = await _load_store()
    store["servers"][server_name] = config
    await _save_store(store)


async def delete_config(server_name: str) -> None:
    """Delete config for a server.

    Removes the config file entirely if no servers remain.

    Args:
        server_name: Server identifier.
    """
    store = await _load_store()
    store["servers"].pop(server_name, None)

    config_path = _get_config_path()
    if not store["servers"]:
        if await asyncio.to_thread(config_path.exists):
            await asyncio.to_thread(config_path.unlink)
    else:
        await _save_store(store)


async def list_configs() -> list[str]:
    """List all configured server names.

    Returns:
        List of server name strings.
    """
    store = await _load_store()
    return list(store["servers"].keys())


async def export_config(passphrase: str) -> bytes:
    """Export all configs encrypted with a passphrase.

    Args:
        passphrase: Passphrase to encrypt export data.

    Returns:
        Encrypted bytes.
    """
    store = await _load_store()
    key = await asyncio.to_thread(derive_passphrase_key, passphrase)
    json_str = await asyncio.to_thread(json.dumps, store)
    return await asyncio.to_thread(encrypt_data, key, json_str)


async def import_config(passphrase: str, data: bytes) -> None:
    """Import configs from encrypted export data, merging into local config.

    Args:
        passphrase: Passphrase to decrypt import data.
        data: Encrypted bytes from export_config.

    Raises:
        cryptography.exceptions.InvalidTag: If passphrase is wrong.
    """
    # Try 1M -> 600k -> 100k iterations
    imported = None
    last_err = None
    for iters in [
        PBKDF2_ITERATIONS,
        LEGACY_PBKDF2_ITERATIONS,
        V1_LEGACY_PBKDF2_ITERATIONS,
    ]:
        try:
            key = await asyncio.to_thread(derive_passphrase_key, passphrase, iters)
            json_str = await asyncio.to_thread(decrypt_data, key, data)
            imported = await asyncio.to_thread(json.loads, json_str)
            break
        except Exception as err:
            last_err = err
            continue

    if imported is None:
        if last_err:
            raise last_err
        msg = "Import failed"
        raise RuntimeError(msg)

    store = await _load_store()
    for name, config in imported["servers"].items():
        store["servers"][name] = config
    await _save_store(store)
