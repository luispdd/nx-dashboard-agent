# Proposal: agent-tools-and-anomaly-analysis

## Why

Milestone M5 transitions the FastAPI agent service from an empty foundation into a fact-grounded, deterministic analytical data agent. While the service skeleton, session management, and LLM reachability were validated in M0, M1, and M4, the agent currently has no ability to inspect telemetry data, perform calculations, or analyze anomalies. 

Because the target inference engine is a compact local model (Unsloth Qwen 3.5 4B), the agent must not be asked to write free-form SQL or visually inspect raw time series. Instead, deterministic statistics and anomaly algorithms must run in pure Python, while typed, narrow tools query the NestJS API. This gives the local model a safe, bounded sandbox to answer IoT telemetry and comparative questions without hallucinating.

## What Changes

- **Direct NestJS API HTTP Client**: A dedicated asynchronous `httpx` client in Python calling the NestJS API endpoints (`GET /api/metrics`, `GET /api/devices`, `GET /api/stats`, `GET /api/series`) with Pydantic query models, avoiding complex OpenAPI client generator tooling in Python.
- **Typed Tool Catalogue**: Pydantic-validated tool definitions (`list_metrics`, `list_devices`, `get_series`, `get_stats`, `compare_devices`, `detect_anomalies`) enforcing ISO-8601 UTC timestamps, dynamic metric enum validation, output size caps, and regular readings by default (`include_on_demand=false`).
- **Deterministic Pure Python Anomaly Detection**: An anomaly detection module implemented purely with Python's standard library (`math`, `statistics`) that computes structured findings for `peer_deviation` (cross-device median subtraction), `spike` (robust Z-score / MAD), `flatline` (zero-variance window), and `gap` (missing regular cadence), unit-tested against the synthetic seed generator.
- **System Prompt & Sequential Orchestration Loop**: A dynamic system prompt injecting current UTC date and day of week (`"Today is Thursday, October 15, 2026 (UTC)"`), user timezone, and strict grounding rules. A sequential multi-step tool-calling execution loop with hard step limits (max 5) emitting Server-Sent Events (`tool_call`, `tool_result`, `token`, `done`, `error`).
- **Automated Evaluation Suite**: A reproducible evaluation suite with 20 benchmark questions testing tool selection, parameter extraction, arithmetic comparisons, and anomaly recall across local and cloud LLM providers.

## Capabilities

### New Capabilities

- `agent-tools-catalogue`: Typed tool definitions, Pydantic input/output schemas, and direct asynchronous HTTP integration with the NestJS Dashboard API.
- `agent-anomaly-detection`: Deterministic pure Python statistical anomaly detection algorithms producing structured finding records.
- `agent-system-prompt-and-guardrails`: Contextual system prompt with calendar grounding, sequential multi-step tool calling orchestration, step caps, and SSE streaming protocol.
- `agent-eval-suite`: 20-question automated benchmark suite testing tool selection, grounding accuracy, and anomaly detection recall.

### Modified Capabilities

<!-- None: Existing M0-M4 capabilities remain intact. -->

## Impact

- **Affected App**: `apps/agent-service`.
- **Target Endpoints**: New streaming chat endpoint `POST /api/chat` supporting SSE events and multi-turn tool calling.
- **External Dependencies**: Zero heavy third-party numerical packages (no NumPy/Pandas); leverages existing `fastapi`, `httpx`, `openai`, `pydantic`, `sse-starlette`, and `pytest`.
- **API Contracts**: Consumes existing `apps/dashboard-api` endpoints as documented in `dist/apps/dashboard-api/openapi.json`.
