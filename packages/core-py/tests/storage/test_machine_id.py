"""Tests for machine ID and username detection."""

import os
from unittest.mock import MagicMock, mock_open, patch

from mcp_relay_core.storage.machine_id import (
    _get_first_mac,
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
    @patch("builtins.open", new_callable=mock_open, read_data="linux-machine-id\n")
    def test_linux_id(self, mock_file, mock_system):
        mid = get_machine_id()
        assert mid == "linux-machine-id"
        mock_file.assert_called_once_with("/etc/machine-id")

    @patch("platform.system", return_value="Darwin")
    @patch("subprocess.run")
    def test_darwin_id(self, mock_run, mock_system):
        mock_run.return_value = MagicMock(
            stdout='"IOPlatformUUID" = "darwin-uuid"\n', returncode=0
        )
        mid = get_machine_id()
        assert mid == "darwin-uuid"
        mock_run.assert_called_once()
        assert "ioreg" in mock_run.call_args[0][0]

    @patch("platform.system", return_value="Darwin")
    @patch("subprocess.run", side_effect=Exception("ioreg failed"))
    @patch("socket.gethostname", return_value="test-host")
    @patch(
        "mcp_relay_core.storage.machine_id._get_first_mac",
        return_value="00:11:22:33:44:55",
    )
    def test_darwin_id_failure_fallback(
        self, mock_mac, mock_hostname, mock_run, mock_system
    ):
        mid = get_machine_id()
        assert mid == "test-host-00:11:22:33:44:55"

    @patch("platform.system", return_value="Windows")
    @patch("subprocess.run")
    def test_windows_id(self, mock_run, mock_system):
        mock_run.return_value = MagicMock(
            stdout="MachineGuid    REG_SZ    windows-guid\n", returncode=0
        )
        mid = get_machine_id()
        assert mid == "windows-guid"
        mock_run.assert_called_once()
        assert "reg" in mock_run.call_args[0][0]

    @patch("platform.system", return_value="Windows")
    @patch("subprocess.run", side_effect=Exception("reg failed"))
    @patch("socket.gethostname", return_value="test-host")
    @patch(
        "mcp_relay_core.storage.machine_id._get_first_mac",
        return_value="00:11:22:33:44:55",
    )
    def test_windows_id_failure_fallback(
        self, mock_mac, mock_hostname, mock_run, mock_system
    ):
        mid = get_machine_id()
        assert mid == "test-host-00:11:22:33:44:55"

    @patch("platform.system", return_value="Unknown")
    @patch("socket.gethostname", return_value="test-host")
    @patch(
        "mcp_relay_core.storage.machine_id._get_first_mac",
        return_value="00:11:22:33:44:55",
    )
    def test_fallback_id(self, mock_mac, mock_hostname, mock_system):
        mid = get_machine_id()
        assert mid == "test-host-00:11:22:33:44:55"

    @patch("platform.system", return_value="Linux")
    @patch("builtins.open", side_effect=Exception("Permission denied"))
    @patch("socket.gethostname", return_value="test-host")
    @patch(
        "mcp_relay_core.storage.machine_id._get_first_mac",
        return_value="00:11:22:33:44:55",
    )
    def test_linux_fallback_on_failure(
        self, mock_mac, mock_hostname, mock_open, mock_system
    ):
        mid = get_machine_id()
        assert mid == "test-host-00:11:22:33:44:55"


class TestGetFirstMac:
    @patch("uuid.getnode", return_value=0x0223456789AB)
    def test_valid_mac(self, mock_uuid):
        # 02:23:45:67:89:ab has bit 40 = 0 (since 0x02 & 1 == 0)
        assert _get_first_mac() == "02:23:45:67:89:ab"

    @patch("uuid.getnode", return_value=0x0123456789AB)
    def test_random_mac(self, mock_uuid):
        # 01:23:45:67:89:ab has bit 40 = 1
        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode", return_value=0)
    def test_zero_mac(self, mock_uuid):
        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode", side_effect=Exception("uuid failed"))
    def test_mac_exception(self, mock_uuid):
        assert _get_first_mac() == "unknown"


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

    @patch("getpass.getuser", side_effect=Exception("getuser failed"))
    @patch.dict(os.environ, {"USER": "test-user"}, clear=True)
    def test_getuser_failure_env_user(self, mock_getuser):
        assert get_username() == "test-user"

    @patch("getpass.getuser", side_effect=Exception("getuser failed"))
    @patch.dict(os.environ, {"USERNAME": "test-username"}, clear=True)
    def test_getuser_failure_env_username(self, mock_getuser):
        assert get_username() == "test-username"

    @patch("getpass.getuser", side_effect=Exception("getuser failed"))
    @patch.dict(os.environ, {}, clear=True)
    def test_getuser_failure_no_env(self, mock_getuser):
        assert get_username() == "unknown"
