"""Config resolution: env vars -> config file -> defaults -> None."""

import os
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
    defaults_config = _resolve_from_defaults(required_fields, defaults)
    if defaults_config is not None:
        return ResolvedConfig(config=defaults_config, source="defaults")

    # 4. Nothing found
    return ResolvedConfig(config=None, source=None)


def _resolve_from_env(
    server_name: str,
    required_fields: list[str],
) -> dict[str, str] | None:
    """Resolve config from environment variables."""
    if not required_fields:
        return None

    server_prefix = "MCP_" + server_name.replace("-", "_").upper() + "_"
    env_config: dict[str, str] = {}

    for field in required_fields:
        env_key = server_prefix + field.replace("-", "_").upper()
        value = os.environ.get(env_key, "")
        if not value:
            return None
        env_config[field] = value

    return env_config


def _resolve_from_file(
    server_name: str,
    required_fields: list[str],
) -> dict[str, str] | None:
    """Resolve config from encrypted config file."""
    file_config = read_config(server_name)
    if file_config is None:
        return None

    for field in required_fields:
        if field not in file_config or file_config[field] == "":
            return None

    return file_config


def _resolve_from_defaults(
    required_fields: list[str],
    defaults: dict[str, str] | None,
) -> dict[str, str] | None:
    """Resolve config from provided defaults."""
    if defaults is None:
        return None

    for field in required_fields:
        if field not in defaults or defaults[field] == "":
            return None

    return {**defaults}
