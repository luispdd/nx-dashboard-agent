## Why

Currently, the agent service uses hand-written REST tools tightly coupled to specific endpoints in `dashboard-api`. When new sensor metrics or queries are added to the dashboard, the agent service must be updated with corresponding client methods, schemas, and prompts.

Exposing dashboard telemetry through an in-process Model Context Protocol (MCP) server inside `dashboard-api` decouples data capabilities from consumer implementations. This allows runtime discovery of data tools by any MCP client (such as our agent service or IDEs) while preserving existing REST endpoints and database architectures.

## What Changes

- Add a new read-only feature module `src/app/mcp/` to `apps/dashboard-api` exposing an MCP server over Streamable HTTP at `POST /api/mcp`.
- Mount `@modelcontextprotocol/sdk` (v1.32.1) and `zod` (`^3.25 || ^4.0`) onto Fastify 5 using `reply.hijack()` and `StreamableHTTPServerTransport` in stateless mode.
- Implement an initial declarative tool catalogue reusing existing NestJS domain services (`describe_dataset`, `list_metrics`, `list_devices`, `get_series`, `get_stats`, `compare_devices`).
- Extract domain query constants (bucket intervals, limits, range presets) into a shared module for parity between REST DTOs and MCP schemas.
- Implement point downsampling and response truncation guards (`MCP_MAX_POINTS_PER_CALL=500`).
- Implement optional token bearer authentication (`MCP_AUTH_TOKEN`) and origin verification (`MCP_ALLOWED_ORIGINS`).
- Define the machine-readable versioned core contract `docs/contracts/mcp-core-contract.json` for `list_metrics` and `get_series`.
- Explicitly exclude the `/api/mcp` route from the OpenAPI/Swagger specification so client code generation (`libs/shared/contracts`) remains unaffected.

## Non-goals

- No mutation/write tools, MCP resources, or MCP prompts.
- No third backend service, gRPC, or message brokers.
- No modifications to existing REST endpoints or the Angular frontend shell.
- No database access directly in MCP tool handlers (handlers must call existing services only).

## Capabilities

### New Capabilities
- `dashboard-mcp-server`: Read-only MCP server over Streamable HTTP exposing telemetry tools with bounded outputs, dynamic metric enums, and dataset orientation.

### Modified Capabilities
- `api-openapi-contract`: The OpenAPI specification export SHALL exclude the `/api/mcp` endpoint to keep generated Angular HTTP resource contracts clean and unchanged.

## Impact

- **Affected code**: `apps/dashboard-api` (new `src/app/mcp/` module, shared domain constants, controller updates).
- **Dependencies**: Add `@modelcontextprotocol/sdk` (v1.32.1) and `zod` to workspace dependencies.
- **Contracts**: Create `docs/contracts/mcp-core-contract.json`.
- **ADR**: Record architecture decision record in `docs/adr/0014-dashboard-mcp-server.md`.
