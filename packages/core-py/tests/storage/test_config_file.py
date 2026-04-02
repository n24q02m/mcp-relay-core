"""Tests for encrypted config file management."""

import json

import pytest
from cryptography.exceptions import InvalidTag

from mcp_relay_core.storage.config_file import (
    delete_config,
    export_config,
    import_config,
    list_configs,
    read_config,
    set_config_path,
    write_config,
)
from mcp_relay_core.storage.encryption import (
    decrypt_data,
    derive_file_key,
    encrypt_data,
)
from mcp_relay_core.storage.machine_id import get_machine_id, get_username


@pytest.fixture(autouse=True)
def _temp_config(tmp_path):
    config_path = str(tmp_path / "config.enc")
    set_config_path(config_path)
    yield tmp_path
    set_config_path(None)


class TestWriteAndReadConfig:
    def test_writes_and_reads_a_server_config(self):
        write_config("telegram", {"botToken": "abc123", "chatId": "456"})
        config = read_config("telegram")
        assert config == {"botToken": "abc123", "chatId": "456"}

    def test_returns_none_for_non_existent_server(self):
        config = read_config("nonexistent")
        assert config is None

    def test_returns_none_when_no_config_file_exists(self):
        config = read_config("anything")
        assert config is None


class TestWriteConfigMerging:
    def test_does_not_overwrite_other_servers(self):
        write_config("telegram", {"botToken": "tok1"})
        write_config("slack", {"webhook": "https://example.com"})

        telegram = read_config("telegram")
        slack = read_config("slack")
        assert telegram == {"botToken": "tok1"}
        assert slack == {"webhook": "https://example.com"}

    def test_overwrites_same_server_on_second_write(self):
        write_config("telegram", {"botToken": "old"})
        write_config("telegram", {"botToken": "new", "extra": "field"})

        config = read_config("telegram")
        assert config == {"botToken": "new", "extra": "field"}


class TestDeleteConfig:
    def test_removes_a_server_section(self):
        write_config("telegram", {"botToken": "tok"})
        write_config("slack", {"webhook": "url"})

        delete_config("telegram")

        assert read_config("telegram") is None
        assert read_config("slack") == {"webhook": "url"}

    def test_deletes_file_when_last_server_removed(self, _temp_config):
        write_config("telegram", {"botToken": "tok"})
        delete_config("telegram")

        assert not (_temp_config / "config.enc").exists()

    def test_no_op_for_non_existent_server(self):
        write_config("telegram", {"botToken": "tok"})
        delete_config("nonexistent")
        assert read_config("telegram") == {"botToken": "tok"}


class TestListConfigs:
    def test_returns_empty_list_when_no_config(self):
        assert list_configs() == []

    def test_returns_list_of_server_names(self):
        write_config("telegram", {"a": "1"})
        write_config("slack", {"b": "2"})
        write_config("discord", {"c": "3"})

        names = sorted(list_configs())
        assert names == ["discord", "slack", "telegram"]


class TestExportImportConfig:
    def test_roundtrip_with_passphrase(self):
        write_config("telegram", {"botToken": "abc"})
        write_config("slack", {"webhook": "url"})

        exported = export_config("my-secret-passphrase")
        assert isinstance(exported, bytes)

        # Clear local config
        delete_config("telegram")
        delete_config("slack")
        assert list_configs() == []

        # Import back
        import_config("my-secret-passphrase", exported)
        assert read_config("telegram") == {"botToken": "abc"}
        assert read_config("slack") == {"webhook": "url"}

    def test_wrong_passphrase_fails_to_import(self):
        write_config("telegram", {"botToken": "abc"})
        exported = export_config("correct-pass")

        with pytest.raises(InvalidTag):
            import_config("wrong-pass", exported)

    def test_import_merges_into_existing_config(self):
        write_config("local-server", {"key": "local-val"})

        # Create export data
        write_config("remote-server", {"key": "remote-val"})
        exported = export_config("pass")

        # Remove remote, keep local
        delete_config("remote-server")
        assert list_configs() == ["local-server"]

        # Import should merge
        import_config("pass", exported)
        assert read_config("local-server") == {"key": "local-val"}
        assert read_config("remote-server") == {"key": "remote-val"}


def test_automatically_migrates_legacy_100k_iteration_config_to_600k(tmp_path):
    config_path = tmp_path / "migration-test.enc"
    set_config_path(str(config_path))

    legacy_iterations = 100_000
    machine_id = get_machine_id()
    username = get_username()
    legacy_key = derive_file_key(machine_id, username, legacy_iterations)

    store = {"version": 1, "servers": {"legacy-srv": {"key": "val"}}}
    encrypted = encrypt_data(legacy_key, json.dumps(store))
    config_path.write_bytes(encrypted)

    # First load should work due to fallback, and it should trigger migration
    read_store = read_config("legacy-srv")
    assert read_store == {"key": "val"}

    # Verify file was re-encrypted with new iterations (should NOT be decryptable with legacy key)
    new_data = config_path.read_bytes()
    with pytest.raises(InvalidTag):
        decrypt_data(legacy_key, new_data)

    # Should be decryptable with new default iterations
    new_key = derive_file_key(machine_id, username)
    decrypted_json = decrypt_data(new_key, new_data)
    assert json.loads(decrypted_json) == store

    set_config_path(None)
