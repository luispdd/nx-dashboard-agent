# ADR-0014: In-Process Dashboard MCP Server for Telemetry Tools

## Status
Accepted

## Context
Currently, the Python agent service uses hand-written REST tools tightly coupled to specific endpoints in `dashboard-api`. When new sensor metrics or queries are added to the dashboard, the agent service must be updated with corresponding client methods, schemas, and prompts.

Exposing dashboard telemetry through an in-process Model Context Protocol (MCP) server inside `dashboard-api` decouples data capabilities from consumer implementations. This allows runtime discovery of data tools by any MCP client (such as our agent service or IDEs) while preserving existing REST endpoints and database architectures.

In Feasibility Spike 0, two primary integration approaches were evaluated:
1. `@rekog/mcp-nest`: Introduces heavy dependencies on `@nestjs/microservices` (`CustomTransportStrategy`), unneeded peer packages (`typeorm`, `passport`, `multer`), and fragmented beta core packages (`@modelcontextprotocol/core: ^2.0.0-beta.5`). Furthermore, it lacks clean integration with Fastify's native stream lifecycle.
2. Official `@modelcontextprotocol/sdk` (v1.32.1) + `zod`: Clean integration with Fastify 5 via Node raw streams (`req.raw`, `reply.raw`) using `reply.hijack()` and `StreamableHTTPServerTransport` in stateless mode (`sessionIdGenerator: undefined`). Spike experiments confirmed zero interference from NestJS global pipes (`ValidationPipe` with whitelist/forbid) and filters (`HttpExceptionFilter`).

## Decision
We adopt the official `@modelcontextprotocol/sdk` (v1.32.1) and `zod` (`^3.25 || ^4.0`) to build an in-process read-only MCP server inside `apps/dashboard-api`:

1. **Endpoint & Transport**:
   - Expose a single HTTP route at `POST /api/mcp`.
   - Integrate with Fastify 5 using `reply.hijack()` and stateless `StreamableHTTPServerTransport`.
   - Return explicit `405 Method Not Allowed` for non-POST HTTP methods.
   - Support optional bearer token authentication (`MCP_AUTH_TOKEN`) and origin verification (`MCP_ALLOWED_ORIGINS`).

2. **Declarative Tool Architecture**:
   - Scaffold `src/app/mcp/` with declarative `ToolDefinition` interfaces and dynamic metric enum resolution.
   - MCP tools are thin adapters delegating strictly to existing domain services (`MetricsService`, `DevicesService`, `SeriesService`, `StatsService`).
   - Architectural boundary: no direct imports of Kysely, SQLite connections, or repositories within `src/app/mcp/`.

3. **Output Bounding & Data Invariants**:
   - Cap series data to `MCP_MAX_POINTS_PER_CALL` (default 500) with automatic server-side bucket promotion and `truncated: true` indicators.
   - Strict adherence to `data-and-time-rules`: UTC ISO timestamps with `Z`, regular readings by default, gaps represented as `null` (never 0), and physical units preserved.

4. **Contract Isolation**:
   - Establish `docs/contracts/mcp-core-contract.json` defining JSON schemas for core tools (`list_metrics`, `get_series`).
   - Explicitly exclude `/api/mcp` from Swagger DocumentBuilder so OpenAPI exports (`dist/apps/dashboard-api/openapi.json`) and generated Angular client services (`libs/shared/contracts`) remain unaffected.

## Consequences & Verification
- **Decoupling**: Consumers discover tools dynamically at runtime without needing hardcoded REST client tools or schema synchronization.
- **Maintainability & Parity**: Reusing existing domain services guarantees exact data and calculation parity with REST endpoints.
- **Verification**:
  - Unit tests with mocked domain services.
  - Architectural boundary lint/test ensuring no database imports in the MCP module.
  - End-to-end parity test against seeded SQLite DB asserting identical values between REST endpoints and MCP tools.
  - Contract conformance test verifying compliance with `docs/contracts/mcp-core-contract.json`.
  - Zero git diff in exported OpenAPI contracts.
