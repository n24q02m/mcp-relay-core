"""Config resolution: env vars -> config file -> defaults -> None."""

import os
import re
from typing import Literal

from mcp_relay_core.storage.config_file import read_config

ConfigSource = Literal["env", "file", "defaults"] | None


class ResolvedConfig:
    """Result of config resolution."""

    __slots__ = ("config", "source")

    def __init__(
        self,
        config: dict[str, str] | None,
        source: ConfigSource,
    ) -> None:
        self.config = config
        self.source = source


def resolve_config(
    server_name: str,
    required_fields: list[str],
    defaults: dict[str, str] | None = None,
) -> ResolvedConfig:
    """Resolve config from multiple sources in priority order.

    1. Environment variables (MCP_{SERVER}_{FIELD})
    2. Encrypted config file
    3. Provided defaults
    4. None (trigger relay setup)

    Args:
        server_name: Server identifier.
        required_fields: List of required field names.
        defaults: Optional default values.

    Returns:
        ResolvedConfig with config dict and source.
    """
    # 1. Check env vars
    env_config = _resolve_from_env(server_name, required_fields)
    if env_config is not None:
        return ResolvedConfig(config=env_config, source="env")

    # 2. Check config file
    file_config = _resolve_from_file(server_name, required_fields)
    if file_config is not None:
        return ResolvedConfig(config=file_config, source="file")

    # 3. Check defaults
    default_config = _resolve_from_defaults(required_fields, defaults)
    if default_config is not None:
        return ResolvedConfig(config=default_config, source="defaults")

    # 4. Nothing found
    return ResolvedConfig(config=None, source=None)


def _resolve_from_env(
    server_name: str, required_fields: list[str]
) -> dict[str, str] | None:
    """Try to resolve config from environment variables."""
    if not required_fields:
        return None

    config: dict[str, str] = {}
    for field in required_fields:
        env_key = (
            "MCP_"
            + re.sub(r"-", "_", server_name).upper()
            + "_"
            + re.sub(r"-", "_", field).upper()
        )
        value = os.environ.get(env_key, "")
        if not value:
            return None
        config[field] = value

    return config


def _resolve_from_file(
    server_name: str, required_fields: list[str]
) -> dict[str, str] | None:
    """Try to resolve config from the encrypted config file."""
    config = read_config(server_name)
    if config is None:
        return None

    has_all = all(f in config and config[f] != "" for f in required_fields)
    return config if has_all else None


def _resolve_from_defaults(
    required_fields: list[str], defaults: dict[str, str] | None
) -> dict[str, str] | None:
    """Try to resolve config from provided defaults."""
    if defaults is None:
        return None

    has_all = all(f in defaults and defaults[f] != "" for f in required_fields)
    return {**defaults} if has_all else None
