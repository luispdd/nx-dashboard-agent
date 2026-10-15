from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from agent_service.main import create_app


class MockChoiceDelta:
    def __init__(self, content: str | None = None, tool_calls: list[Any] | None = None) -> None:
        self.content = content
        self.tool_calls = tool_calls


class MockChunkChoice:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.delta = delta


class MockChunk:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.choices = [MockChunkChoice(delta)]


def test_chat_endpoint_validation_error() -> None:
    app = create_app()
    with TestClient(app) as client:
        # Empty messages list should return 422 Unprocessable Entity
        resp = client.post("/api/chat", json={"messages": []})
        assert resp.status_code == 422


def test_chat_endpoint_streaming_success() -> None:
    async def mock_create(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(MockChoiceDelta(content="Hello from "))
        yield MockChunk(MockChoiceDelta(content="the agent!"))

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=mock_create)

    app = create_app(llm_client=mock_llm)

    with TestClient(app) as client:
        resp = client.post(
            "/api/chat",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "timezone": "Europe/Madrid",
            },
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        body = resp.text

        # Verify event stream structure
        assert "event: token" in body
        assert "Hello from " in body
        assert "the agent!" in body
        assert "event: done" in body
