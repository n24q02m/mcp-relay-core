"""Tests for server mode management."""

import pytest

from mcp_relay_core.storage.config_file import read_config, set_config_path
from mcp_relay_core.storage.mode import clear_mode, get_mode, set_local_mode


@pytest.fixture(autouse=True)
def _temp_config(tmp_path):
    config_path = str(tmp_path / "config.enc")
    set_config_path(config_path)
    yield tmp_path
    set_config_path(None)


class TestServerMode:
    async def test_set_local_mode_persists_marker(self):
        await set_local_mode("test-server")
        config = await read_config("test-server")
        assert config == {"_mode": "local"}

    async def test_get_mode_returns_none_for_empty_config(self):
        assert await get_mode("test-server") is None

    async def test_get_mode_returns_local_when_marker_present(self):
        await set_local_mode("test-server")
        assert await get_mode("test-server") == "local"

    async def test_get_mode_returns_configured_when_other_keys_present(self):
        from mcp_relay_core.storage.config_file import write_config

        await write_config("test-server", {"api_key": "123"})
        assert await get_mode("test-server") == "configured"

    async def test_clear_mode_removes_config_entry(self):
        await set_local_mode("test-server")
        assert await get_mode("test-server") == "local"

        await clear_mode("test-server")
        assert await get_mode("test-server") is None
        assert await read_config("test-server") is None
