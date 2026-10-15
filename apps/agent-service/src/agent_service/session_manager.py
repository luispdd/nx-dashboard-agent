import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass
class SessionState:
    session_id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    last_accessed_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    active_task: asyncio.Task[Any] | None = None
    event_buffer: list[dict[str, Any]] = field(default_factory=list)

    def touch(self) -> None:
        self.last_accessed_at = datetime.now(UTC)


class SessionManager:
    """Manages ephemeral in-memory chat sessions and active task references."""

    def __init__(self, default_ttl_seconds: int = 3600) -> None:
        self.default_ttl_seconds = default_ttl_seconds
        self._sessions: dict[str, SessionState] = {}
        self._lock = asyncio.Lock()

    def get_session(self, session_id: str) -> SessionState | None:
        session = self._sessions.get(session_id)
        if session:
            session.touch()
        return session

    def get_or_create_session(self, session_id: str | None = None) -> SessionState:
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            session.touch()
            return session

        sid = session_id or str(uuid.uuid4())
        session = SessionState(session_id=sid)
        self._sessions[sid] = session
        return session

    def set_task(self, session_id: str, task: asyncio.Task[Any] | None) -> None:
        session = self.get_session(session_id)
        if session:
            session.active_task = task
            session.touch()

    def append_event(self, session_id: str, event: dict[str, Any]) -> None:
        session = self.get_session(session_id)
        if session:
            session.event_buffer.append(event)
            session.touch()

    def evict_expired(self, ttl_seconds: int | None = None) -> int:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds
        now = datetime.now(UTC)
        expired_ids = [
            sid
            for sid, s in self._sessions.items()
            if (now - s.last_accessed_at).total_seconds() > ttl
        ]

        for sid in expired_ids:
            session = self._sessions.pop(sid, None)
            if session and session.active_task and not session.active_task.done():
                session.active_task.cancel()

        return len(expired_ids)

    def active_session_count(self) -> int:
        return len(self._sessions)

    def clear(self) -> None:
        for session in self._sessions.values():
            if session.active_task and not session.active_task.done():
                session.active_task.cancel()
        self._sessions.clear()


_global_session_manager: SessionManager | None = None


def get_session_manager() -> SessionManager:
    """Dependency provider returning the singleton SessionManager instance."""
    global _global_session_manager
    if _global_session_manager is None:
        _global_session_manager = SessionManager()
    return _global_session_manager


def reset_session_manager() -> None:
    """Helper to reset session manager state between test executions."""
    global _global_session_manager
    if _global_session_manager is not None:
        _global_session_manager.clear()
    _global_session_manager = None
