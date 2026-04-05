"""Tests for config resolution."""

import os
from unittest.mock import patch

import pytest

from mcp_relay_core.storage.config_file import set_config_path, write_config
from mcp_relay_core.storage.resolver import resolve_config


@pytest.fixture(autouse=True)
def _temp_config(tmp_path):
    config_path = str(tmp_path / "config.enc")
    set_config_path(config_path)
    yield
    set_config_path(None)


class TestResolveConfig:
    async def test_resolves_from_env_vars_first(self):
        with patch.dict(
            os.environ,
            {"MCP_MY_SERVER_API_KEY": "env-key", "MCP_MY_SERVER_ENDPOINT": "env-end"},
        ):
            # Even if config file has it, env takes priority
            await write_config(
                "my-server", {"api_key": "file-key", "endpoint": "file-end"}
            )

            result = await resolve_config("my-server", ["api_key", "endpoint"])
            assert result.source == "env"
            assert result.config == {"api_key": "env-key", "endpoint": "env-end"}

    async def test_resolves_from_file_if_env_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            await write_config(
                "my-server", {"api_key": "file-key", "endpoint": "file-end"}
            )

            result = await resolve_config("my-server", ["api_key", "endpoint"])
            assert result.source == "file"
            assert result.config == {"api_key": "file-key", "endpoint": "file-end"}

    async def test_resolves_from_defaults_if_env_and_file_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            result = await resolve_config(
                "my-server",
                ["api_key", "endpoint"],
                defaults={"api_key": "def-key", "endpoint": "def-end"},
            )
            assert result.source == "defaults"
            assert result.config == {"api_key": "def-key", "endpoint": "def-end"}

    async def test_returns_none_if_all_sources_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            result = await resolve_config("my-server", ["api_key", "endpoint"])
            assert result.source is None
            assert result.config is None

    async def test_returns_none_if_source_has_incomplete_fields(self):
        # File has api_key but missing endpoint
        await write_config("my-server", {"api_key": "file-key"})

        result = await resolve_config("my-server", ["api_key", "endpoint"])
        assert result.config is None

    async def test_handles_hyphens_in_names_for_env_vars(self):
        with patch.dict(os.environ, {"MCP_MY_SERVER_API_KEY": "val"}):
            # my-server -> MY_SERVER, api-key -> API_KEY
            result = await resolve_config("my-server", ["api-key"])
            assert result.config == {"api-key": "val"}

    async def test_empty_env_var_is_treated_as_missing(self):
        with patch.dict(os.environ, {"MCP_MY_SERVER_API_KEY": ""}):
            result = await resolve_config("my-server", ["api_key"])
            assert result.config is None

    async def test_empty_defaults_is_treated_as_missing(self):
        result = await resolve_config(
            "my-server", ["api_key"], defaults={"api_key": ""}
        )
        assert result.config is None
