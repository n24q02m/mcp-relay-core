"""Unit tests for machine ID platform-specific logic."""

import subprocess
from unittest.mock import MagicMock, patch

from mcp_relay_core.storage.machine_id import (
    _get_darwin_id,
    _get_linux_id,
    _get_windows_id,
    get_machine_id,
)


class TestMachineIdUnit:
    @patch("os.path.exists")
    @patch("builtins.open")
    def test_get_linux_id_success(self, mock_open, mock_exists):
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = (
            "linux-machine-id\n"
        )
        assert _get_linux_id() == "linux-machine-id"

    @patch("os.path.exists")
    def test_get_linux_id_not_found(self, mock_exists):
        mock_exists.return_value = False
        assert _get_linux_id() is None

    @patch("subprocess.run")
    def test_get_darwin_id_success(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout='"IOPlatformUUID" = "darwin-uuid"', returncode=0
        )
        assert _get_darwin_id() == "darwin-uuid"

    @patch("subprocess.run")
    def test_get_darwin_id_failure(self, mock_run):
        mock_run.side_effect = subprocess.CalledProcessError(1, "ioreg")
        assert _get_darwin_id() is None

    @patch("subprocess.run")
    def test_get_windows_id_success(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout="MachineGuid    REG_SZ    windows-guid", returncode=0
        )
        assert _get_windows_id() == "windows-guid"

    @patch("subprocess.run")
    def test_get_windows_id_failure(self, mock_run):
        mock_run.side_effect = Exception("Registry error")
        assert _get_windows_id() is None

    @patch("platform.system")
    @patch("mcp_relay_core.storage.machine_id._get_linux_id")
    def test_get_machine_id_linux(self, mock_linux, mock_system):
        mock_system.return_value = "Linux"
        mock_linux.return_value = "linux-id"
        assert get_machine_id() == "linux-id"

    @patch("platform.system")
    @patch("mcp_relay_core.storage.machine_id._get_darwin_id")
    def test_get_machine_id_darwin(self, mock_darwin, mock_system):
        mock_system.return_value = "Darwin"
        mock_darwin.return_value = "darwin-id"
        assert get_machine_id() == "darwin-id"

    @patch("platform.system")
    @patch("mcp_relay_core.storage.machine_id._get_windows_id")
    def test_get_machine_id_windows(self, mock_windows, mock_system):
        mock_system.return_value = "Windows"
        mock_windows.return_value = "windows-id"
        assert get_machine_id() == "windows-id"

    @patch("platform.system")
    @patch("socket.gethostname")
    @patch("mcp_relay_core.storage.machine_id._get_first_mac")
    def test_get_machine_id_fallback(self, mock_mac, mock_hostname, mock_system):
        mock_system.return_value = "UnknownOS"
        mock_hostname.return_value = "my-host"
        mock_mac.return_value = "00:11:22:33:44:55"
        assert get_machine_id() == "my-host-00:11:22:33:44:55"


class TestCoverageExpansion:
    @patch("os.path.exists")
    @patch("builtins.open")
    def test_get_linux_id_exception(self, mock_open, mock_exists):
        mock_exists.return_value = True
        mock_open.side_effect = Exception("Read error")
        assert _get_linux_id() is None

    @patch("platform.system")
    def test_get_machine_id_linux_exception(self, mock_system):
        mock_system.side_effect = Exception("System detection error")
        # Should fall back
        mid = get_machine_id()
        assert mid
        assert "-" in mid

    @patch("subprocess.run")
    def test_get_darwin_id_no_match(self, mock_run):
        mock_run.return_value = MagicMock(stdout="No UUID here", returncode=0)
        assert _get_darwin_id() is None

    @patch("subprocess.run")
    def test_get_windows_id_no_match(self, mock_run):
        mock_run.return_value = MagicMock(stdout="No Guid here", returncode=0)
        assert _get_windows_id() is None

    @patch("uuid.getnode")
    def test_get_first_mac_multicast(self, mock_getnode):
        # Multicast bit is the 41st bit (index 40)
        mock_getnode.return_value = 1 << 40
        from mcp_relay_core.storage.machine_id import _get_first_mac

        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode")
    def test_get_first_mac_all_zeros(self, mock_getnode):
        mock_getnode.return_value = 0
        from mcp_relay_core.storage.machine_id import _get_first_mac

        assert _get_first_mac() == "unknown"

    @patch("uuid.getnode")
    def test_get_first_mac_success(self, mock_getnode):
        # 00:11:22:33:44:55 -> 0x001122334455
        mock_getnode.return_value = 0x001122334455
        from mcp_relay_core.storage.machine_id import _get_first_mac

        assert _get_first_mac() == "00:11:22:33:44:55"

    @patch("uuid.getnode")
    def test_get_first_mac_exception(self, mock_getnode):
        mock_getnode.side_effect = Exception("UUID error")
        from mcp_relay_core.storage.machine_id import _get_first_mac

        assert _get_first_mac() == "unknown"

    @patch("getpass.getuser")
    @patch("os.environ.get")
    def test_get_username_fallback(self, mock_env_get, mock_getuser):
        mock_getuser.side_effect = Exception("getuser error")
        mock_env_get.side_effect = lambda k, default=None: (
            "env-user" if k == "USER" else default
        )
        from mcp_relay_core.storage.machine_id import get_username

        assert get_username() == "env-user"
