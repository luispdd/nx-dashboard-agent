## 1. Logging foundation

- [ ] 1.1 Add JSON log formatter and logging setup in `agent-service` startup with a `LOG_PAYLOADS` setting (default off); verify with a unit test that records are valid JSON
- [ ] 1.2 Add run-context helpers (`run_id`, step) using `contextvars`, with a run id generated per chat request; verify propagation across the async generator in a test

## 2. Instrumentation

- [ ] 2.1 Log `llm_call` records (model, duration, finish reason) in the orchestrator; verify with `caplog` tests
- [ ] 2.2 Log `tool_call` records (tool name, duration, status, result size) in `ToolRegistry.execute`, including error cases; verify with tests for ok and error
- [ ] 2.3 Log a `run_summary` record at run end, including max-steps and LLM-error paths; verify with tests for each path
- [ ] 2.4 Verify default logs contain no prompt text or tool payloads, and payloads appear only with `LOG_PAYLOADS=true`

## 3. Cross-service correlation

- [ ] 3.1 Send `x-request-id` from `clients/dashboard_api.py`; verify with a mocked-transport test asserting the header equals the run id
- [ ] 3.2 Add request logging in `dashboard-api` that records and echoes `x-request-id`; verify with a Vitest test and confirm the OpenAPI export is unchanged

## 4. Eval reporting and verification

- [ ] 4.1 Report per-case latency and tool-call counts in `agent_service.evals.runner`; verify the output contains both for each case
- [ ] 4.2 Document the log fields and how to follow a run in `docs/` (short section); verify the doc matches emitted fields
- [ ] 4.3 Run `nx affected -t lint test build`, `uv run ruff check .` and `openspec validate --all` and confirm all pass
