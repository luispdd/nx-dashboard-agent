## 1. Dependencies and ADR

- [x] 1.1 Record ADR `docs/adr/0015-agent-mcp-tool-discovery.md` establishing runtime MCP tool discovery and anomaly detection decoupling
- [x] 1.2 Add `mcp>=2.3.0` to `apps/agent-service/pyproject.toml` using `uv add mcp` and verify `uv sync` succeeds

## 2. MCP Client and Schema Adapter

- [x] 2.1 Implement `clients/mcp_client.py` using `streamable_http_client` with connect, list_tools, call_tool, bearer token, and timeout handling
- [x] 2.2 Implement `tools/mcp_adapter.py` to normalize MCP tool schemas for OpenAI function definitions (strip `$schema`, `$id`, `$defs`, enforce `additionalProperties: false`) and verify normalized schemas with unit tests

## 3. Tool Registry and Core Data Decoupling

- [x] 3.1 Implement `tools/core_data.py` validating the core contract (`list_metrics`, `get_series`) against `docs/contracts/mcp-core-contract.json` at each refresh
- [x] 3.2 Implement windowed series fetching in `tools/core_data.py` to fetch long time ranges under the `MCP_MAX_POINTS_PER_CALL=500` point cap and wire `detect_anomalies` to it
- [x] 3.3 Refactor `tools/registry.py` to support `TOOLS_BACKEND=rest|mcp` (default `rest`), tool caching with `MCP_TOOL_LIST_TTL_SECONDS`, collision detection, and dynamic call routing
- [x] 3.4 Generalize system prompt in `agent/prompt.py` to remove static data-tool names and inject dynamic server instructions under "Data source instructions"

## 4. Tests and Parity Evaluation

- [x] 4.1 Create in-process fake MCP server fixture for unit tests covering tool discovery, schema normalization, call routing, timeouts, tool errors, and collision handling
- [x] 4.2 Add unit test verifying that `detect_anomalies` through `core_data.py` reports the exact same anomalies on the seeded database
- [x] 4.3 Add unit test asserting that no data-tool names appear in the static system prompt
- [x] 4.4 Run evaluation benchmarks on `TOOLS_BACKEND=rest` and `TOOLS_BACKEND=mcp`, assert equal tool-calling accuracy, and record results in change notes

## 5. Deprecation and Cleanup

- [x] 5.1 Set `TOOLS_BACKEND=mcp` as the default and remove the `TOOLS_BACKEND` configuration flag
- [x] 5.2 Delete `clients/dashboard_api.py`, REST-based data tool handlers in `tools/registry.py`, and their unit tests
- [x] 5.3 Remove `DASHBOARD_API_BASE_URL` from `config.py`, `.env.example`, and tests
- [x] 5.4 Update skills `agent-tool-design` and `fastapi-python-conventions` to reflect MCP discovery rules

## 6. End-to-End Verification and Quality Gates

- [x] 6.1 Verify with a temporary dummy tool in `dashboard-api` that the agent discovers and uses it with zero code changes in `apps/agent-service`
- [x] 6.2 Run full test suite: `nx affected -t lint test build`, `uv run pytest`, `uv run ruff check .`
- [x] 6.3 Run Playwright E2E suites: `bun run e2e` (or `nx e2e dashboard-shell-e2e` and `nx e2e chat-mfe-e2e`)
- [x] 6.4 Validate all OpenSpec changes with `openspec validate --all`
