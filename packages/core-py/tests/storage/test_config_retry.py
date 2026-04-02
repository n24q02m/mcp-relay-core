"""Tests for retry logic in config file operations."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from mcp_relay_core.storage.config_file import _with_retry


class TestConfigRetry:
    async def test_retries_on_ebusy_and_succeeds(self):
        mock_fn = MagicMock()
        # Fail twice with EBUSY (16), then succeed
        err = OSError()
        err.errno = 16
        mock_fn.side_effect = [err, err, "success"]

        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            result = await _with_retry(mock_fn)

            assert result == "success"
            assert mock_fn.call_count == 3
            assert mock_sleep.call_count == 2
            # Verify exponential backoff: 0.1 * 2^0, 0.1 * 2^1
            mock_sleep.assert_any_call(0.1)
            mock_sleep.assert_any_call(0.2)

    async def test_raises_after_max_retries(self):
        mock_fn = MagicMock()
        err = OSError()
        err.errno = 16
        mock_fn.side_effect = err

        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            with pytest.raises(OSError):
                await _with_retry(mock_fn)

            assert mock_fn.call_count == 3
            assert mock_sleep.call_count == 2

    async def test_raises_immediately_on_non_busy_error(self):
        mock_fn = MagicMock()
        err = OSError()
        err.errno = 2  # ENOENT
        mock_fn.side_effect = err

        with patch("asyncio.sleep", return_value=None) as mock_sleep:
            with pytest.raises(OSError):
                await _with_retry(mock_fn)

            assert mock_fn.call_count == 1
            assert mock_sleep.call_count == 0
