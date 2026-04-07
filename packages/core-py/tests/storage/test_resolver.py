"""Tests for config resolution."""

import os
import re
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
        env = {
            "MCP_TELEGRAM_BOT_TOKEN": "env-token",
            "MCP_TELEGRAM_CHAT_ID": "env-chat",
        }
        with patch.dict(os.environ, env):
            result = await resolve_config("telegram", ["bot_token", "chat_id"])
            assert result.source == "env"
            assert result.config == {"bot_token": "env-token", "chat_id": "env-chat"}

    async def test_env_vars_priority_over_file(self):
        await write_config("telegram", {"bot_token": "file-token", "chat_id": "file-chat"})
        env = {"MCP_TELEGRAM_BOT_TOKEN": "env-token", "MCP_TELEGRAM_CHAT_ID": "env-chat"}
        with patch.dict(os.environ, env):
            result = await resolve_config("telegram", ["bot_token", "chat_id"])
            assert result.source == "env"
            assert result.config["bot_token"] == "env-token"

    async def test_resolves_from_file_if_env_incomplete(self):
        await write_config("telegram", {"bot_token": "file-token", "chat_id": "file-chat"})
        # Only one env var present
        env = {"MCP_TELEGRAM_BOT_TOKEN": "env-token"}
        with patch.dict(os.environ, env):
            result = await resolve_config("telegram", ["bot_token", "chat_id"])
            assert result.source == "file"
            assert result.config["bot_token"] == "file-token"

    async def test_resolves_from_defaults_if_file_incomplete(self):
        await write_config("telegram", {"bot_token": "file-token"})
        defaults = {"bot_token": "def-token", "chat_id": "def-chat"}
        result = await resolve_config("telegram", ["bot_token", "chat_id"], defaults)
        assert result.source == "defaults"
        assert result.config["chat_id"] == "def-chat"

    async def test_returns_none_if_all_sources_incomplete(self):
        await write_config("telegram", {"bot_token": ""})
        result = await resolve_config("telegram", ["bot_token", "chat_id"])
        assert result.source is None
        assert result.config is None

    async def test_handles_hyphenated_server_names_in_env(self):
        # my-server -> MCP_MY_SERVER_API_KEY
        env = {"MCP_MY_SERVER_API_KEY": "secret"}
        with patch.dict(os.environ, env):
            result = await resolve_config("my-server", ["api_key"])
            assert result.source == "env"
            assert result.config["api_key"] == "secret"

    async def test_skips_empty_string_values_in_file(self):
        await write_config("telegram", {"bot_token": ""})
        result = await resolve_config("telegram", ["bot_token"])
        assert result.source is None

    async def test_accepts_non_empty_values_in_file(self):
        await write_config("telegram", {"bot_token": "valid"})
        result = await resolve_config("telegram", ["bot_token"])
        assert result.source == "file"
