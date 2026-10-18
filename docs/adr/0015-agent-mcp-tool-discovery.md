# ADR-0015: Agent Dynamic MCP Tool Discovery and Anomaly Detection Decoupling

## Status
Accepted

## Context
Previously, `apps/agent-service` maintained a hand-written `DashboardApiClient` querying REST endpoints and 5 static data tools in `tools/registry.py`. Introducing or changing telemetry capabilities in `dashboard-api` required synchronized code updates in the agent service: client methods, DTOs, tool definitions, schemas, and system prompt text.

With ADR-0014 establishing an in-process MCP server in `dashboard-api` (`POST /api/mcp`), the agent service can discover data tools dynamically at runtime over Streamable HTTP.

In Feasibility Spike 0, key integration mechanisms were evaluated:
1. **Python MCP Client**: Official `mcp` SDK (`>=2.3.0`) connects via `streamable_http_client` and `ClientSession` in stateless mode against Fastify 5 Streamable HTTP endpoints.
2. **Local Model Schema Sensitivity**: Small local models (e.g. `unsloth/Qwen3.5-4B-GGUF`) hallucinate or reject schemas containing JSON Schema meta-keywords (`$schema`, `$id`, `$defs`, `definitions`). Normalizing schemas to standard OpenAI function definitions with `additionalProperties: false` ensures flawless execution.
3. **Point Cap and Anomaly Detection**: The MCP server enforces a safety cap (`MCP_MAX_POINTS_PER_CALL=500`). The deterministic anomaly detector in `agent-service` requires raw 5m series data over long periods (e.g., up to 30 days). Implementing windowed time-chunk requests in `tools/core_data.py` satisfied this constraint while achieving 100% anomaly detection parity with the baseline REST implementation.
4. **Tool Evaluation Parity**: Benchmarks with local models demonstrated 100% tool selection accuracy when discovering tools dynamically, including extra tools such as `describe_dataset`.

## Decision
We adopt dynamic runtime MCP tool discovery and contract-decoupled anomaly detection in `apps/agent-service`:

1. **Official Python MCP Client**:
   - Use `mcp>=2.3.0` with `mcp.client.streamable_http.streamable_http_client`.
   - Manage connections, tool discovery, and tool execution with configurable timeouts (`MCP_CALL_TIMEOUT_SECONDS`) and bearer auth (`MCP_AUTH_TOKEN`).

2. **Schema Normalization Adapter (`tools/mcp_adapter.py`)**:
   - Clean discovered MCP input schemas by stripping `$schema`, `$id`, `$defs`, and `definitions`.
   - Ensure top-level `"type": "object"`, `"properties": {...}`, and `"additionalProperties": false`.

3. **Core Data Contract & Anomaly Decoupling (`tools/core_data.py`)**:
   - Limit direct dependencies on data-tool schemas strictly to `tools/core_data.py`.
   - Validate discovered tools against `docs/contracts/mcp-core-contract.json` (`list_metrics` and `get_series`) at each discovery refresh.
   - If validation fails, disable `detect_anomalies` gracefully and log a warning while allowing the agent to continue serving other tools.
   - Implement windowed time-chunk requests to fetch raw series under the server point cap and assemble contiguous time-series arrays for anomaly detection.

4. **Dynamic Registry & Merged Catalogue (`tools/registry.py`)**:
   - Maintain local deterministic analysis tools (`detect_anomalies`) and merge them with discovered MCP tools.
   - Cache discovered tools with configurable TTL (`MCP_TOOL_LIST_TTL_SECONDS`).
   - Treat name collisions between local tools and discovered MCP tools as fatal configuration errors at discovery.
   - Enforce bounded tool result sizes (`TOOL_RESULT_MAX_CHARS`) and return tool errors (`isError: true`) as feedback messages to the model.

5. **Prompt Generalization (`agent/prompt.py`)**:
   - Remove hardcoded data-tool names from the static system prompt.
   - Dynamically append MCP server `instructions` under a "Data source instructions" section when provided by the server.

6. **Phased Migration**:
   - Support a temporary `TOOLS_BACKEND=rest|mcp` toggle during implementation and benchmark evaluation.
   - Once parity is proven, remove `TOOLS_BACKEND`, delete `clients/dashboard_api.py` and REST data tool handlers, and deprecate `DASHBOARD_API_BASE_URL`.

## Consequences & Verification
- **Runtime Flexibility**: New telemetry tools exposed by `dashboard-api` are instantly available to the LLM without modifying or redeploying `agent-service`.
- **Zero Anomaly Regression**: `detect_anomalies` preserves 100% parity across all metrics and time windows via windowed fetching.
- **Verification**:
  - In-process fake MCP server unit test fixtures.
  - Schema normalization tests validating removal of unsupported JSON Schema keywords.
  - Regression unit test asserting identical anomaly detection findings against the seeded database.
  - Prompt tests asserting absence of static data-tool names.
  - Eval benchmark parity comparison between `TOOLS_BACKEND=rest` and `TOOLS_BACKEND=mcp`.
