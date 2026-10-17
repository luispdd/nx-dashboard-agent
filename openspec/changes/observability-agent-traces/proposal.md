## Why

Agent runs are opaque: the orchestrator and tool registry only log errors. There is no run identifier, no timing for LLM or tool calls, and no way to connect an agent run to the dashboard-api requests it caused.

## What Changes

- Structured JSON logging in `agent-service` for each run: run id, step, LLM call latency and finish reason, tool name, duration, status and result size.
- A run/request id propagated to `dashboard-api` through an `x-request-id` header and included in its request logs.
- Metadata-only logging by default; prompts and tool payloads only when an explicit debug setting is enabled.
- The eval runner reports per-case latency and tool-call counts from the same data.
- Logs only: no OpenTelemetry or Langfuse in this change.

## Capabilities

### New Capabilities
- `agent-observability`: Structured, correlated logs for agent runs and tool calls.

### Modified Capabilities

## Impact

- `apps/agent-service` (orchestrator, tool registry, dashboard API client, config, eval runner).
- `apps/dashboard-api` request logging (no OpenAPI contract change; header is not part of the contract).
- No new runtime dependencies.
