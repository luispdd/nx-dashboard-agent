from typing import Any
from unittest.mock import MagicMock

import pytest

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.evals.runner import evaluate_single_case, load_dataset


def test_dataset_integrity() -> None:
    dataset = load_dataset()
    assert len(dataset) == 20
    ids = [d["id"] for d in dataset]
    assert len(set(ids)) == 20

    categories = {d["category"] for d in dataset}
    assert "factual" in categories
    assert "comparative" in categories
    assert "anomaly" in categories
    assert "edge_case" in categories


@pytest.mark.asyncio
async def test_evaluate_single_case_pass() -> None:
    case = {
        "id": "eval_test_pass",
        "question": "What was the average temperature yesterday?",
        "expected_tools": ["get_stats"],
        "required_params": {"metric_key": "temperature"},
        "expected_unit": "°C",
    }

    mock_orch = MagicMock(spec=AgentOrchestrator)

    async def mock_run(messages: list[dict[str, Any]], user_timezone: str = "UTC"):
        yield {
            "event": "tool_call",
            "data": {
                "tool": "get_stats",
                "args": {
                    "metric_key": "temperature",
                    "from_ts": "2026-10-14T00:00:00Z",
                },
            },
        }
        yield {
            "event": "tool_result",
            "data": {
                "tool": "get_stats",
                "result": {"mean": 21.4, "unit": "°C"},
            },
        }
        yield {
            "event": "token",
            "data": {"content": "The mean temperature was 21.4°C."},
        }
        yield {"event": "done", "data": {}}

    mock_orch.run = mock_run

    res = await evaluate_single_case(case, mock_orch)
    assert res["passed"] is True
    assert res["tool_calls_count"] == 1
    assert "elapsed_seconds" in res
    assert "latency_ms" in res
    assert res["latency_ms"] >= 0
    assert res["tools_called"] == ["get_stats"]


@pytest.mark.asyncio
async def test_evaluate_single_case_fail_missing_tool() -> None:
    case = {
        "id": "eval_test_fail",
        "question": "What was the average temperature yesterday?",
        "expected_tools": ["get_stats"],
    }

    mock_orch = MagicMock(spec=AgentOrchestrator)

    async def mock_run(messages: list[dict[str, Any]], user_timezone: str = "UTC"):
        yield {"event": "token", "data": {"content": "I guessed 20°C."}}
        yield {"event": "done", "data": {}}

    mock_orch.run = mock_run

    res = await evaluate_single_case(case, mock_orch)
    assert res["passed"] is False
    assert any(
        "Expected tool 'get_stats' was not called" in r for r in res["failure_reasons"]
    )
