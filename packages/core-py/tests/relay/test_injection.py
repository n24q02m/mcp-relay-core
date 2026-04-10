"""Security tests for browser opening to prevent command injection."""

from unittest.mock import MagicMock, patch

from mcp_relay_core.relay.browser import _open_in_wsl


def test_open_in_wsl_prevents_injection():
    with patch("mcp_relay_core.relay.browser.subprocess.run") as mock_run:
        # Mocking the side effect to simulate first call failing so second call is made
        mock_run.side_effect = [FileNotFoundError, MagicMock()]

        malicious_url = "https://example.com/$(id)"
        _open_in_wsl(malicious_url)

        # Check first call (wslview)
        args, kwargs = mock_run.call_args_list[0]
        assert args[0] == ["wslview", malicious_url]

        # Check second call (rundll32.exe)
        args, kwargs = mock_run.call_args_list[1]
        assert args[0] == ["rundll32.exe", "url.dll,FileProtocolHandler", malicious_url]
