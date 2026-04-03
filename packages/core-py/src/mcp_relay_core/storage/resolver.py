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


def _get_env_key(server_name: str, field: str) -> str:
    """Generate environment variable key for a field."""
    return (
        "MCP_"
        + re.sub(r"-", "_", server_name).upper()
        + "_"
        + re.sub(r"-", "_", field).upper()
    )


def _is_complete(config: dict[str, str] | None, required_fields: list[str]) -> bool:
    """Check if config contains all required fields with non-empty values."""
    if config is None:
        return False
    return all(f in config and config[f] != "" for f in required_fields)


def _resolve_from_env(
    server_name: str, required_fields: list[str]
) -> dict[str, str] | None:
    """Attempt to resolve all required fields from environment variables."""
    if not required_fields:
        return None

    config: dict[str, str] = {}
    for field in required_fields:
        value = os.environ.get(_get_env_key(server_name, field), "")
        if not value:
            return None
        config[field] = value
    return config


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
    file_config = read_config(server_name)
    if _is_complete(file_config, required_fields):
        return ResolvedConfig(config=file_config, source="file")

    # 3. Check defaults
    if _is_complete(defaults, required_fields):
        # defaults is not None if _is_complete is True
        return ResolvedConfig(config={**defaults}, source="defaults")  # type: ignore

    # 4. Nothing found
    return ResolvedConfig(config=None, source=None)
