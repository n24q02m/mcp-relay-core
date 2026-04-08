"""Tests for file-based session locking."""

import json
import time

import pytest

from mcp_relay_core.storage.session_lock import (
    SessionInfo,
    acquire_session_lock,
    release_session_lock,
    set_lock_dir,
    write_session_lock,
)


@pytest.fixture(autouse=True)
def _temp_lock_dir(tmp_path):
    lock_dir = str(tmp_path / "locks")
    set_lock_dir(lock_dir)
    yield tmp_path
    set_lock_dir(None)


class TestSessionLock:
    async def test_acquire_returns_none_when_no_lock(self):
        info = await acquire_session_lock("test-server")
        assert info is None

    async def test_write_and_acquire_reuse(self):
        info = SessionInfo(
            session_id="abc",
            relay_url="https://relay/setup",
            created_at=time.time(),
        )
        await write_session_lock("test-server", info)

        reused = await acquire_session_lock("test-server")
        assert reused is not None
        assert reused.session_id == "abc"
        assert reused.relay_url == "https://relay/setup"

    async def test_acquire_returns_none_when_expired(self):
        # 20 minutes old (default max age 10 min)
        info = SessionInfo(
            session_id="old",
            relay_url="url",
            created_at=time.time() - 1200,
        )
        await write_session_lock("test-server", info)

        reused = await acquire_session_lock("test-server")
        assert reused is None

    async def test_acquire_cleans_up_expired_lock(self, _temp_lock_dir):
        info = SessionInfo(
            session_id="old",
            relay_url="url",
            created_at=time.time() - 1200,
        )
        await write_session_lock("test-server", info)
        lock_file = _temp_lock_dir / "locks" / "relay-session-test-server.lock"
        assert lock_file.exists()

        await acquire_session_lock("test-server")
        assert not lock_file.exists()

    async def test_release_removes_file(self, _temp_lock_dir):
        info = SessionInfo("id", "url", time.time())
        await write_session_lock("test-server", info)
        lock_file = _temp_lock_dir / "locks" / "relay-session-test-server.lock"
        assert lock_file.exists()

        await release_session_lock("test-server")
        assert not lock_file.exists()

    async def test_handles_corrupt_json(self, _temp_lock_dir):
        lock_dir = _temp_lock_dir / "locks"
        lock_dir.mkdir(parents=True, exist_ok=True)
        lock_file = lock_dir / "relay-session-test-server.lock"
        lock_file.write_text("invalid-json")

        info = await acquire_session_lock("test-server")
        assert info is None
        assert not lock_file.exists()

    async def test_handles_missing_keys(self, _temp_lock_dir):
        lock_dir = _temp_lock_dir / "locks"
        lock_dir.mkdir(parents=True, exist_ok=True)
        lock_file = lock_dir / "relay-session-test-server.lock"
        lock_file.write_text(json.dumps({"wrong": "data"}))

        info = await acquire_session_lock("test-server")
        assert info is None
        assert not lock_file.exists()

    async def test_atomic_write_via_rename(self, _temp_lock_dir):
        # We can't easily "catch" it mid-write without complex mocking,
        # but we can verify it doesn't crash and produces the file.
        info = SessionInfo("id", "url", time.time())
        await write_session_lock("test-server", info)

        lock_file = _temp_lock_dir / "locks" / "relay-session-test-server.lock"
        assert lock_file.exists()
        data = json.loads(lock_file.read_text())
        assert data["session_id"] == "id"

    async def test_release_missing_file_no_op(self):
        # Should not raise
        await release_session_lock("non-existent")

    async def test_custom_max_age(self):
        # 5 minutes old
        info = SessionInfo("id", "url", time.time() - 300)
        await write_session_lock("test-server", info)

        # Still valid for default (10 min)
        assert await acquire_session_lock("test-server") is not None

        # Expired for custom (1 min)
        assert await acquire_session_lock("test-server", max_age_s=60) is None
