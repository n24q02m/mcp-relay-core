"""Tests for encrypted config file management."""

from unittest.mock import MagicMock, patch

import pytest
from cryptography.exceptions import InvalidTag

from mcp_relay_core.storage.config_file import (
    _with_retry,
    delete_config,
    export_config,
    import_config,
    list_configs,
    read_config,
    set_config_path,
    write_config,
)


@pytest.fixture(autouse=True)
def _temp_config(tmp_path):
    config_path = str(tmp_path / "config.enc")
    set_config_path(config_path)
    yield tmp_path
    set_config_path(None)


class TestWithRetry:
    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self):
        fn = MagicMock(return_value="success")
        result = await _with_retry(fn)
        assert result == "success"
        assert fn.call_count == 1

    @pytest.mark.asyncio
    async def test_success_after_retries(self):
        fn = MagicMock()
        fn.side_effect = [OSError(11, "EAGAIN"), OSError(16, "EBUSY"), "success"]

        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            result = await _with_retry(fn)
            assert result == "success"
            assert fn.call_count == 3
            assert mock_sleep.call_count == 2

    @pytest.mark.asyncio
    async def test_exhaust_retries_raises_last_error(self):
        fn = MagicMock()
        fn.side_effect = OSError(35, "EWOULDBLOCK")

        with patch("asyncio.sleep", return_value=None):
            with pytest.raises(OSError) as exc:
                await _with_retry(fn)
            assert exc.value.errno == 35


class TestConfigFile:
    @pytest.mark.asyncio
    async def test_roundtrip(self):
        await write_config("telegram", {"botToken": "abc"})
        config = await read_config("telegram")
        assert config == {"botToken": "abc"}

    @pytest.mark.asyncio
    async def test_non_existent_server_returns_none(self):
        config = await read_config("nonexistent")
        assert config is None

    @pytest.mark.asyncio
    async def test_multiple_servers(self):
        await write_config("telegram", {"botToken": "abc"})
        await write_config("slack", {"webhook": "url"})

        assert await read_config("telegram") == {"botToken": "abc"}
        assert await read_config("slack") == {"webhook": "url"}

    @pytest.mark.asyncio
    async def test_overwrite_config(self):
        await write_config("telegram", {"botToken": "old"})
        await write_config("telegram", {"botToken": "new"})
        assert await read_config("telegram") == {"botToken": "new"}

    @pytest.mark.asyncio
    async def test_delete_config(self):
        await write_config("telegram", {"botToken": "tok"})
        await write_config("slack", {"webhook": "url"})

        await delete_config("telegram")

        assert await read_config("telegram") is None
        assert await read_config("slack") == {"webhook": "url"}

    @pytest.mark.asyncio
    async def test_deletes_file_when_last_server_removed(self, _temp_config):
        await write_config("telegram", {"botToken": "tok"})
        await delete_config("telegram")

        assert not (_temp_config / "config.enc").exists()

    @pytest.mark.asyncio
    async def test_no_op_for_non_existent_server(self):
        await write_config("telegram", {"botToken": "tok"})
        await delete_config("nonexistent")
        assert await read_config("telegram") == {"botToken": "tok"}


class TestListConfigs:
    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_config(self):
        assert await list_configs() == []

    @pytest.mark.asyncio
    async def test_returns_list_of_server_names(self):
        await write_config("telegram", {"a": "1"})
        await write_config("slack", {"b": "2"})
        await write_config("discord", {"c": "3"})

        names = sorted(await list_configs())
        assert names == ["discord", "slack", "telegram"]


class TestExportImportConfig:
    @pytest.mark.asyncio
    async def test_roundtrip_with_passphrase(self):
        await write_config("telegram", {"botToken": "abc"})
        await write_config("slack", {"webhook": "url"})

        exported = await export_config("my-secret-passphrase")
        assert isinstance(exported, bytes)

        # Clear local config
        await delete_config("telegram")
        await delete_config("slack")
        assert await list_configs() == []

        # Import back
        await import_config("my-secret-passphrase", exported)
        assert await read_config("telegram") == {"botToken": "abc"}
        assert await read_config("slack") == {"webhook": "url"}

    @pytest.mark.asyncio
    async def test_wrong_passphrase_fails_to_import(self):
        await write_config("telegram", {"botToken": "abc"})
        exported = await export_config("correct-pass")

        with pytest.raises(InvalidTag):
            await import_config("wrong-pass", exported)

    @pytest.mark.asyncio
    async def test_import_merges_into_existing_config(self):
        await write_config("local-server", {"key": "local-val"})

        # Create export data
        await write_config("remote-server", {"key": "remote-val"})
        exported = await export_config("pass")

        # Remove remote, keep local
        await delete_config("remote-server")
        assert await list_configs() == ["local-server"]

        # Import should merge
        await import_config("pass", exported)
        assert await read_config("local-server") == {"key": "local-val"}
        assert await read_config("remote-server") == {"key": "remote-val"}


class TestPBKDF2Migration:
    @pytest.mark.asyncio
    async def test_auto_migrates_legacy_config(self, _temp_config):
        import json

        from mcp_relay_core.storage.encryption import (
            LEGACY_PBKDF2_ITERATIONS,
            PBKDF2_ITERATIONS,
            decrypt_data,
            derive_file_key,
            encrypt_data,
        )
        from mcp_relay_core.storage.machine_id import get_machine_id, get_username

        machine_id = get_machine_id()
        username = get_username()
        legacy_key = derive_file_key(machine_id, username, LEGACY_PBKDF2_ITERATIONS)
        store = {"version": 1, "servers": {"legacy": {"key": "value"}}}
        encrypted = encrypt_data(legacy_key, json.dumps(store))

        config_path = _temp_config / "config.enc"
        config_path.write_bytes(encrypted)

        # Reading should trigger auto-migration
        config = await read_config("legacy")
        assert config == {"key": "value"}

        # Verify file is now encrypted with current iterations
        new_data = config_path.read_bytes()
        current_key = derive_file_key(machine_id, username, PBKDF2_ITERATIONS)
        decrypted = decrypt_data(current_key, new_data)
        assert json.loads(decrypted) == store

        # Legacy key should no longer decrypt
        with pytest.raises(InvalidTag):
            decrypt_data(legacy_key, new_data)
