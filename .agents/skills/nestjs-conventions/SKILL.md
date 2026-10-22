---
name: nestjs-conventions
description: Use when creating or changing the NestJS dashboard API: modules, controllers, services, DTO validation, OpenAPI decorators, error format, and read-only SQLite data access.
---

# NestJS conventions (dashboard API)

Commands go through `bunx nx ...` / `bun`. Use the workspace's installed NestJS version and idioms.

## Role & Architecture

- **Adapter**: NestJS with **Fastify** adapter (`@nestjs/platform-fastify`, ADR-005) for high-performance JSON throughput.
- **Bundler & Build Config**: Webpack in ESM workspaces requires `webpack.config.cjs` (because root `package.json` has `"type": "module"`).
- **Data Store**: Serves dashboard queries (metrics, devices, series, stats) from the **derived, read-only SQLite database** (WAL mode enabled).
- **Tool Backend**: Serves as the authoritative data provider and backend for agent service tool executions.

## Structure

- Feature modules (for example `metrics`, `devices`, `series`, `stats`) with controller, service and DTOs.
- **Controllers are thin**: parse and validate input, call a service, shape the response. No SQL and no business logic in controllers.
- Services contain the logic and depend on a **data-access interface** (repository), not on a concrete SQLite driver. This keeps a later incremental-sync or another store possible without touching services.
- Constructor injection; configuration through a typed config module reading environment variables.

## Data access

- Read-only SQLite connection to the derived database (better-sqlite3 with Kysely or Drizzle; choice recorded in ADR).
- **Parameterized queries only.** Validate `metric_key` against the catalogue and `device_id: string` against known devices before querying.
- Follow `data-and-time-rules`: UTC with `Z`, regular readings by default, no interpolation across gaps, units from the catalogue.
- Always bound results: server-side bucketing/downsampling and limits.
- The database path comes from configuration; open it read-only.

## API design

- Validate every request with DTOs and a validation pipe (whitelist unknown properties, forbid extras).
- Document every endpoint with OpenAPI decorators. The generated OpenAPI spec is the **contract**; clients are generated from it (`libs/shared/contracts`). Any contract change requires regenerating clients.
- Endpoints (see plan): `GET /api/metrics`, `GET /api/devices`, `GET /api/series`, `GET /api/stats`; query params include metric, devices, range, bucket, `include_on_demand`.
- Use one consistent error format via an exception filter (status, code, message, details). Do not leak internals or stack traces.
- Version the API path or document the policy when contracts start to change.

## MCP Module & Telemetry Server (ADR-0014)

- In-process read-only MCP server lives in `src/app/mcp/` mounted at `POST /api/mcp` via `@modelcontextprotocol/sdk` and `StreamableHTTPServerTransport` in stateless mode.
- **Fastify Stream Hijacking**: Fastify controls response lifecycle by default. Call `reply.hijack()` before passing Node raw streams (`req.raw`, `reply.raw`) to `transport.handleRequest()`.
- Non-POST HTTP methods on `/api/mcp` return explicit `405 Method Not Allowed`.
- **Thin Adapters**: MCP tools must only inject and delegate to domain services (`MetricsService`, `DevicesService`, `SeriesService`, `StatsService`, `AppService`). They must NEVER import repositories, Kysely, or database connections directly.
- **Swagger Exclusion**: Decorate `McpController` with `@ApiExcludeController()` so the MCP route is excluded from OpenAPI exports and generated frontend contracts remain clean.
- **Shared Constants**: Use `src/app/common/domain-constants.ts` across both REST DTOs and MCP Zod schemas for parity on buckets, range presets, and limits.

## Security & Local Hardening (ADR-027)

- **Loopback Default**: Server binds to `127.0.0.1` (configurable via `API_HOST`). Logs a security warning if bound to a non-loopback interface.
- **Host & Origin Validation**: `registerHostOriginHook()` validates incoming `Host` against `ALLOWED_HOSTS` (mismatch returns 403) and `Origin` against `ALLOWED_ORIGINS` (foreign origins return 403). Requests without an `Origin` header are allowed.
- **Security Headers**: Register `@fastify/helmet` with `contentSecurityPolicy: false` to emit `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and omit `X-Powered-By`.
- **Constant-Time Comparison**: `McpGuard` validates bearer tokens via `node:crypto.timingSafeEqual`.
- **Swagger Documentation Toggle**: `SWAGGER_ENABLED` controls whether `/api/docs` is registered (404 when disabled; defaults to disabled in production). Contract export (`export-openapi`) remains functional regardless of this toggle.

## Testing & Quality

- Strict TypeScript; no `any` without justification.
- **Unit / Integration Tests**: **Vitest** runner. Requires `import 'reflect-metadata';` in the test setup file.
- **MCP Architectural Boundary Test**: Enforce zero direct persistence imports in `src/app/mcp/`.
- **Parity Tests**: Verify equivalent parameters return identical payloads across REST endpoints and MCP tools on seeded databases.
- **Core Contract Test**: Verify conformance against `docs/contracts/mcp-core-contract.json`.
- **Security Tests**: Verify headers and origin guards in `security-headers.spec.ts` and `host-origin.hook.spec.ts`.
- Structured logging; no secrets in logs; request ids if cheap to add.
- Health endpoint for Docker health checks.

## Checklist

- [ ] Thin controllers, logic in services, data access behind an interface
- [ ] Validated input, parameterized read-only queries, bounded output
- [ ] `device_id` typed as string, UTC ISO timestamps with `Z`
- [ ] OpenAPI updated and clients regenerated
- [ ] Webpack config named `webpack.config.cjs`
- [ ] Tests (`reflect-metadata` setup) and lint pass (`bunx nx affected -t lint test`)
