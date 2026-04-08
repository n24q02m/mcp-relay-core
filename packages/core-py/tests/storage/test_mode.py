"""Tests for server mode management."""

import pytest

from mcp_relay_core.storage.config_file import (
    read_config,
    set_config_path,
    write_config,
)
from mcp_relay_core.storage.mode import clear_mode, get_mode, set_local_mode


@pytest.fixture(autouse=True)
def _temp_config(tmp_path):
    config_path = str(tmp_path / "config.enc")
    set_config_path(config_path)
    yield tmp_path
    set_config_path(None)


class TestMode:
    async def test_defaults_to_none_when_no_config(self):
        assert await get_mode("test-server") is None

    async def test_set_local_mode_persists_marker(self):
        await set_local_mode("test-server")
        assert await get_mode("test-server") == "local"

        # Verify exact config content
        config = await read_config("test-server")
        assert config == {"_mode": "local"}

    async def test_returns_configured_when_other_keys_present(self):
        await write_config("test-server", {"api_key": "secret123"})
        assert await get_mode("test-server") == "configured"

    async def test_configured_priority_over_local(self):
        # Even if _mode: local is there, if other keys exist, it's "configured"
        await write_config(
            "test-server",
            {"_mode": "local", "api_key": "key123", "base_url": "https://api"},
        )
        assert await get_mode("test-server") == "configured"

    async def test_other_mode_values_count_as_configured(self):
        await write_config(
            "test-server", {"_mode": "something-else", "api_key": "key123"}
        )
        assert await get_mode("test-server") == "configured"

        # Even with ONLY an unknown mode value, it's configured (unexpected state)
        await write_config("test-server", {"_mode": "unknown"})
        assert await get_mode("test-server") == "configured"

    async def test_clear_mode_removes_entry(self):
        await set_local_mode("test-server")
        await clear_mode("test-server")
        assert await get_mode("test-server") is None
        assert await read_config("test-server") is None

    async def test_multiple_servers_have_independent_modes(self):
        await set_local_mode("server-a")
        await write_config("server-b", {"api_key": "key"})

        assert await get_mode("server-a") == "local"
        assert await get_mode("server-b") == "configured"
