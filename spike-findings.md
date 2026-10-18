# Feasibility Spike Findings: MCP Data Tools & Agent Tool Discovery

**Date**: 2026-10-18  
**Status**: COMPLETE (All Experiments A through F Passed)  
**Recommendation**: GO for Change 1 (`mcp-data-tools-server`) and Change 2 (`agent-mcp-client`) with `@modelcontextprotocol/sdk`.

---

## 1. Summary of Experiments

| Experiment | Focus | Result | Details |
|---|---|---|---|
| **A: Library Compatibility** | NestJS 11 + Fastify 5 support | **PASSED** | `@modelcontextprotocol/sdk` (v1.32.1) mounted on Fastify via `StreamableHTTPServerTransport` works seamlessly with `reply.hijack()`. `@rekog/mcp-nest` was evaluated and rejected. |
| **B: Global Pipes & Filters** | Interference with MCP responses | **PASSED** | Neither `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`) nor `HttpExceptionFilter` corrupts MCP responses. Tool errors return `{ isError: true, content: [...] }` without being hijacked. |
| **C: Stateless Mode & Protocol** | Sessionless calls, spec version, instructions | **PASSED** | Stateless Streamable HTTP (`sessionIdGenerator: undefined`) functions across independent calls. Negotiated protocol revision: `2024-11-05`. Server-level `instructions` string is returned in `initialize` response. |
| **D: Python Client & Local LLM** | `mcp` Python SDK + local LLM (`Qwen3.5-4B-GGUF`) | **PASSED** | Python SDK `mcp==2.3.0` connects via `streamable_http_client`. Tool schemas normalized to OpenAI function schemas are accepted by local LLM runner without errors and executed correctly. |
| **E: Anomaly Detection Parity** | Series downsampling cap vs anomaly detector | **PASSED** | 100% anomaly detection parity on seeded SQLite DB across all metrics. 30 days of 5m native data requires 18 windows per device at cap 500 (below 20-window ceiling). |
| **F: Tool Catalogue Scale** | Small local model tool-calling accuracy | **PASSED** | 7/7 (100%) accuracy on test eval questions matching both REST schemas and MCP-style schemas including `describe_dataset`. |

---

## 2. Technical Findings & Details

### 2.1 Library Selection: `@modelcontextprotocol/sdk` vs `@rekog/mcp-nest`

- **`@rekog/mcp-nest` (Evaluated & Rejected)**:
  - Version 2.0.8 has peer dependencies on `@modelcontextprotocol/core: ^2.0.0-beta.5`, `@modelcontextprotocol/server: ^2.0.0-beta.5`, and `zod: ^4.3.5`.
  - Architecture relies on NestJS `@nestjs/microservices` (`CustomTransportStrategy`), requiring additional microservices dependencies and pulling in unneeded packages (`multer`, `passport`, `typeorm`).
  - Lacks clean stateless Streamable HTTP integration with Fastify request lifecycle.
- **`@modelcontextprotocol/sdk` (Chosen)**:
  - Official TypeScript SDK from Anthropic / MCP core team (v1.32.1).
  - Clean integration with Fastify 5 via Node raw streams:
    ```typescript
    @Controller('mcp')
    export class McpController {
      @Post()
      async handleMcp(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
        reply.hijack(); // Crucial for Fastify raw response delegation
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        await transport.handleRequest(req.raw, reply.raw, req.body);
      }
    }
    ```
  - Compatible with `zod@^3.25 || ^4.0`.

### 2.2 Global Pipe and Filter Behavior

- In NestJS, `ValidationPipe` with `forbidNonWhitelisted: true` only applies when route parameters have DTO validation metadata. Because `@Req()` and `@Res()` are injected directly in the MCP controller, the JSON-RPC payload is parsed by Fastify and handled directly by MCP transport without pipe interference.
- When an MCP tool returns an error (`isError: true` or throws a validation error), the MCP SDK catches it and returns a JSON-RPC response with `{ result: { content: [...], isError: true } }`. `HttpExceptionFilter` is not triggered.
- Unhandled HTTP methods (such as `GET /api/mcp`) should be handled explicitly with a 405 Method Not Allowed response to comply with Streamable HTTP specification.

### 2.3 Protocol Revision, Instructions, and Content

- **Negotiated Spec Revision**: `2024-11-05`.
- **Server Instructions**: Supported via `new McpServer({ ... }, { instructions: "..." })` and exposed in the `initialize` result. The Python client can append this directly to system prompts.
- **Structured Content**: The SDK supports `content: [{ type: "text", text: ... }]` and `outputSchema` on tool definitions.

### 2.4 Python Client & Schema Normalization (Experiment D)

- **Python SDK**: `mcp==2.3.0` using `mcp.client.streamable_http.streamable_http_client` and `mcp.ClientSession`.
- Note: Python SDK pydantic models use `snake_case` attributes (e.g. `init_res.server_info`, `tool.input_schema`).
- **OpenAI Schema Normalization**:
  - The local runner (`unsloth/Qwen3.5-4B-GGUF`) rejects or ignores `$schema`, `$id`, `definitions`, and `$defs`.
  - The adapter must strip these keys and ensure `"type": "object"`, `"properties": {...}`, and `"additionalProperties": false`.

### 2.5 Anomaly Detection under Point Cap (Experiment E)

- **Dataset**: `data/derived/measurements.db` (7 days of 5m data, ~2,000 points/device across 3 devices).
- **Parity Result**:
  - `temperature`: 4 baseline anomalies = 4 windowed anomalies (100% match).
  - `humidity`: 2 baseline anomalies = 2 windowed anomalies (100% match).
  - `pressure`: 1 baseline anomaly = 1 windowed anomaly (100% match).
- **Windowing Budget for 30 Days**:
  - 30 days @ 5m resolution = 8,640 points per device.
  - At `MCP_MAX_POINTS_PER_CALL=500`, this requires `ceil(8640 / 500) = 18` windows per device.
  - 18 windows is within the target threshold (<= 20 windows).

### 2.6 Tool Evaluation (Experiment F)

- Comparing 7 eval queries across REST tool schemas (6 tools) vs MCP tool schemas (7 tools including `describe_dataset`):
  - Current REST Schemas: 7/7 correct (100%).
  - MCP-Style Schemas: 7/7 correct (100%).
- The presence of `describe_dataset` and the dynamic metric enums did not degrade tool selection on the 4B local model.

---

## 3. Recommended Adjustments to Proposal

1. **Section 4.2 (Library Choice)**:
   - Finalize decision: Select `@modelcontextprotocol/sdk` (v1.32.1) + `zod` (`^3.25 || ^4.0`). Reject `@rekog/mcp-nest`.
2. **Section 4.4 (Fastify Handler)**:
   - Note the requirement to call `reply.hijack()` in the Fastify controller before passing `req.raw` and `reply.raw` to `StreamableHTTPServerTransport`.
   - Add explicit handler for non-POST methods returning 405 Method Not Allowed.
3. **Section 4.6 & 6.3 (Series Cap & Anomaly Windowing)**:
   - Maintain `MCP_MAX_POINTS_PER_CALL=500`.
   - In `tools/core_data.py`, implement windowed fetching using chunked time intervals (e.g. ~41.6 hours per chunk at 5m resolution) to fetch raw series under the cap when needed by `detect_anomalies`.
4. **Section 6.3 (Python Client)**:
   - Target `mcp>=2.3.0` using `mcp.client.streamable_http.streamable_http_client`. Note that Pydantic attributes in the Python SDK are snake_case (`init_res.server_info`, `tool.input_schema`).

---

## 4. Go / No-Go Decision

**DECISION: GO.**  
The spike confirms that full-stack MCP integration is feasible, performant, and fully compatible with NestJS 11 + Fastify 5 and the local LLM runner without breaking existing functionality or degrading model performance.
