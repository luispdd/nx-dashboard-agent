## Context

See `proposal.md` for the motivation and scope.
The agent service is a FastAPI application managed with `uv`. Previously, it owned a hand-written `DashboardApiClient` querying REST endpoints and 5 data tools declared in `tools/registry.py`.
Change 1 (`mcp-data-tools-server`) exposes these data capabilities as read-only MCP tools over Streamable HTTP at `/api/mcp` and defines the core contract in `docs/contracts/mcp-core-contract.json`. Feasibility Spike 0 proved that `mcp>=2.3.0` connects reliably to this endpoint and that normalized schemas work seamlessly with the local LLM (`Qwen3.5-4B-GGUF`).

## Goals / Non-Goals

**Goals:**
- Connect to configured MCP servers (`MCP_SERVER_URLS`) via Streamable HTTP and discover tools dynamically at runtime.
- Convert MCP tool schemas into OpenAI function calling schemas accepted by local LLM runners.
- Isolate knowledge of data-tool names exclusively to `tools/core_data.py` (which powers `detect_anomalies` via the core contract).
- Enable `detect_anomalies` to request raw series in windowed intervals that respect the server's point cap.
- Provide a clean migration path using `TOOLS_BACKEND=rest|mcp` to verify eval benchmarks before retiring the REST client.
- Eliminate all REST-based data querying code and settings from `apps/agent-service`.

**Non-Goals:**
- Moving deterministic anomaly detectors out of `agent-service`.
- Opening the SQLite database directly from Python.
- Stateful SSE connections or bi-directional notifications.

## Decisions

### 1. Python MCP SDK Client (`mcp>=2.3.0`)
- **Choice**: Use the official `mcp` Python SDK with `mcp.client.streamable_http.streamable_http_client`.
- **Rationale**: Spike 0 verified that `mcp==2.3.0` connects to Streamable HTTP endpoints cleanly, negotiates protocol `2024-11-05`, and supports tool listing and execution.
- **Alternatives considered**: Hand-writing JSON-RPC over `httpx` (rejected; the official SDK provides tested spec compliance, session lifecycle, and streaming parsing).
- **ADR**: Recorded in `docs/adr/0015-agent-mcp-tool-discovery.md`.

### 2. Schema Normalization for Small Local Models
- **Choice**: Normalize tool schemas in `tools/mcp_adapter.py`:
  - Strip `$schema`, `$id`, `definitions`, and `$defs`.
  - Ensure top-level `"type": "object"`, `"properties": {...}`, and `"additionalProperties": false`.
- **Rationale**: Spike 0 confirmed that local models like `Qwen3.5-4B-GGUF` reject or hallucinate when extraneous JSON Schema meta-keywords are present.

### 3. Merged Registry & Collision Detection
- **Choice**: In `tools/registry.py`, maintain local tools (`detect_anomalies`) and merge with discovered MCP tools.
  - Refresh discovered tools when cache age exceeds `MCP_TOOL_LIST_TTL_SECONDS`.
  - If a local tool and an MCP tool share the same name, raise a fatal configuration error at discovery.
- **Rationale**: Prevents accidental shadowing of local analysis tools while allowing new data tools to be adopted seamlessly.

### 4. Decoupled Core Contract for Anomaly Detection
- **Choice**: Implement `tools/core_data.py` as the sole module that references `list_metrics` and `get_series`.
  - Validate that discovered tools satisfy `docs/contracts/mcp-core-contract.json`.
  - If invalid, disable `detect_anomalies` and log a descriptive warning while keeping the service running.
  - Fetch raw series in windowed time chunks (e.g. ~41.6 hours per window at 5m resolution) to ensure requests never exceed `MCP_MAX_POINTS_PER_CALL=500`.
- **Rationale**: Decouples the rest of the agent service from data schemas while giving the local statistical detector the raw data it requires. Spike 0 confirmed 100% anomaly recall parity with this approach.

### 5. Migration Strategy via Temporary `TOOLS_BACKEND`
- **Phase 1**: Implement MCP client and adapter behind `TOOLS_BACKEND=rest|mcp` (default `rest`).
- **Phase 2**: Switch to `TOOLS_BACKEND=mcp`, run evaluation benchmarks, and verify parity.
- **Phase 3**: Remove `TOOLS_BACKEND` flag, delete `DashboardApiClient`, delete REST data tools, and remove `DASHBOARD_API_BASE_URL`.

## Risks / Trade-offs

- **[Risk] Discovery failure when MCP server is down** → Mitigated by falling back to cached tool lists if available, or cleanly emitting an SSE `error` event terminating the chat stream.
- **[Risk] Windowed series fetching latency** → Mitigated by bounded window counts (18 windows for 30 days) and connection reuse.
- **[Risk] Local model confusion with generic prompts** → Mitigated by appending MCP server `instructions` under a "Data source instructions" section and verifying accuracy with evals.
