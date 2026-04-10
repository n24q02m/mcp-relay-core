import os
from unittest.mock import MagicMock, mock_open, patch

from mcp_relay_core.storage.machine_id import (
    _get_first_mac,
    get_machine_id,
    get_username,
)


class TestMachineIdUnit:
    def test_get_username_success(self):
        with patch("getpass.getuser", return_value="testuser"):
            assert get_username() == "testuser"

    def test_get_username_fallback_user(self):
        with patch("getpass.getuser", side_effect=Exception("error")):
            with patch.dict(os.environ, {"USER": "fallback_user"}, clear=True):
                assert get_username() == "fallback_user"

    def test_get_username_fallback_username(self):
        with patch("getpass.getuser", side_effect=Exception("error")):
            # Ensure USER is not present
            env = os.environ.copy()
            if "USER" in env:
                del env["USER"]
            env["USERNAME"] = "fallback_username"
            with patch.dict(os.environ, env, clear=True):
                assert get_username() == "fallback_username"

    def test_get_username_fallback_unknown(self):
        with patch("getpass.getuser", side_effect=Exception("error")):
            with patch.dict(os.environ, {}, clear=True):
                assert get_username() == "unknown"

    def test_get_first_mac_success(self):
        # 0x0223456789ab -> 02:23:45:67:89:ab
        # First octet 0x02 (binary 00000010), multicast bit (LSB) is 0.
        with patch("uuid.getnode", return_value=0x0223456789AB):
            assert _get_first_mac() == "02:23:45:67:89:ab"

    def test_get_first_mac_multicast(self):
        # Multicast bit set (LSB of first octet)
        # 0x01... has multicast bit set.
        with patch("uuid.getnode", return_value=0x0123456789AB):
            assert _get_first_mac() == "unknown"

    def test_get_first_mac_zero(self):
        with patch("uuid.getnode", return_value=0):
            assert _get_first_mac() == "unknown"

    def test_get_first_mac_exception(self):
        with patch("uuid.getnode", side_effect=Exception("error")):
            assert _get_first_mac() == "unknown"

    def test_get_machine_id_linux(self):
        with patch("platform.system", return_value="Linux"):
            with patch("builtins.open", mock_open(read_data="linux-id\n")):
                assert get_machine_id() == "linux-id"

    def test_get_machine_id_darwin(self):
        with patch("platform.system", return_value="Darwin"):
            mock_result = MagicMock()
            mock_result.stdout = '"IOPlatformUUID" = "darwin-uuid"'
            with patch("subprocess.run", return_value=mock_result):
                assert get_machine_id() == "darwin-uuid"

    def test_get_machine_id_darwin_no_match(self):
        with patch("platform.system", return_value="Darwin"):
            mock_result = MagicMock()
            mock_result.stdout = "nothing here"
            with patch("subprocess.run", return_value=mock_result):
                with patch("socket.gethostname", return_value="myhost"):
                    with patch(
                        "mcp_relay_core.storage.machine_id._get_first_mac",
                        return_value="01:02:03:04:05:06",
                    ):
                        assert get_machine_id() == "myhost-01:02:03:04:05:06"

    def test_get_machine_id_windows(self):
        with patch("platform.system", return_value="Windows"):
            mock_result = MagicMock()
            mock_result.stdout = "MachineGuid    REG_SZ    windows-guid"
            with patch("subprocess.run", return_value=mock_result):
                assert get_machine_id() == "windows-guid"

    def test_get_machine_id_windows_no_match(self):
        with patch("platform.system", return_value="Windows"):
            mock_result = MagicMock()
            mock_result.stdout = "nothing here"
            with patch("subprocess.run", return_value=mock_result):
                with patch("socket.gethostname", return_value="myhost"):
                    with patch(
                        "mcp_relay_core.storage.machine_id._get_first_mac",
                        return_value="01:02:03:04:05:06",
                    ):
                        assert get_machine_id() == "myhost-01:02:03:04:05:06"

    def test_get_machine_id_fallback(self):
        with patch("platform.system", return_value="UnknownOS"):
            with patch("socket.gethostname", return_value="myhost"):
                with patch(
                    "mcp_relay_core.storage.machine_id._get_first_mac",
                    return_value="01:02:03:04:05:06",
                ):
                    assert get_machine_id() == "myhost-01:02:03:04:05:06"

    def test_get_machine_id_exception_handling(self):
        # Test the try-except block in get_machine_id
        with patch("platform.system", return_value="Linux"):
            with patch("builtins.open", side_effect=Exception("error")):
                with patch("socket.gethostname", return_value="myhost"):
                    with patch(
                        "mcp_relay_core.storage.machine_id._get_first_mac",
                        return_value="unknown",
                    ):
                        assert get_machine_id() == "myhost-unknown"
