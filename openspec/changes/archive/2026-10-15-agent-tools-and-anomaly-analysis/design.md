# Design: agent-tools-and-anomaly-analysis

## Context

See `proposal.md` for motivation. The workspace currently contains:
- `apps/agent-service`: A FastAPI application skeleton with lifespan management, CORS configuration, settings resolution, and basic session management, but no tools or analytical logic.
- `apps/dashboard-api`: A NestJS service exposing read-only telemetry endpoints (`/api/metrics`, `/api/devices`, `/api/stats`, `/api/series`) backed by the derived SQLite database.
- Target Model: Unsloth Qwen 3.5 4B (compact local model running via OpenAI-compatible endpoint), with optional fallback to cloud-hosted endpoints.

## Goals / Non-Goals

**Goals:**
- Provide a clean, typed asynchronous client in Python to query the NestJS API over HTTP.
- Implement deterministic anomaly detection algorithms in pure Python (`peer_deviation`, `spike`, `flatline`, `gap`) unit-tested on synthetic data.
- Supply a calendar-grounded system prompt enabling small models to resolve relative dates into explicit ISO UTC timestamps.
- Orchestrate sequential multi-step tool calls up to 5 steps, streaming progress via SSE (`tool_call`, `tool_result`, `token`, `done`, `error`).
- Deliver a 20-question evaluation suite verifying tool selection, factual arithmetic, and anomaly recall.

**Non-Goals:**
- Generating Python client code from OpenAPI specs (direct typed `httpx` client used instead).
- Adding `numpy` or `pandas` (pure standard library `statistics` and `math` only).
- Direct database connections from Python (strictly calls NestJS API per ADR-003).
- Frontend React chat components (handled in Milestone M6).

## Decisions

### Decision 1: Pure Python for Anomaly Detection (No NumPy / Pandas)
- **Rationale**: Keeps `apps/agent-service` dependencies lightweight, minimizes Docker image size, and speeds up test execution. Python 3.13's `statistics` module provides `median`, `mean`, `stdev`, and `quantiles`. Median Absolute Deviation (MAD) is computed directly:
  ```python
  def mad(data: list[float], med: float | None = None) -> float:
      m = med if med is not None else statistics.median(data)
      return statistics.median([abs(x - m) for x in data])
  ```
- **Alternative considered**: NumPy/Pandas. Rejected because telemetry is already bucketed by the NestJS API, making standard library iteration fast and simple.

### Decision 2: Direct Async HTTP Client over OpenAPI Code Generation
- **Rationale**: Direct integration using `httpx.AsyncClient` with Pydantic query models gives precise control over timeouts, connection reuse, and response slicing without maintaining generated client code or code generators in Python.
- **Alternative considered**: `openapi-python-client`. Rejected to avoid extra generator tools and unnecessary file churn in Python.

### Decision 3: Explicit Calendar Injection in System Prompt
- **Rationale**: Small 4B models frequently make day-of-week arithmetic errors when given only a bare ISO date. Injecting `"Today is Thursday, October 15, 2026 (UTC)"` allows the model to reliably resolve "yesterday" (Oct 14) and "last Tuesday" (Oct 6) to exact ISO strings.
- **Alternative considered**: Natural language date parser in tool parameters. Rejected because standardizing on ISO UTC timestamps ending with `Z` across all tool schemas avoids ambiguity and aligns with workspace time rules.

### Decision 4: Sequential Multi-Step Execution Loop
- **Rationale**: Comparing two distinct time windows (e.g. yesterday vs last Tuesday) requires two separate queries. A sequential loop executes tool 1, feeds the result back, executes tool 2, and allows the model to synthesize the final answer. Each step emits explicit SSE events (`tool_call` and `tool_result`), providing full visibility in the chat UI.
- **Alternative considered**: Parallel-only tool calls. Rejected because sequential turns allow the model to reason adaptively based on intermediate results.

### Decision 5: Modular Layered Architecture
- **Structure**:
  - `src/agent_service/clients/dashboard_api.py`: Async HTTP client for NestJS API.
  - `src/agent_service/analysis/anomalies.py`: Pure Python anomaly algorithms (zero FastAPI dependencies).
  - `src/agent_service/tools/schemas.py` & `registry.py`: Pydantic tool definitions and dispatchers.
  - `src/agent_service/agent/prompt.py` & `orchestrator.py`: System prompt builder and sequential SSE execution loop.
  - `src/agent_service/api/chat.py`: `POST /api/chat` streaming endpoint.
  - `tests/evals/`: Evaluation runner and 20 benchmark test cases.

## Risks / Trade-offs

- **[Risk: Local 4B model loops endlessly on tool calls]** → *Mitigation*: Hard execution limit (`MAX_STEPS = 5`). If reached, further tool calls are halted and the model is forced to summarize findings collected so far.
- **[Risk: Local model hallucinates numbers when no data is returned]** → *Mitigation*: System prompt explicitly mandates that empty data (`count: 0`, `mean: null`) must be reported as "No data recorded" rather than guessing.
- **[Risk: NestJS API latency or downtime]** → *Mitigation*: Client applies an 8-second timeout per call and catches `httpx.HTTPError`, returning a structured error message to the model rather than crashing the chat stream.
- **[Risk: Context window overflow from dense time-series points]** → *Mitigation*: `get_series` caps returned data points (`limit <= 100`) and defaults to larger bucket intervals (`1h` or `1d`) for multi-day ranges.

## Migration Plan

- No database schema migrations required.
- Extends `apps/agent-service` internally.
- Existing health check endpoint `GET /health` remains unchanged.
