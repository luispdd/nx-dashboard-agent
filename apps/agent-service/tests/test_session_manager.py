import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from agent_service.session_manager import (
    SessionManager,
    SessionState,
    get_session_manager,
    reset_session_manager,
)


@pytest.fixture(autouse=True)
def clean_sessions() -> None:
    reset_session_manager()
    yield
    reset_session_manager()


def test_session_state_creation_and_touch() -> None:
    session = SessionState(session_id="sess-1")
    assert session.session_id == "sess-1"
    assert session.created_at.tzinfo == UTC
    assert session.last_accessed_at.tzinfo == UTC
    assert session.active_task is None
    assert session.event_buffer == []

    initial_accessed = session.last_accessed_at
    session.touch()
    assert session.last_accessed_at >= initial_accessed


def test_session_manager_get_or_create() -> None:
    manager = SessionManager(default_ttl_seconds=3600)
    assert manager.active_session_count() == 0

    s1 = manager.get_or_create_session()
    assert s1.session_id is not None
    assert manager.active_session_count() == 1

    s2 = manager.get_or_create_session("custom-id")
    assert s2.session_id == "custom-id"
    assert manager.active_session_count() == 2

    # Calling again with custom-id returns the exact same session
    s2_retrieved = manager.get_or_create_session("custom-id")
    assert s2_retrieved is s2
    assert manager.active_session_count() == 2


def test_session_manager_append_event() -> None:
    manager = SessionManager()
    session = manager.get_or_create_session("test-events")

    manager.append_event("test-events", {"event": "token", "delta": "Hello"})
    manager.append_event("test-events", {"event": "token", "delta": " world"})

    assert len(session.event_buffer) == 2
    assert session.event_buffer[0] == {"event": "token", "delta": "Hello"}
    assert session.event_buffer[1] == {"event": "token", "delta": " world"}


@pytest.mark.asyncio
async def test_session_manager_active_task_and_eviction() -> None:
    manager = SessionManager(default_ttl_seconds=10)
    session = manager.get_or_create_session("async-task-session")

    async def long_running_coro() -> None:
        try:
            await asyncio.sleep(100)
        except asyncio.CancelledError:
            pass

    task = asyncio.create_task(long_running_coro())
    manager.set_task("async-task-session", task)
    assert session.active_task is task
    assert not task.cancelled()

    # Artificially age the session past TTL
    session.last_accessed_at = datetime.now(UTC) - timedelta(seconds=20)

    evicted_count = manager.evict_expired(ttl_seconds=10)
    assert evicted_count == 1
    assert manager.active_session_count() == 0
    await asyncio.sleep(0)
    assert task.cancelled()


def test_session_manager_dependency_provider() -> None:
    mgr1 = get_session_manager()
    mgr2 = get_session_manager()
    assert mgr1 is mgr2

    mgr1.get_or_create_session("dep-sess")
    assert mgr2.active_session_count() == 1

    reset_session_manager()
    mgr3 = get_session_manager()
    assert mgr3 is not mgr1
    assert mgr3.active_session_count() == 0
