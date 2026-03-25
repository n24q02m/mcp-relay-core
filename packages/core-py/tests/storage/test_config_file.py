"""Tests for encrypted config file management."""

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
