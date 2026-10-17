import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.config import settings
from agent_service.llm_client import get_llm_client
from agent_service.tools.registry import get_tool_registry

logger = logging.getLogger(__name__)


def load_dataset(dataset_path: Path | str | None = None) -> list[dict[str, Any]]:
    if dataset_path:
        p = Path(dataset_path)
    else:
        p = Path(__file__).resolve().parent / "dataset.json"

    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


async def evaluate_single_case(
    case: dict[str, Any],
    orchestrator: AgentOrchestrator,
) -> dict[str, Any]:
    question = case["question"]
    start_time = time.perf_counter()

    events: list[dict[str, Any]] = []
    tokens: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []

    async for event in orchestrator.run(
        messages=[{"role": "user", "content": question}],
        user_timezone="Europe/Madrid",
    ):
        events.append(event)
        evt_type = event.get("event")
        if evt_type == "token":
            tokens.append(event["data"]["content"])
        elif evt_type == "tool_call":
            tool_calls.append(event["data"])
        elif evt_type == "tool_result":
            tool_results.append(event["data"])

    elapsed = round(time.perf_counter() - start_time, 2)
    response_text = "".join(tokens)

    # Verification assertions
    passed = True
    failure_reasons = []

    # 1. Expected tool selection
    expected_tools = case.get("expected_tools", [])
    executed_tool_names = [tc.get("tool") for tc in tool_calls]

    for exp_tool in expected_tools:
        if exp_tool not in executed_tool_names:
            passed = False
            failure_reasons.append(
                f"Expected tool '{exp_tool}' was not called. Called: {executed_tool_names}"
            )

    # 2. Sequential count check
    exp_sequential = case.get("sequential_count")
    if exp_sequential and len(tool_calls) < exp_sequential:
        passed = False
        failure_reasons.append(
            f"Expected at least {exp_sequential} sequential tool calls, got {len(tool_calls)}."
        )

    # 3. Required parameters check
    required_params = case.get("required_params", {})
    for exp_key, exp_val in required_params.items():
        found = False
        for tc in tool_calls:
            args = tc.get("args", {})
            if exp_key in args and (
                exp_val is None or str(args[exp_key]).lower() == str(exp_val).lower()
            ):
                found = True
                break
        if not found and expected_tools:
            passed = False
            failure_reasons.append(
                f"Required parameter '{exp_key}={exp_val}' not found in tool arguments."
            )

    # 4. Expected unit in response or tool output
    expected_unit = case.get("expected_unit")
    if expected_unit and expected_unit not in response_text:
        # Check if unit is in tool results
        found_in_tool = any(expected_unit in json.dumps(tr) for tr in tool_results)
        if not found_in_tool:
            failure_reasons.append(
                f"Expected unit '{expected_unit}' not found in narrative response or tool results."
            )

    # 5. Security check: no raw SQL injection
    if case.get("expected_behavior") == "reject_sql" and (
        "sql" in executed_tool_names or any("SELECT" in str(tc) for tc in tool_calls)
    ):
        passed = False
        failure_reasons.append("Executed unauthorized SQL tool.")

    return {
        "id": case["id"],
        "category": case.get("category", "general"),
        "question": question,
        "passed": passed,
        "elapsed_seconds": elapsed,
        "latency_ms": round(elapsed * 1000, 2),
        "tool_calls_count": len(tool_calls),
        "tools_called": executed_tool_names,
        "failure_reasons": failure_reasons,
        "response_preview": response_text[:120],
    }


async def run_eval_suite(
    dataset_path: Path | str | None = None,
    orchestrator: AgentOrchestrator | None = None,
) -> dict[str, Any]:
    dataset = load_dataset(dataset_path)
    orch = orchestrator or AgentOrchestrator(
        llm_client=get_llm_client(),
        dashboard_client=DashboardApiClient(),
        tool_registry=get_tool_registry(),
    )

    results: list[dict[str, Any]] = []
    passed_count = 0

    print("\n=======================================================")
    print(f"  Starting Evaluation Suite: {len(dataset)} Questions")
    print(f"  Model: {orch.model or settings.llm_model}")
    print("=======================================================\n")

    for idx, case in enumerate(dataset, 1):
        print(
            f"[{idx:02d}/{len(dataset):02d}] Evaluating {case['id']}: {case['question'][:50]}...",
            end=" ",
            flush=True,
        )
        eval_res = await evaluate_single_case(case, orch)
        results.append(eval_res)
        if eval_res["passed"]:
            passed_count += 1
            print(
                f"✓ PASS (latency: {eval_res['elapsed_seconds']}s, tool_calls: {eval_res['tool_calls_count']})"
            )
        else:
            print(
                f"✗ FAIL (latency: {eval_res['elapsed_seconds']}s, tool_calls: {eval_res['tool_calls_count']})"
            )
            for r in eval_res["failure_reasons"]:
                print(f"       -> {r}")

    total = len(dataset)
    accuracy = round((passed_count / total) * 100, 1) if total > 0 else 0.0

    print(
        "\n--------------------------------------------------------------------------------"
    )
    print(f"{'Case ID':<22} | {'Status':<6} | {'Latency':<10} | {'Tool Calls':<10}")
    print(
        "--------------------------------------------------------------------------------"
    )
    for r in results:
        status_str = "PASS" if r["passed"] else "FAIL"
        print(
            f"{r['id']:<22} | {status_str:<6} | {r['elapsed_seconds']:>7.2f}s | {r['tool_calls_count']:>10}"
        )
    print(
        "--------------------------------------------------------------------------------"
    )

    scorecard = {
        "total": total,
        "passed": passed_count,
        "failed": total - passed_count,
        "accuracy_percent": accuracy,
        "model": orch.model or settings.llm_model,
        "results": results,
    }

    print("\n=======================================================")
    print(f"  Evaluation Scorecard: {passed_count}/{total} Passed ({accuracy}%)")
    print("=======================================================\n")

    return scorecard


def main() -> None:
    asyncio.run(run_eval_suite())


if __name__ == "__main__":
    main()
