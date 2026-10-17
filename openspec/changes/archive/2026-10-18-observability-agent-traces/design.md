## Context

`orchestrator.py` runs a multi-step tool loop yielding SSE events and `registry.py` executes tools; both use stdlib `logging` with error-only messages. `clients/dashboard_api.py` calls NestJS. `evals/runner.py` runs benchmark cases. `dashboard-api` has an HTTP exception filter and a `main.ts` bootstrap. See proposal.md.

## Goals / Non-Goals

**Goals:**
- Reconstruct any run from logs alone using the run id.
- Zero new dependencies.

**Non-Goals:**
- OpenTelemetry, Langfuse or any trace backend.
- Persisting runs or exposing a debug endpoint.
- Changing the SSE contract with the chat MFE.

## Decisions

- **JSON formatter on stdlib `logging`**, configured at startup in `main.py`. Alternative: `structlog`. Rejected: new dependency for little gain here.
- **Run context via `contextvars`** (`run_id`, step) so tool handlers and the API client log with correlation without parameter plumbing. Run id: UUID4 generated per chat request.
- **Timing with `time.perf_counter()`** around LLM streaming (total duration; time-to-first-token optional) and each `ToolRegistry.execute`.
- **Event names** as stable log `event` fields: `llm_call`, `tool_call`, `run_summary`.
- **Correlation header**: `x-request-id: <run_id>` set by the dashboard API client; `dashboard-api` echoes it in a request-logging hook/interceptor (Nest + Fastify) and returns it in the response. Not added to OpenAPI, so no regeneration.
- **Privacy flag**: `LOG_PAYLOADS=false` default in settings (env/runtime config style consistent with existing config); when true, include prompt and tool args/results (truncated).
- **Result size**: byte length of serialized tool result, not content.
- **Eval runner**: collect the same timing data per case and print a latency/tool-count table plus JSON output.
- **Tests**: unit tests assert emitted records via `caplog`, header propagation with a mocked transport, and default no-payload behaviour.

## Risks / Trade-offs

- [Log volume at ~20 events/sec during streaming] -> log per LLM call, not per token.
- [Contextvars across async generators] -> set in the request handler, verify propagation in tests, as generators can run in a different task context.
- [Leaking sensitive text] -> payload flag off by default plus a test that scans default logs for the prompt string.
- [Nest logging changes affect existing tests] -> keep the hook additive and quiet in tests.
