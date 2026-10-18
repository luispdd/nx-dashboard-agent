## 1. Setup and Dependencies

- [x] 1.1 Record ADR `docs/adr/0014-dashboard-mcp-server.md` establishing the choice of `@modelcontextprotocol/sdk` and `zod` based on Spike 0 findings
- [x] 1.2 Add `@modelcontextprotocol/sdk` (v1.32.1) and `zod` (`^3.25 || ^4.0`) to root `package.json` using `bun add` and verify `bun install` succeeds
- [x] 1.3 Create the core contract file `docs/contracts/mcp-core-contract.json` defining JSON schemas for inputs and outputs of `list_metrics` and `get_series`

## 2. Shared Constants and DTOs

- [x] 2.1 Extract domain query constants (bucket intervals, presets, limits) into `apps/dashboard-api/src/app/common/domain-constants.ts`
- [x] 2.2 Refactor REST DTOs in `metrics`, `devices`, `series`, and `stats` to consume shared domain constants and verify existing REST unit tests pass

## 3. MCP Module Architecture and Tools

- [x] 3.1 Create `apps/dashboard-api/src/app/mcp/` scaffolding with `mcp.config.ts`, `tools/tool-definition.ts`, and `tools/tool-registry.ts`
- [x] 3.2 Implement `describe-dataset.tool.ts` and verify it provides metrics with units, device list, time coverage bounds, and demo status
- [x] 3.3 Implement `list-metrics.tool.ts` and `list-devices.tool.ts` as thin adapters over `MetricsService` and `DevicesService`
- [x] 3.4 Implement `get-series.tool.ts` with dynamic metric enum validation, point capping (`MCP_MAX_POINTS_PER_CALL=500`), automatic bucket downsampling, and `truncated` indicator
- [x] 3.5 Implement `get-stats.tool.ts` and `compare-devices.tool.ts` as thin adapters over `StatsService`

## 4. Endpoint, Guards, and Swagger Exclusion

- [x] 4.1 Implement `McpController` at `POST /api/mcp` using `reply.hijack()` and stateless `StreamableHTTPServerTransport`
- [x] 4.2 Add explicit 405 Method Not Allowed handler for non-POST HTTP methods on `/api/mcp`
- [x] 4.3 Implement optional authentication guard for `MCP_AUTH_TOKEN` and origin check for `MCP_ALLOWED_ORIGINS`
- [x] 4.4 Exclude `/api/mcp` from Swagger DocumentBuilder in `main.ts` and verify `nx run dashboard-api:export-openapi` results in zero git diff in `openapi.json` and `libs/shared/contracts`

## 5. Testing and Parity Verification

- [x] 5.1 Add unit tests for each MCP tool with mocked domain services and verify with `nx test dashboard-api`
- [x] 5.2 Add architectural boundary test asserting no direct imports of database repositories or Kysely inside `apps/dashboard-api/src/app/mcp/`
- [x] 5.3 Implement parity test comparing REST endpoint responses against MCP tool calls with equivalent parameters on the seeded database
- [x] 5.4 Implement core contract conformance test asserting `list_metrics` and `get_series` strictly satisfy `docs/contracts/mcp-core-contract.json`
- [x] 5.5 Verify end-to-end integration with an in-process MCP client: test initialize, server instructions, `tools/list`, and `tools/call` for valid and invalid inputs

## 6. Documentation and Quality Gates

- [x] 6.1 Update `README.md`, `.env.example`, and `AGENTS.md` to reflect the new `/api/mcp` endpoint and configuration settings
- [x] 6.2 Update skill `nestjs-conventions` with MCP module rules, thin adapter guidelines, and Fastify stream hijacking patterns
- [x] 6.3 Run `nx affected -t lint test build` and verify that all affected projects pass cleanly
- [x] 6.4 Validate OpenSpec change with `openspec validate --all`
