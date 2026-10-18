## Why

The agent service currently depends on a hand-written HTTP REST client and static Python tools for data retrieval. Evolving telemetry capabilities in the dashboard requires manual updates to the agent's client, tool schemas, and system prompt.

By transitioning the agent service to discover data tools dynamically from the dashboard MCP server at runtime, the agent can offer newly introduced tools to the LLM automatically, without code modifications or hardcoded data tool names.

## What Changes

- Add Python MCP SDK dependency (`mcp>=2.3.0`) managed with `uv`.
- Implement `clients/mcp_client.py` using `streamable_http_client` to manage connection, tool listing, tool invocation, and timeouts.
- Implement `tools/mcp_adapter.py` to normalize discovered MCP tool schemas into OpenAI function calling schemas (stripping `$schema`, `$id`, `$defs`, enforcing `additionalProperties: false`).
- Rework `tools/registry.py` to merge local tools (`detect_anomalies`) with discovered MCP tools, route calls dynamically, detect naming collisions as configuration errors, and cache tool definitions with TTL refresh.
- Implement `tools/core_data.py` to decouple `detect_anomalies` from REST and fetch raw telemetry points through the core MCP contract tools (`list_metrics`, `get_series`) using windowed requests under the point cap.
- Generalize the system prompt in `agent/prompt.py`: remove static data-tool names and append server instructions if provided by the MCP server.
- Update configuration: add `MCP_SERVER_URLS`, `MCP_AUTH_TOKEN`, `MCP_TOOL_LIST_TTL_SECONDS`, `MCP_CALL_TIMEOUT_SECONDS`, and `TOOL_RESULT_MAX_CHARS`.
- **BREAKING / REMOVAL**: Remove `DashboardApiClient`, REST data tool definitions, and the `DASHBOARD_API_BASE_URL` configuration setting once migration is verified.

## Non-goals

- No direct SQLite database opening from the agent service (always calls NestJS API via MCP).
- Moving anomaly detection out of the agent service (remains a deterministic local Python tool).
- Connecting to multiple non-dashboard MCP servers in production.

## Capabilities

### New Capabilities
- `agent-mcp-tool-discovery`: Dynamic runtime discovery, conversion, and routing of tools from configured MCP servers.

### Modified Capabilities
- `agent-tools-catalogue`: Data tools are discovered dynamically from MCP instead of registered statically; `detect_anomalies` remains local and consumes data via MCP.
- `agent-system-prompt-and-guardrails`: System prompt becomes generic with no hardcoded data-tool names, incorporating dynamic server instructions.
- `agent-eval-suite`: Evaluation benchmarks validate tool calling accuracy against the MCP backend without regression.
- `runtime-config-foundation`: Settings adopt MCP configuration keys and retire `DASHBOARD_API_BASE_URL`.

## Impact

- **Affected code**: `apps/agent-service` (`clients/`, `tools/`, `agent/`, `config.py`, tests, and evals).
- **Dependencies**: Add `mcp` via `uv add mcp`.
- **Contracts**: Adheres to `docs/contracts/mcp-core-contract.json`.
- **ADR**: Record architecture decision record in `docs/adr/0015-agent-mcp-tool-discovery.md`.
