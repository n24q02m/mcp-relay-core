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
    yield
    set_config_path(None)


class TestSetLocalMode:
    @pytest.mark.asyncio
    async def test_writes_mode_marker(self):
        await set_local_mode("test-server")

        config = await read_config("test-server")
        assert config is not None
        assert config["_mode"] == "local"

    @pytest.mark.asyncio
    async def test_overwrites_existing_config(self):
        await write_config("test-server", {"api_key": "secret123"})
        await set_local_mode("test-server")

        config = await read_config("test-server")
        assert config == {"_mode": "local"}


class TestGetMode:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_config(self):
        result = await get_mode("test-server")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_local_when_local_mode_set(self):
        await set_local_mode("test-server")
        result = await get_mode("test-server")
        assert result == "local"

    @pytest.mark.asyncio
    async def test_returns_configured_when_has_real_keys(self):
        await write_config(
            "test-server", {"api_key": "key123", "base_url": "https://api"}
        )
        result = await get_mode("test-server")
        assert result == "configured"

    @pytest.mark.asyncio
    async def test_returns_configured_with_mixed_keys(self):
        await write_config(
            "test-server", {"_mode": "something-else", "api_key": "key123"}
        )
        result = await get_mode("test-server")
        assert result == "configured"

    @pytest.mark.asyncio
    async def test_returns_none_with_empty_mode_value(self):
        await write_config("test-server", {"_mode": "unknown"})
        result = await get_mode("test-server")
        # Has _mode but not "local", and no other keys
        assert result is None


class TestClearMode:
    @pytest.mark.asyncio
    async def test_removes_config_entry(self):
        await set_local_mode("test-server")
        assert await get_mode("test-server") == "local"

        await clear_mode("test-server")
        assert await get_mode("test-server") is None

    @pytest.mark.asyncio
    async def test_removes_configured_entry(self):
        await write_config("test-server", {"api_key": "key123"})
        assert await get_mode("test-server") == "configured"

        await clear_mode("test-server")
        assert await get_mode("test-server") is None

    @pytest.mark.asyncio
    async def test_no_error_when_no_config(self):
        # Should not raise
        await clear_mode("nonexistent-server")


class TestModeIndependence:
    @pytest.mark.asyncio
    async def test_different_servers_have_independent_modes(self):
        await set_local_mode("server-a")
        await write_config("server-b", {"api_key": "key"})

        assert await get_mode("server-a") == "local"
        assert await get_mode("server-b") == "configured"
        assert await get_mode("server-c") is None

    @pytest.mark.asyncio
    async def test_clearing_one_server_does_not_affect_others(self):
        await set_local_mode("server-a")
        await set_local_mode("server-b")

        await clear_mode("server-a")

        assert await get_mode("server-a") is None
        assert await get_mode("server-b") == "local"
