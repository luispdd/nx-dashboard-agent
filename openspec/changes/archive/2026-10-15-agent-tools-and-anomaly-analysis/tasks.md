# Tasks: agent-tools-and-anomaly-analysis

## 1. Pure Python Anomaly Detection Engine

- [x] 1.1 Implement pure Python statistical helpers (median, MAD, rolling variance) in `src/agent_service/analysis/anomalies.py` and verify unit tests pass with `uv run pytest tests/test_anomalies.py`.
- [x] 1.2 Implement `peer_deviation` detector computing cross-device medians and flagging multi-bucket offsets, verifying detection of injected Day 2 temperature anomalies (`esp32c6` +8.5°C).
- [x] 1.3 Implement `spike` detector using robust Z-score (MAD) and verify detection of injected Day 3 humidity spike (`esp32s3` +40%).
- [x] 1.4 Implement `flatline` and `gap` detectors for stuck readings and cadence silences, verifying detection of injected Day 4 and Day 5 anomalies.

## 2. NestJS API Asynchronous Client

- [x] 2.1 Implement `DashboardApiClient` using `httpx.AsyncClient` in `src/agent_service/clients/dashboard_api.py` covering `/api/metrics`, `/api/devices`, `/api/stats`, and `/api/series` with explicit timeouts and error handling.
- [x] 2.2 Add unit tests in `tests/test_dashboard_api_client.py` using mock HTTP transports to verify parameter formatting, ISO UTC parsing, and error response mapping.

## 3. Tool Catalogue & Parameter Validation

- [x] 3.1 Define Pydantic schemas in `src/agent_service/tools/schemas.py` for all 6 tools (`list_metrics`, `list_devices`, `get_stats`, `get_series`, `compare_devices`, `detect_anomalies`) enforcing `extra="forbid"` and ISO-8601 UTC format.
- [x] 3.2 Implement tool dispatchers and OpenAI function schema generators in `src/agent_service/tools/registry.py` and verify tool execution via `tests/test_tools.py`.

## 4. System Prompt & Sequential Multi-Step Orchestration

- [x] 4.1 Implement system prompt builder in `src/agent_service/agent/prompt.py` injecting current UTC date, day of week, timezone, and strict grounding instructions, verified via unit tests in `tests/test_prompt.py`.
- [x] 4.2 Implement sequential multi-step tool execution loop in `src/agent_service/agent/orchestrator.py` enforcing a 5-step cap and yielding SSE event dictionaries (`tool_call`, `tool_result`, `token`, `done`, `error`).
- [x] 4.3 Add unit tests in `tests/test_orchestrator.py` using a mock LLM client to verify multi-turn sequential queries (e.g. yesterday vs last Tuesday comparison) and step limit guardrail termination.

## 5. Streaming Chat API Endpoint

- [x] 5.1 Create `POST /api/chat` route in `src/agent_service/api/chat.py` utilizing `sse-starlette`'s `EventSourceResponse` to stream orchestrator events.
- [x] 5.2 Register the chat router in `src/agent_service/main.py` and verify end-to-end SSE streaming using `TestClient` in `tests/test_chat_endpoint.py`.

## 6. Evaluation Suite

- [x] 6.1 Create 20-question benchmark dataset in `src/agent_service/evals/dataset.json` covering single-metric facts, date comparisons, anomaly detection, and out-of-range edge cases.
- [x] 6.2 Implement evaluation test runner in `src/agent_service/evals/runner.py` computing tool selection accuracy, parameter matching, factual grounding, and anomaly recall.
- [x] 6.3 Add an Nx target or script (`nx run agent-service:eval`) in `apps/agent-service/project.json` and verify the eval runner executes with reproducible reporting.
