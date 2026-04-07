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
    yield tmp_path
    set_config_path(None)


class TestResolveConfig:
    async def test_resolves_from_env_vars(self):
        with patch.dict(
            os.environ,
            {"MCP_TELEGRAM_BOT_TOKEN": "env-tok", "MCP_TELEGRAM_CHAT_ID": "env-id"},
        ):
            result = await resolve_config("telegram", ["bot_token", "chat_id"])
            assert result.source == "env"
            assert result.config == {"bot_token": "env-tok", "chat_id": "env-id"}

    async def test_resolves_from_config_file_if_env_missing(self):
        await write_config("telegram", {"bot_token": "file-tok", "chat_id": "file-id"})
        # No env vars set
        result = await resolve_config("telegram", ["bot_token", "chat_id"])
        assert result.source == "file"
        assert result.config == {"bot_token": "file-tok", "chat_id": "file-id"}

    async def test_resolves_from_defaults_if_env_and_file_missing(self):
        defaults = {"bot_token": "def-tok", "chat_id": "def-id"}
        result = await resolve_config("telegram", ["bot_token", "chat_id"], defaults)
        assert result.source == "defaults"
        assert result.config == defaults

    async def test_returns_none_if_all_missing(self):
        result = await resolve_config("telegram", ["bot_token", "chat_id"])
        assert result.source is None
        assert result.config is None

    async def test_handles_dashes_in_server_and_field_names(self):
        with patch.dict(os.environ, {"MCP_MY_SERVER_API_KEY": "abc"}):
            result = await resolve_config("my-server", ["api-key"])
            assert result.source == "env"
            assert result.config == {"api-key": "abc"}

    async def test_requires_all_fields_to_be_present_in_env(self):
        with patch.dict(os.environ, {"MCP_TELEGRAM_BOT_TOKEN": "tok"}):
            # Missing chat_id in env
            result = await resolve_config("telegram", ["bot_token", "chat_id"])
            assert result.source is None

    async def test_requires_all_fields_to_be_present_in_file(self):
        await write_config("telegram", {"bot_token": "tok"})
        # Missing chat_id in file
        result = await resolve_config("telegram", ["bot_token", "chat_id"])
        assert result.source is None

    async def test_prefers_env_over_file(self):
        await write_config("telegram", {"bot_token": "file-tok"})
        with patch.dict(os.environ, {"MCP_TELEGRAM_BOT_TOKEN": "env-tok"}):
            result = await resolve_config("telegram", ["bot_token"])
            assert result.source == "env"
            assert result.config == {"bot_token": "env-tok"}

    async def test_prefers_file_over_defaults(self):
        await write_config("telegram", {"bot_token": "file-tok"})
        defaults = {"bot_token": "def-tok"}
        result = await resolve_config("telegram", ["bot_token"], defaults)
        assert result.source == "file"
        assert result.config == {"bot_token": "file-tok"}
