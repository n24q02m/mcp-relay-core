"""Tests for machine ID and username detection."""

import os
from unittest.mock import MagicMock, patch

from mcp_relay_core.storage.machine_id import (
    _get_darwin_id,
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

    def test_linux_id_extraction(self):
        with patch(
            "builtins.open",
            MagicMock(
                return_value=MagicMock(
                    __enter__=MagicMock(
                        return_value=MagicMock(
                            read=MagicMock(return_value="linux-id\n")
                        )
                    )
                )
            ),
        ):
            assert _get_linux_id() == "linux-id"

    def test_darwin_id_extraction(self):
        mock_result = MagicMock(stdout='"IOPlatformUUID" = "darwin-uuid"\n')
        with patch("subprocess.run", return_value=mock_result):
            assert _get_darwin_id() == "darwin-uuid"

    def test_windows_id_extraction(self):
        mock_result = MagicMock(stdout="MachineGuid    REG_SZ    windows-guid\n")
        with patch("subprocess.run", return_value=mock_result):
            assert _get_windows_id() == "windows-guid"

    def test_get_machine_id_dispatch_linux(self):
        with patch("platform.system", return_value="Linux"):
            with patch(
                "mcp_relay_core.storage.machine_id._get_linux_id",
                return_value="mock-linux-id",
            ):
                assert get_machine_id() == "mock-linux-id"

    def test_get_machine_id_dispatch_darwin(self):
        with patch("platform.system", return_value="Darwin"):
            with patch(
                "mcp_relay_core.storage.machine_id._get_darwin_id",
                return_value="mock-darwin-id",
            ):
                assert get_machine_id() == "mock-darwin-id"

    def test_get_machine_id_dispatch_windows(self):
        with patch("platform.system", return_value="Windows"):
            with patch(
                "mcp_relay_core.storage.machine_id._get_windows_id",
                return_value="mock-windows-id",
            ):
                assert get_machine_id() == "mock-windows-id"


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
