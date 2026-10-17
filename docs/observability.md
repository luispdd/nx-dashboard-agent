# Observability & Agent Traces

The system provides structured, correlated JSON logging across the FastAPI agent service and NestJS dashboard API to observe LLM calls, tool executions, and data queries without external tracing dependencies.

## Log Record Structure

All log messages emitted by `agent-service` are formatted as single-line JSON records:

| Field | Type | Description |
|---|---|---|
| `timestamp` | string | UTC ISO-8601 timestamp ending in `Z` (e.g. `2026-10-17T23:45:00.123Z`). |
| `level` | string | Standard logging level (`INFO`, `WARNING`, `ERROR`). |
| `logger` | string | Logger category (e.g. `agent_service.agent.orchestrator`). |
| `message` | string | Human-readable log summary. |
| `run_id` | string (optional) | UUID4 identifier identifying the chat request run. |
| `step` | integer (optional) | Zero-indexed step number within the multi-turn agent loop. |

## Event Types

Structured log events contain an `event` field indicating the lifecycle phase:

### 1. `llm_call`
Emitted after each completion call to the LLM:
- `event`: `"llm_call"`
- `model`: Configured model identifier (e.g. `unsloth/Qwen3.5-4B-GGUF`).
- `duration_ms`: Duration of the streaming completion in milliseconds.
- `finish_reason`: Finish reason from LLM choice (`"stop"`, `"tool_calls"`, `"length"`).

### 2. `tool_call`
Emitted upon execution of an agent tool in `ToolRegistry.execute`:
- `event`: `"tool_call"`
- `tool`: Tool name (e.g. `get_stats`, `detect_anomalies`).
- `duration_ms`: Execution duration in milliseconds.
- `status`: Outcome status (`"ok"` on success, `"error"` on validation or API failure).
- `result_size`: Byte size of serialized tool payload.

### 3. `run_summary`
Emitted at the completion of an agent run:
- `event`: `"run_summary"`
- `duration_ms`: Total agent run time in milliseconds.
- `step_count`: Number of sequential turns executed.
- `tool_call_count`: Total number of tools invoked during the run.
- `status`: Final run outcome (`"ok"`, `"error"`, or `"max_steps"`).

## Cross-Service Correlation (`x-request-id`)

When `agent-service` calls `dashboard-api` during tool execution:
1. `DashboardApiClient` retrieves the active `run_id` from Python `contextvars` and attaches an `x-request-id: <run_id>` HTTP header.
2. `dashboard-api`'s `RequestLoggingInterceptor` and `HttpExceptionFilter` record the request with `[<run_id>] METHOD URL STATUS +DURATIONms` and echo the `x-request-id` header back in HTTP responses.

## Privacy Settings (`LOG_PAYLOADS`)

By default, logs never contain raw prompt text, LLM output tokens, or tool arguments/results.
To inspect full payloads during debugging:
- Set `LOG_PAYLOADS=true` in environment variables or `.env`.
- When enabled, `llm_call` records include `messages` and `response`, and `tool_call` records include `arguments` and `payload`.

## Following a Run

To follow an agent interaction from user prompt to API requests:
1. Search agent-service logs for the `run_id`:
   ```bash
   # Filter agent service logs for a specific run ID
   docker compose logs agent-service | grep '"run_id": "e207c830-48a7-4485-9870-e6c65829b157"'
   ```
2. Trace corresponding dashboard API calls using the same ID:
   ```bash
   # Filter dashboard-api logs by x-request-id
   docker compose logs dashboard-api | grep '\[e207c830-48a7-4485-9870-e6c65829b157\]'
   ```
