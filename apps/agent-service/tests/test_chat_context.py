from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from agent_service.agent.prompt import build_system_prompt
from agent_service.api.chat import DashboardContextModel, TimeRangeContext
from agent_service.clients.mcp_client import DiscoveredToolsResult, McpClient
from agent_service.main import create_app


class MockChoiceDelta:
    def __init__(self, content: str | None = None) -> None:
        self.content = content
        self.tool_calls = None


class MockChunkChoice:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.delta = delta


class MockChunk:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.choices = [MockChunkChoice(delta)]


def test_build_system_prompt_with_context() -> None:
    fixed_time = datetime(2026, 10, 15, 12, 0, 0, tzinfo=UTC)
    ctx = DashboardContextModel(
        selected_metric="temperature",
        selected_devices=["esp32c6", "esp32s3"],
        unit="°C",
        time_range=TimeRangeContext(
            preset="1d",
            from_ts="2026-10-14T12:00:00Z",
            to_ts="2026-10-15T12:00:00Z",
        ),
    )

    prompt = build_system_prompt(
        now_utc=fixed_time, user_timezone="Europe/Paris", context=ctx
    )

    assert "Active Dashboard Context" in prompt
    assert "Active Metric: temperature (°C)" in prompt
    assert "Active Devices: esp32c6, esp32s3" in prompt
    assert "preset '1d'" in prompt
    assert "from 2026-10-14T12:00:00Z" in prompt
    assert "to 2026-10-15T12:00:00Z" in prompt
    assert "Context Prioritization" in prompt


def test_build_system_prompt_with_points_context() -> None:
    ctx = DashboardContextModel(
        selected_metric="humidity",
        selected_devices=["esp32c6"],
        unit="%",
        time_range=TimeRangeContext(points=50),
    )
    prompt = build_system_prompt(context=ctx)

    assert "Active Metric: humidity (%)" in prompt
    assert "Active Devices: esp32c6" in prompt
    assert "latest 50 points" in prompt


def test_build_system_prompt_without_context() -> None:
    prompt = build_system_prompt(context=None)
    assert "Active Dashboard Context" not in prompt


def test_chat_endpoint_with_context_payload() -> None:
    captured_messages: list[Any] = []

    async def mock_create(**kwargs: Any) -> AsyncIterator[MockChunk]:
        nonlocal captured_messages
        captured_messages = kwargs.get("messages", [])
        yield MockChunk(MockChoiceDelta(content="Temperature is normal."))

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=mock_create)

    mock_mcp = AsyncMock(spec=McpClient)
    mock_mcp.list_tools = AsyncMock(
        return_value=DiscoveredToolsResult(tools=[], instructions=None)
    )

    app = create_app(llm_client=mock_llm, mcp_client=mock_mcp)

    with TestClient(app) as client:
        resp = client.post(
            "/api/chat",
            json={
                "messages": [{"role": "user", "content": "Why does esp32c6 look odd?"}],
                "timezone": "Europe/Berlin",
                "context": {
                    "selectedMetric": "temperature",
                    "selectedDevices": ["esp32c6"],
                    "unit": "°C",
                    "timeRange": {
                        "preset": "1d",
                    },
                },
            },
        )
        assert resp.status_code == 200
        body = resp.text
        assert "event: token" in body
        assert "Temperature is normal." in body

        # Verify system prompt injected into LLM call
        assert len(captured_messages) > 0
        system_msg = captured_messages[0]
        assert system_msg["role"] == "system"
        assert "Active Dashboard Context" in system_msg["content"]
        assert "Active Metric: temperature (°C)" in system_msg["content"]
        assert "Active Devices: esp32c6" in system_msg["content"]
        assert "preset '1d'" in system_msg["content"]
