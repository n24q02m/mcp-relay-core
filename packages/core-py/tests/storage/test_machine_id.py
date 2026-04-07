"""Tests for machine ID and username detection."""

import os
from unittest.mock import MagicMock, mock_open, patch

from mcp_relay_core.storage.machine_id import (
    _get_darwin_id,
    _get_first_mac,
    _get_linux_id,
    _get_windows_id,
    get_machine_id,
    get_username,
)


class TestGetMachineId:
    def test_returns_non_empty_string(self):
        mid = get_machine_id()
        assert mid
        assert isinstance(mid, str)
        assert len(mid) > 0

    def test_returns_consistent_value(self):
        id1 = get_machine_id()
        id2 = get_machine_id()
        assert id1 == id2

    @patch("platform.system", return_value="Linux")
    @patch("mcp_relay_core.storage.machine_id._get_linux_id", return_value="linux-id")
    def test_linux_id(self, mock_linux, mock_system):
        assert get_machine_id() == "linux-id"
        mock_linux.assert_called_once()

    @patch("platform.system", return_value="Darwin")
    @patch("mcp_relay_core.storage.machine_id._get_darwin_id", return_value="darwin-id")
    def test_darwin_id(self, mock_darwin, mock_system):
        assert get_machine_id() == "darwin-id"
        mock_darwin.assert_called_once()

    @patch("platform.system", return_value="Windows")
    @patch(
        "mcp_relay_core.storage.machine_id._get_windows_id", return_value="windows-id"
    )
    def test_windows_id(self, mock_windows, mock_system):
        assert get_machine_id() == "windows-id"
        mock_windows.assert_called_once()

    @patch("platform.system", return_value="Linux")
    @patch("builtins.open", new_callable=mock_open, read_data="linux-machine-id\n")
    def test_get_linux_id_helper(self, mock_file, mock_system):
        assert _get_linux_id() == "linux-machine-id"
        mock_file.assert_called_once_with("/etc/machine-id")

    @patch("builtins.open", side_effect=OSError("File not found"))
    def test_get_linux_id_helper_error(self, mock_file):
        assert _get_linux_id() is None

    @patch("subprocess.run")
    def test_get_darwin_id_helper(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout='"IOPlatformUUID" = "darwin-uuid-123"\n', returncode=0
        )
        assert _get_darwin_id() == "darwin-uuid-123"
        mock_run.assert_called_once()

    @patch("subprocess.run", side_effect=Exception("Failed"))
    def test_get_darwin_id_helper_error(self, mock_run):
        assert _get_darwin_id() is None

    @patch("subprocess.run")
    def test_get_windows_id_helper(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout="MachineGuid    REG_SZ    windows-guid-456\n", returncode=0
        )
        assert _get_windows_id() == "windows-guid-456"
        mock_run.assert_called_once()

    @patch("subprocess.run", side_effect=Exception("Failed"))
    def test_get_windows_id_helper_error(self, mock_run):
        assert _get_windows_id() is None

    @patch("platform.system", return_value="Unknown")
    @patch("socket.gethostname", return_value="test-host")
    @patch(
        "mcp_relay_core.storage.machine_id._get_first_mac",
        return_value="00:11:22:33:44:55",
    )
    def test_fallback_id(self, mock_mac, mock_hostname, mock_system):
        assert get_machine_id() == "test-host-00:11:22:33:44:55"

    @patch("uuid.getnode", return_value=(1 << 40) | 0x123456789ABC)
    def test_get_first_mac_random(self, mock_uuid):
        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode", return_value=0)
    def test_get_first_mac_zero(self, mock_uuid):
        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode", side_effect=Exception("Failed"))
    def test_get_first_mac_error(self, mock_uuid):
        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode", return_value=0x001122334455)
    def test_get_first_mac_success(self, mock_uuid):
        assert _get_first_mac() == "00:11:22:33:44:55"


class TestGetUsername:
    def test_returns_non_empty_string(self):
        username = get_username()
        assert username
        assert isinstance(username, str)
        assert len(username) > 0

    def test_matches_current_os_user(self):
        username = get_username()
        expected = os.environ.get("USER") or os.environ.get("USERNAME")
        if expected:
            assert username == expected

    @patch("getpass.getuser", side_effect=Exception("Failed"))
    def test_get_username_fallback(self, mock_getuser):
        with patch.dict(os.environ, {"USER": "testuser"}):
            assert get_username() == "testuser"
        with patch.dict(os.environ, {"USERNAME": "testuser2"}, clear=True):
            assert get_username() == "testuser2"
        with patch.dict(os.environ, {}, clear=True):
            assert get_username() == "unknown"
