## Context

See `proposal.md` for the motivation and high-level scope.
The Dashboard API is built on NestJS 11 and Fastify 5 (`@nestjs/platform-fastify`), reading from a derived SQLite database via Kysely. Feasibility Spike 0 confirmed that `@modelcontextprotocol/sdk` (v1.32.1) with `StreamableHTTPServerTransport` can be integrated directly with Fastify 5 in stateless mode without conflicts from global pipes or filters.

## Goals / Non-Goals

**Goals:**
- Provide a clean, declarative tool module in `apps/dashboard-api/src/app/mcp/`.
- Ensure strict parity between REST responses and MCP tool responses by calling the same domain services (`MetricsService`, `DevicesService`, `SeriesService`, `StatsService`).
- Prevent any database or repository imports inside MCP tool implementations.
- Publish a machine-readable JSON Schema contract at `docs/contracts/mcp-core-contract.json` for `list_metrics` and `get_series`.
- Keep Swagger / OpenAPI exports and generated Angular client code completely unaffected.

**Non-Goals:**
- Modifying the REST API or database queries.
- Stateful SSE sessions requiring persistent connection storage or heartbeat management.
- Web browser direct access (CORS remains configured for REST; MCP is server-to-server).

## Decisions

### 1. Library Selection: `@modelcontextprotocol/sdk` instead of `@rekog/mcp-nest`
- **Choice**: Use the official `@modelcontextprotocol/sdk` (v1.32.1) + `zod` (`^3.25 || ^4.0`).
- **Rationale**: Spike 0 demonstrated that `@rekog/mcp-nest` introduces heavy microservice strategy dependencies and fragmented beta packages, whereas the official SDK integrates cleanly with Fastify's native Node streams (`req.raw`, `reply.raw`) with minimal footprint.
- **Alternatives considered**: `@rekog/mcp-nest` (rejected due to microservices coupling and TypeORM/passport baggage).
- **ADR**: Recorded in `docs/adr/0014-dashboard-mcp-server.md`.

### 2. Fastify Integration via `reply.hijack()`
- **Choice**: Call `reply.hijack()` in the NestJS controller before passing `req.raw`, `reply.raw`, and `req.body` to `StreamableHTTPServerTransport.handleRequest()`.
- **Rationale**: Fastify manages its own response lifecycle. Delegating raw chunked streaming to the MCP transport requires hijacking the reply so Fastify does not attempt to send headers or body twice.
- **Alternatives considered**: Express adapter (rejected; the monorepo is standardized on Fastify).

### 3. Declarative Tool Registry
- **Choice**: Structure tools as individual definitions implementing a common interface:
  ```typescript
  export interface ToolDefinition<TInput = any, TOutput = any> {
    name: string;
    description: string;
    inputSchema: z.ZodType<TInput>;
    outputSchema?: z.ZodType<TOutput>;
    annotations?: { readOnlyHint?: boolean; idempotentHint?: boolean };
    handler: (input: TInput, services: McpDomainServices) => Promise<ToolResult>;
  }
  ```
- **Rationale**: Adding a new tool only requires creating one file and registering it in `tool-registry.ts`. Tools receive only high-level domain services, preventing accidental repository access.

### 4. Shared Domain Constants
- **Choice**: Extract bucket intervals (`'raw'`, `'5m'`, `'1h'`, `'1d'`), time range presets (`'last_24h'`, `'last_7d'`, `'last_30d'`), and pagination defaults into a shared domain constants module used by both REST DTOs and Zod schemas.
- **Rationale**: Guarantees semantic consistency between REST and MCP without duplicating domain logic.

### 5. Versioned Core Contract
- **Choice**: Establish `docs/contracts/mcp-core-contract.json` defining exact input and output JSON schemas for the core tools (`list_metrics` and `get_series`).
- **Rationale**: Serves as the immutable interface between `dashboard-api` (Change 1) and `agent-service` (Change 2). Both repositories test against this file to prevent schema drift.

## Risks / Trade-offs

- **[Risk] Fastify raw stream response interference** → Mitigated by calling `reply.hijack()` and testing with in-process Streamable HTTP integration tests.
- **[Risk] Schema divergence between class-validator and Zod** → Mitigated by driving both from shared domain constants and running automated REST-vs-MCP parity tests against the seeded database.
- **[Risk] Large series requests overloading LLM context** → Mitigated by setting `MCP_MAX_POINTS_PER_CALL=500` and automatic server-side bucket promotion with `truncated: true`.
- **[Risk] OpenAPI pollution** → Mitigated by excluding the MCP route from Swagger documentation and asserting zero diff in `export-openapi` and `generate-contracts`.
