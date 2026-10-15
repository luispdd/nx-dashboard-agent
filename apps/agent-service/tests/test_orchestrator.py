from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.tools.registry import build_default_tool_registry


class MockChoiceDeltaToolCallFunction:
    def __init__(self, name: str | None = None, arguments: str | None = None) -> None:
        self.name = name
        self.arguments = arguments


class MockChoiceDeltaToolCall:
    def __init__(self, index: int, id: str | None = None, function: MockChoiceDeltaToolCallFunction | None = None) -> None:
        self.index = index
        self.id = id
        self.function = function


class MockChoiceDelta:
    def __init__(self, content: str | None = None, tool_calls: list[MockChoiceDeltaToolCall] | None = None) -> None:
        self.content = content
        self.tool_calls = tool_calls


class MockChunkChoice:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.delta = delta


class MockChunk:
    def __init__(self, delta: MockChoiceDelta) -> None:
        self.choices = [MockChunkChoice(delta)]


async def async_iter(items: list[Any]) -> AsyncIterator[Any]:
    for item in items:
        yield item


@pytest.mark.asyncio
async def test_sequential_multi_turn_execution() -> None:
    turn_counter = 0

    async def mock_create(**kwargs: Any) -> AsyncIterator[MockChunk]:
        nonlocal turn_counter
        turn_counter += 1

        if turn_counter == 1:
            # Turn 1: Emit tool call 1 for "yesterday"
            yield MockChunk(
                MockChoiceDelta(
                    tool_calls=[
                        MockChoiceDeltaToolCall(
                            index=0,
                            id="call_1",
                            function=MockChoiceDeltaToolCallFunction(
                                name="get_stats",
                                arguments='{"metric_key": "temperature", "device_id": "esp32c6", "from_ts": "2026-10-14T00:00:00Z", "to_ts": "2026-10-14T23:59:59Z"}',
                            ),
                        )
                    ]
                )
            )
        elif turn_counter == 2:
            # Turn 2: Emit tool call 2 for "last Tuesday"
            yield MockChunk(
                MockChoiceDelta(
                    tool_calls=[
                        MockChoiceDeltaToolCall(
                            index=0,
                            id="call_2",
                            function=MockChoiceDeltaToolCallFunction(
                                name="get_stats",
                                arguments='{"metric_key": "temperature", "device_id": "esp32c6", "from_ts": "2026-10-06T00:00:00Z", "to_ts": "2026-10-06T23:59:59Z"}',
                            ),
                        )
                    ]
                )
            )
        else:
            # Turn 3: Emit final narrative answer tokens
            yield MockChunk(MockChoiceDelta(content="Average temperature was 21.4°C yesterday and 18.9°C last Tuesday."))
            yield MockChunk(MockChoiceDelta(content=" Difference is +2.5°C."))

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=mock_create)

    # Mock dashboard client responses for stats
    def handler(request: httpx.Request) -> httpx.Response:
        from_param = request.url.params.get("from")
        mean_val = 21.4 if "2026-10-14" in from_param else 18.9
        return httpx.Response(
            200,
            json={
                "metric": "temperature",
                "unit": "°C",
                "stats": [
                    {
                        "device_id": "esp32c6",
                        "mean": mean_val,
                        "std": 1.5,
                        "min": 15.0,
                        "max": 25.0,
                        "count": 288,
                        "missing_ratio": 0.0,
                    }
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test") as raw_client:
        dash_client = DashboardApiClient(client=raw_client)
        registry = build_default_tool_registry()

        orchestrator = AgentOrchestrator(
            llm_client=mock_llm,
            dashboard_client=dash_client,
            tool_registry=registry,
            max_steps=5,
            model="test-model",
        )

        events: list[dict[str, Any]] = []
        async for event in orchestrator.run(
            messages=[{"role": "user", "content": "compare the average temperature deviation between yesterday and last tuesday for esp32c6"}]
        ):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "tool_call" in event_types
        assert "tool_result" in event_types
        assert "token" in event_types
        assert "done" in event_types

        # Verify sequential tool execution occurred
        tool_calls = [e for e in events if e["event"] == "tool_call"]
        assert len(tool_calls) == 2
        assert tool_calls[0]["data"]["args"]["from_ts"] == "2026-10-14T00:00:00Z"
        assert tool_calls[1]["data"]["args"]["from_ts"] == "2026-10-06T00:00:00Z"

        tool_results = [e for e in events if e["event"] == "tool_result"]
        assert len(tool_results) == 2
        assert tool_results[0]["data"]["result"]["result"]["stats"][0]["mean"] == 21.4
        assert tool_results[1]["data"]["result"]["result"]["stats"][0]["mean"] == 18.9


@pytest.mark.asyncio
async def test_step_limit_guardrail() -> None:
    async def infinite_tool_calls(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(
            MockChoiceDelta(
                tool_calls=[
                    MockChoiceDeltaToolCall(
                        index=0,
                        id="loop_call",
                        function=MockChoiceDeltaToolCallFunction(
                            name="list_devices",
                            arguments="{}",
                        ),
                    )
                ]
            )
        )

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=infinite_tool_calls)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=["esp32c6"])

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test") as raw_client:
        dash_client = DashboardApiClient(client=raw_client)
        registry = build_default_tool_registry()

        orchestrator = AgentOrchestrator(
            llm_client=mock_llm,
            dashboard_client=dash_client,
            tool_registry=registry,
            max_steps=2,  # Strict cap of 2 steps
            model="test-model",
        )

        events: list[dict[str, Any]] = []
        async for event in orchestrator.run(messages=[{"role": "user", "content": "loop"}]):
            events.append(event)

        event_types = [e["event"] for e in events]
        assert "error" in event_types
        assert "done" in event_types

        error_event = next(e for e in events if e["event"] == "error")
        assert "Maximum tool calling steps (2) exceeded" in error_event["data"]["message"]
