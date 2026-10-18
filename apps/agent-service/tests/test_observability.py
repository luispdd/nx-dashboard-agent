import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.clients.mcp_client import (
    McpClient,
    McpClientError,
    McpToolResult,
)
from agent_service.config import settings
from agent_service.context import run_context
from agent_service.logging_config import JsonFormatter
from agent_service.tools.registry import ToolRegistry


class MockChoiceDelta:
    def __init__(
        self,
        content: str | None = None,
        tool_calls: list[Any] | None = None,
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


@pytest.mark.asyncio
async def test_llm_call_logging(caplog):
    caplog.set_level(logging.INFO)

    async def mock_stream(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(MockChoiceDelta(content="Hello world"), finish_reason="stop")

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = AsyncMock(side_effect=mock_stream)
    mock_mcp = AsyncMock(spec=McpClient)

    orchestrator = AgentOrchestrator(
        llm_client=mock_llm,
        mcp_client=mock_mcp,
        tool_registry=ToolRegistry(mcp_client=mock_mcp),
        model="test-obs-model",
    )

    with run_context(run_id="run-llm-123"):
        async for _ in orchestrator.run(messages=[{"role": "user", "content": "hi"}]):
            pass

    records = [r for r in caplog.records if getattr(r, "event", None) == "llm_call"]
    assert len(records) == 1
    rec = records[0]
    assert rec.model == "test-obs-model"
    assert rec.finish_reason == "stop"
    assert rec.duration_ms >= 0
    assert rec.run_id == "run-llm-123"
    assert rec.step == 0


@pytest.mark.asyncio
async def test_tool_call_logging_success_and_error(caplog):
    caplog.set_level(logging.INFO)

    async def fake_call_tool(name: str, arguments: dict[str, Any]) -> McpToolResult:
        if name == "dummy_tool":
            return McpToolResult(
                content=[{"type": "text", "text": json.dumps({"status": "ok"})}]
            )
        raise McpClientError(f"Unknown tool '{name}'")

    mock_mcp = AsyncMock(spec=McpClient)
    mock_mcp.call_tool = AsyncMock(side_effect=fake_call_tool)
    registry = ToolRegistry(mcp_client=mock_mcp)

    with run_context(run_id="run-tool-456", step=1):
        # 1. Successful execution
        res_ok = await registry.execute(
            name="dummy_tool",
            arguments={"query": "test_ok"},
        )
        assert res_ok["status"] == "success"

        # 2. Unknown tool error
        res_err = await registry.execute(
            name="non_existent",
            arguments={},
        )
        assert res_err["status"] == "error"

    tool_records = [
        r for r in caplog.records if getattr(r, "event", None) == "tool_call"
    ]
    assert len(tool_records) == 2

    ok_rec = tool_records[0]
    assert ok_rec.tool == "dummy_tool"
    assert ok_rec.status == "ok"
    assert ok_rec.duration_ms >= 0
    assert ok_rec.result_size > 0
    assert ok_rec.run_id == "run-tool-456"
    assert ok_rec.step == 1

    err_rec = tool_records[1]
    assert err_rec.tool == "non_existent"
    assert err_rec.status == "error"
    assert err_rec.result_size > 0


@pytest.mark.asyncio
async def test_run_summary_logging_all_paths(caplog):
    caplog.set_level(logging.INFO)
    mock_mcp = AsyncMock(spec=McpClient)

    # Path 1: Normal success
    async def stream_success(**kwargs: Any) -> AsyncIterator[MockChunk]:
        yield MockChunk(MockChoiceDelta(content="Done"), finish_reason="stop")

    mock_llm_success = MagicMock()
    mock_llm_success.chat.completions.create = AsyncMock(side_effect=stream_success)
    orch_success = AgentOrchestrator(
        llm_client=mock_llm_success,
        mcp_client=mock_mcp,
        tool_registry=ToolRegistry(mcp_client=mock_mcp),
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
        mcp_client=mock_mcp,
        tool_registry=ToolRegistry(mcp_client=mock_mcp),
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
    mock_mcp_loop = AsyncMock(spec=McpClient)
    mock_mcp_loop.call_tool = AsyncMock(
        return_value=McpToolResult(
            content=[{"type": "text", "text": json.dumps(["esp32c6"])}]
        )
    )

    orch_loop = AgentOrchestrator(
        llm_client=mock_llm_loop,
        mcp_client=mock_mcp_loop,
        tool_registry=ToolRegistry(mcp_client=mock_mcp_loop),
        max_steps=1,
    )

    with run_context(run_id="run-max-steps"):
        async for _ in orch_loop.run(messages=[{"role": "user", "content": "loop"}]):
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

    mock_mcp = AsyncMock(spec=McpClient)
    mock_mcp.call_tool = AsyncMock(
        return_value=McpToolResult(
            content=[{"type": "text", "text": json.dumps({"status": "ok"})}]
        )
    )
    registry = ToolRegistry(mcp_client=mock_mcp)

    # 1. Default settings: LOG_PAYLOADS = False
    monkeypatch.setattr(settings, "log_payloads", False)

    caplog.clear()
    await registry.execute(
        name="dummy_tool",
        arguments={"query": SECRET_ARG},
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
    )

    formatted_debug_logs = [formatter.format(r) for r in caplog.records]
    assert any(SECRET_ARG in log_str for log_str in formatted_debug_logs)


@pytest.mark.asyncio
async def test_mcp_client_sends_x_request_id():
    captured_requests = []

    def mock_handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "result": {"tools": []},
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(mock_handler),
        base_url="http://test-mcp",
    ) as raw_client:
        mcp_client = McpClient(url="http://test-mcp/api/mcp", client=raw_client)

        test_run_id = "test-run-trace-uuid-987"
        headers = mcp_client._get_headers()
        assert "x-request-id" not in headers

        with run_context(run_id=test_run_id):
            headers_with_trace = mcp_client._get_headers()
            assert headers_with_trace.get("x-request-id") == test_run_id
