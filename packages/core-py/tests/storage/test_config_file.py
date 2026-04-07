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
    async def test_success_on_first_attempt(self):
        fn = MagicMock(return_value="success")
        result = await _with_retry(fn)
        assert result == "success"
        assert fn.call_count == 1

    async def test_success_after_retries(self):
        fn = MagicMock()
        fn.side_effect = [OSError(11, "EAGAIN"), OSError(16, "EBUSY"), "success"]

        with patch("asyncio.sleep") as mock_sleep:
            result = await _with_retry(fn)
            assert result == "success"
            assert fn.call_count == 3
            assert mock_sleep.call_count == 2
            mock_sleep.assert_any_call(0.1)
            mock_sleep.assert_any_call(0.2)

    async def test_exhaust_retries_raises_last_error(self):
        fn = MagicMock()
        fn.side_effect = OSError(35, "EWOULDBLOCK")

        with patch("asyncio.sleep"):
            with pytest.raises(OSError) as excinfo:
                await _with_retry(fn)
            assert excinfo.value.errno == 35
            assert fn.call_count == 3

    async def test_immediate_raise_on_non_retryable_oserror(self):
        fn = MagicMock()
        fn.side_effect = OSError(1, "EPERM")

        with patch("asyncio.sleep") as mock_sleep:
            with pytest.raises(OSError) as excinfo:
                await _with_retry(fn)
            assert excinfo.value.errno == 1
            assert fn.call_count == 1
            assert mock_sleep.call_count == 0

    async def test_immediate_raise_on_other_exception(self):
        fn = MagicMock()
        fn.side_effect = ValueError("wrong value")

        with patch("asyncio.sleep") as mock_sleep:
            with pytest.raises(ValueError, match="wrong value"):
                await _with_retry(fn)
            assert fn.call_count == 1
            assert mock_sleep.call_count == 0


class TestWriteAndReadConfig:
    async def test_writes_and_reads_a_server_config(self):
        await write_config("telegram", {"botToken": "abc123", "chatId": "456"})
        config = await read_config("telegram")
        assert config == {"botToken": "abc123", "chatId": "456"}

    async def test_returns_none_for_non_existent_server(self):
        config = await read_config("nonexistent")
        assert config is None

    async def test_returns_none_when_no_config_file_exists(self):
        config = await read_config("anything")
        assert config is None


class TestWriteConfigMerging:
    async def test_does_not_overwrite_other_servers(self):
        await write_config("telegram", {"botToken": "tok1"})
        await write_config("slack", {"webhook": "https://example.com"})

        telegram = await read_config("telegram")
        slack = await read_config("slack")
        assert telegram == {"botToken": "tok1"}
        assert slack == {"webhook": "https://example.com"}

    async def test_overwrites_same_server_on_second_write(self):
        await write_config("telegram", {"botToken": "old"})
        await write_config("telegram", {"botToken": "new", "extra": "field"})

        config = await read_config("telegram")
        assert config == {"botToken": "new", "extra": "field"}


class TestDeleteConfig:
    async def test_removes_a_server_section(self):
        await write_config("telegram", {"botToken": "tok"})
        await write_config("slack", {"webhook": "url"})

        await delete_config("telegram")

        assert await read_config("telegram") is None
        assert await read_config("slack") == {"webhook": "url"}

    async def test_deletes_file_when_last_server_removed(self, _temp_config):
        await write_config("telegram", {"botToken": "tok"})
        await delete_config("telegram")

        assert not (_temp_config / "config.enc").exists()

    async def test_no_op_for_non_existent_server(self):
        await write_config("telegram", {"botToken": "tok"})
        await delete_config("nonexistent")
        assert await read_config("telegram") == {"botToken": "tok"}


class TestListConfigs:
    async def test_returns_empty_list_when_no_config(self):
        assert await list_configs() == []

    async def test_returns_list_of_server_names(self):
        await write_config("telegram", {"a": "1"})
        await write_config("slack", {"b": "2"})
        await write_config("discord", {"c": "3"})

        names = sorted(await list_configs())
        assert names == ["discord", "slack", "telegram"]


class TestExportImportConfig:
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

    async def test_wrong_passphrase_fails_to_import(self):
        await write_config("telegram", {"botToken": "abc"})
        exported = await export_config("correct-pass")

        with pytest.raises(InvalidTag):
            await import_config("wrong-pass", exported)

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
