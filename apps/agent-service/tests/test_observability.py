import logging
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from pydantic import BaseModel

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.config import settings
from agent_service.context import run_context
from agent_service.logging_config import JsonFormatter
from agent_service.tools.registry import (
    ToolDefinition,
    ToolRegistry,
    build_default_tool_registry,
)


class MockChoiceDelta:
    def __init__(
        self, content: str | None = None, tool_calls: list[Any] | None = None
    ) -> None:
        self.content = content
        self.tool_calls = tool_calls


class MockChunkChoice:
    def __init__(
        self, delta: MockChoiceDelta, finish_reason: str | None = None
    ) -> None:
        self.delta = delta
        self.finish_reason = finish_reason


class MockChunk:
    def __init__(
        self, delta: MockChoiceDelta, finish_reason: str | None = None
    ) -> None:
        self.choices = [MockChunkChoice(delta, finish_reason=finish_reason)]


class DummyInput(BaseModel):
    query: str


async def dummy_handler(
    params: DummyInput, client: DashboardApiClient
) -> dict[str, str]:
    return {"message": f"Processed {params.query}"}


@pytest.mark.asyncio
async def test_llm_call_logging(caplog):
    caplog.set_level(logging.INFO)

    async def mock_stream(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(MockChoiceDelta(content="Hello world"), finish_reason="stop")

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=mock_stream)

    orchestrator = AgentOrchestrator(
        llm_client=mock_llm,
        dashboard_client=DashboardApiClient(),
        tool_registry=ToolRegistry(),
        model="test-obs-model",
    )

    with run_context(run_id="run-llm-123"):
        async for _ in orchestrator.run(messages=[{"role": "user", "content": "hi"}]):
            pass

    llm_records = [r for r in caplog.records if getattr(r, "event", None) == "llm_call"]
    assert len(llm_records) == 1
    rec = llm_records[0]
    assert rec.model == "test-obs-model"
    assert rec.finish_reason == "stop"
    assert rec.duration_ms >= 0
    assert rec.run_id == "run-llm-123"
    assert rec.step == 0


@pytest.mark.asyncio
async def test_tool_call_logging_success_and_error(caplog):
    caplog.set_level(logging.INFO)
    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="dummy_tool",
            description="Dummy tool for testing",
            input_model=DummyInput,
            handler=dummy_handler,
        )
    )

    with run_context(run_id="run-tool-456", step=1):
        # 1. Successful execution
        res_ok = await registry.execute(
            name="dummy_tool",
            arguments={"query": "test_ok"},
            client=DashboardApiClient(),
        )
        assert res_ok["status"] == "success"

        # 2. Unknown tool error
        res_err = await registry.execute(
            name="non_existent",
            arguments={},
            client=DashboardApiClient(),
        )
        assert res_err["status"] == "error"

        # 3. Validation error
        res_val_err = await registry.execute(
            name="dummy_tool",
            arguments={},
            client=DashboardApiClient(),
        )
        assert res_val_err["status"] == "error"

    tool_records = [
        r for r in caplog.records if getattr(r, "event", None) == "tool_call"
    ]
    assert len(tool_records) == 3

    ok_rec = tool_records[0]
    assert ok_rec.tool == "dummy_tool"
    assert ok_rec.status == "ok"
    assert ok_rec.duration_ms >= 0
    assert ok_rec.result_size > 0
    assert ok_rec.run_id == "run-tool-456"
    assert ok_rec.step == 1

    err_rec1 = tool_records[1]
    assert err_rec1.tool == "non_existent"
    assert err_rec1.status == "error"
    assert err_rec1.result_size > 0

    err_rec2 = tool_records[2]
    assert err_rec2.tool == "dummy_tool"
    assert err_rec2.status == "error"


@pytest.mark.asyncio
async def test_run_summary_logging_all_paths(caplog):
    caplog.set_level(logging.INFO)

    # Path 1: Normal success
    async def stream_success(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(MockChoiceDelta(content="Done"), finish_reason="stop")

    mock_llm_success = MagicMock()
    mock_llm_success.chat.completions.create = AsyncMock(side_effect=stream_success)
    orch_success = AgentOrchestrator(
        llm_client=mock_llm_success,
        dashboard_client=DashboardApiClient(),
        tool_registry=ToolRegistry(),
    )

    with run_context(run_id="run-success"):
        async for _ in orch_success.run(
            messages=[{"role": "user", "content": "hello"}]
        ):
            pass

    # Path 2: LLM error
    mock_llm_err = MagicMock()
    mock_llm_err.chat.completions.create = AsyncMock(
        side_effect=RuntimeError("Connection refused")
    )
    orch_err = AgentOrchestrator(
        llm_client=mock_llm_err,
        dashboard_client=DashboardApiClient(),
        tool_registry=ToolRegistry(),
    )

    with run_context(run_id="run-err"):
        async for _ in orch_err.run(
            messages=[{"role": "user", "content": "error test"}]
        ):
            pass

    # Path 3: Max steps
    class MockDeltaToolCallFunc:
        name = "list_devices"
        arguments = "{}"

    class MockDeltaToolCall:
        index = 0
        id = "call_loop"
        function = MockDeltaToolCallFunc()

    async def stream_loop(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(
            MockChoiceDelta(tool_calls=[MockDeltaToolCall()]),
            finish_reason="tool_calls",
        )

    mock_llm_loop = MagicMock()
    mock_llm_loop.chat.completions.create = AsyncMock(side_effect=stream_loop)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=["esp32c6"])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        orch_loop = AgentOrchestrator(
            llm_client=mock_llm_loop,
            dashboard_client=DashboardApiClient(client=raw_client),
            tool_registry=build_default_tool_registry(),
            max_steps=1,
        )

        with run_context(run_id="run-max-steps"):
            async for _ in orch_loop.run(
                messages=[{"role": "user", "content": "loop"}]
            ):
                pass

    summary_records = [
        r for r in caplog.records if getattr(r, "event", None) == "run_summary"
    ]
    assert len(summary_records) == 3

    assert summary_records[0].run_id == "run-success"
    assert summary_records[0].status == "ok"
    assert summary_records[0].duration_ms >= 0

    assert summary_records[1].run_id == "run-err"
    assert summary_records[1].status == "error"

    assert summary_records[2].run_id == "run-max-steps"
    assert summary_records[2].status == "max_steps"
    assert summary_records[2].tool_call_count == 1


@pytest.mark.asyncio
async def test_privacy_preserving_defaults_vs_log_payloads(caplog, monkeypatch):
    caplog.set_level(logging.INFO)
    formatter = JsonFormatter()

    SECRET_PROMPT = "SUPER_SECRET_USER_PROMPT_12345"
    SECRET_ARG = "SECRET_DEVICE_ESP32C6"

    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="dummy_tool",
            description="Dummy tool",
            input_model=DummyInput,
            handler=dummy_handler,
        )
    )

    # 1. Default settings: LOG_PAYLOADS = False
    monkeypatch.setattr(settings, "log_payloads", False)

    caplog.clear()
    await registry.execute(
        name="dummy_tool",
        arguments={"query": SECRET_ARG},
        client=DashboardApiClient(),
    )

    formatted_default_logs = [formatter.format(r) for r in caplog.records]
    for log_str in formatted_default_logs:
        assert SECRET_ARG not in log_str
        assert SECRET_PROMPT not in log_str

    # 2. LOG_PAYLOADS = True
    monkeypatch.setattr(settings, "log_payloads", True)

    caplog.clear()
    await registry.execute(
        name="dummy_tool",
        arguments={"query": SECRET_ARG},
        client=DashboardApiClient(),
    )

    formatted_debug_logs = [formatter.format(r) for r in caplog.records]
    assert any(SECRET_ARG in log_str for log_str in formatted_debug_logs)


@pytest.mark.asyncio
async def test_dashboard_api_client_sends_x_request_id():
    captured_requests = []

    def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        if request.url.path == "/api/metrics":
            return httpx.Response(
                200, json=[{"metric_key": "temperature", "unit": "°C"}]
            )
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(mock_handler),
        base_url="http://test-dashboard-api",
    ) as raw_client:
        dash_client = DashboardApiClient(client=raw_client)

        # 1. With run context active
        test_run_id = "test-run-trace-uuid-987"
        with run_context(run_id=test_run_id):
            metrics = await dash_client.get_metrics()
            assert len(metrics) == 1

        assert len(captured_requests) == 1
        assert captured_requests[0].headers.get("x-request-id") == test_run_id

        # 2. Without run context active
        await dash_client.get_devices()
        assert len(captured_requests) == 2
        assert "x-request-id" not in captured_requests[1].headers
