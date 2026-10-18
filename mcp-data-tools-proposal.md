# Proposal: Dashboard MCP data tools and generic agent tool discovery

Brief for the coding agent. Use it as the input for `openspec-explore` / `openspec-propose`. It defines a throwaway feasibility spike (section 0, run first, no OpenSpec change) and **two OpenSpec changes**, to be created and implemented in order after the spike:

1. `mcp-data-tools-server` (project: `dashboard-api`)
2. `agent-mcp-client` (project: `agent-service`, depends on change 1)

Follow `AGENTS.md` and the skills in `.agents/skills/` throughout. In particular: research the exact installed versions of every third-party library before using it (core rule in `AGENTS.md`), use `nx` directly with `bun` for packages and `uv` for Python, keep timestamps UTC with `Z`, and do not implement anything beyond what the active change's spec says.

---

## 0. Spike 0: feasibility (run before change 1, throwaway)

Timeboxed (about 5 hours) and discardable. Work on a scratch branch or git-ignored folder. Do not modify the workspace `package.json` or `pyproject.toml` (use a scratch Nest app, or `uv run --with mcp` for Python). Output is `spike-findings.md`, not code to keep. Its results may amend sections 4 to 6 (library, cap value, schema rules).

| # | Uncertainty | Minimum experiment | Pass criterion |
|---|---|---|---|
| A | MCP library works on NestJS 11 + Fastify 5 | Add `@rekog/mcp-nest` and `zod`, expose a dummy tool `ping(echo)` at `POST /api/mcp`. If it fails, mount `@modelcontextprotocol/sdk` stateless Streamable HTTP on the Fastify instance. | A client (`bunx @modelcontextprotocol/inspector` or the Python SDK) completes initialize, `tools/list`, `tools/call`. Record library and versions. |
| B | Global `ValidationPipe`, `HttpExceptionFilter` and `api` prefix do not interfere | Run A inside the real `main.ts` configuration. | Tool errors arrive as `isError: true`; the OpenAPI export has no MCP route. |
| C | Stateless mode, version negotiation, `instructions`, `structuredContent` | Call without a session id; inspect the negotiated protocol revision and returned fields. | Repeated sessionless calls succeed. Record the revision and supported features. |
| D | Python SDK client works, and schemas are accepted by the local LLM | Scratch script: connect, list tools, convert one schema to an OpenAI function, send it to the configured LLM. | The model calls the tool with valid arguments. Record schema keywords that must be stripped. |
| E | Anomaly detection is feasible under the point cap | With the seeded DB and the real series service, request 30 days of one metric at 5-minute data; count windows at cap 500; run the existing detector on windowed versus REST data. | 20 windows or fewer (or tune the cap / add `max_points`), and the same injected anomalies are flagged. |
| F | Tool-list size does not hurt the small local model | Run 5 to 8 eval questions with MCP-style versus current REST tool schemas. | Tool-call accuracy equal within noise. Quick signal only, not the full eval. |

Order: A, B, C (about 2 h, shared setup), then D and E (about 1 h each, independent), then F (about 30 min, needs D). If A fails with both libraries, stop and revisit this proposal.

`spike-findings.md` must record: chosen library and versions, negotiated spec revision, `instructions` / `structuredContent` support, any pipe/filter workaround, schema keywords to strip, window count and detector parity from E, and a go/no-go with proposed edits to this document.

---

## 1. Why

Today the agent service owns a hand-written REST client (`DashboardApiClient`) and one hand-written Python tool per data capability. Every time the dashboard side gains a data capability (a new sensor type, a richer query, a different way to represent the data), the agent service must also change: a new client method, a new tool schema, a new prompt mention.

We want the opposite. The dashboard side publishes a **set of tools with descriptions** through a Model Context Protocol (MCP) server. The agent service discovers those tools at runtime, offers them to the model and routes the calls, **without knowing any data tool by name**. Evolving the data side then means adding or editing tools in `dashboard-api` only.

Secondary benefits: the dashboard data becomes consumable by any MCP client (IDE agents, desktop assistants), and the project showcases a current, relevant protocol.

## 2. Decisions already made (do not reopen without asking)

- The MCP server lives **inside `apps/dashboard-api`** as its own feature module. No new app, no third backend service.
- The MCP server is **read-only**. No write tools.
- The tool set is **hand-designed**. No automatic OpenAPI-to-MCP conversion.
- The existing REST endpoints (`/api/metrics`, `/api/devices`, `/api/series`, `/api/stats`, `/api/database/status`) and the Angular `httpResource` services **stay unchanged**. They serve the dashboard.
- REST controllers and MCP tools are **both thin adapters over the same NestJS services**. No query logic, bucketing, sampling rule or validation logic is duplicated in either adapter.
- `detect_anomalies` **remains a local tool inside `agent-service`**. It is the only data-related tool defined in the agent service. It obtains its data through MCP.
- The agent service has **no knowledge of data tool names**, except the small documented **core contract** (section 5) that `detect_anomalies` depends on.
- After migration, the agent service **does not call the dashboard REST API at all**. The REST client, the REST-based data tools and the `DASHBOARD_API_BASE_URL` setting are removed.
- The agent service keeps owning: LLM provider config, the system prompt, step limits, timeouts, output caps and SSE streaming.

## 3. Non-goals

- Write/mutation tools, MCP resources, MCP prompts (server *instructions* are in scope, see 4.5).
- Authentication beyond an optional shared token for the MCP route.
- Replacing REST in the Angular shell, or any shell/UI change.
- Docker/Compose work (not built yet). Only keep configuration compatible with a service-name URL.
- Moving ETL, seed generator or anomaly code out of `agent-service`.
- A second MCP server. The client config accepts a list of URLs, but only the dashboard MCP is configured.

## 4. Change 1: `mcp-data-tools-server` (dashboard-api)

### 4.1 Capabilities

- New capability: `dashboard-mcp-server`.
- Modified: `api-openapi-contract` (the MCP route is excluded from the OpenAPI contract and from generated shell clients).

### 4.2 Library choice (the agent must verify, then record an ADR)

No spike is planned, so the choice is part of task 1. Candidates:

- `@rekog/mcp-nest` (NestJS module with `@McpController` / `@Tool`, Zod parameters, Streamable HTTP and stdio, guard-based auth).
- The official TypeScript SDK `@modelcontextprotocol/sdk`, with the Streamable HTTP transport mounted on the Fastify adapter.

Selection criteria, in priority order: works with this workspace's **Fastify adapter** and **NestJS 11**; Streamable HTTP supported; supports the **current MCP spec revision** and negotiates backward compatibility with the previous initialize-based revision; stateless operation (no reliance on connection sessions); tool `inputSchema` and, if possible, `outputSchema`/`structuredContent`; tool annotations (`readOnlyHint`); active maintenance. Verify against the installed versions' documentation, not memory. If the Nest module does not work with Fastify, use the official SDK directly. Record the outcome in `docs/adr/` (follow the existing ADR naming convention) before implementing tools.

Approved new dependencies, subject to the verification above: the chosen MCP library and `zod` (only if not already installed and only in the version the library requires). Nothing else without asking.

### 4.3 Module structure

```
apps/dashboard-api/src/app/mcp/
  mcp.module.ts
  mcp.config.ts                  # env-driven settings
  tools/
    tool-definition.ts           # declarative tool definition type
    tool-registry.ts             # collects definitions, registers them with the MCP library
    describe-dataset.tool.ts
    list-metrics.tool.ts
    list-devices.tool.ts
    get-series.tool.ts
    get-stats.tool.ts
    ...                          # one file per tool
  mcp-auth.guard.ts              # optional shared-token / origin check
  mcp.module.spec.ts, tools/*.spec.ts
```

Rules:

- A tool is **one declarative definition**: `name`, `title`, `description`, `inputSchema`, optional `outputSchema`, annotations (`readOnlyHint: true`, `idempotentHint: true`), and a `handler`. Adding a tool means adding one file and registering it in one list.
- Handlers may inject and call **services only**. They must not inject the repository, controllers, Kysely or a database handle. Enforce with an ESLint restriction or Nx boundary rule if feasible, otherwise with a test that inspects imports.
- Shared domain constants (bucket values, range presets, defaults, limits) live in **one shared module** used by both REST DTOs and MCP schemas. Where REST uses class-validator and MCP uses Zod, the schemas are parallel but must be covered by the parity test in 4.8.
- Under Vitest, decorators do not emit `design:paramtypes`. Use explicit `@Inject(...)` everywhere (see `AGENTS.md`).

### 4.4 Endpoint and transport

- Route: `POST /api/mcp` (keeps the existing global `api` prefix). Streamable HTTP only. No stdio. Stateless: each request is self-contained.
- The global `ValidationPipe` and `HttpExceptionFilter` must not corrupt MCP responses. Verify with a test, and exclude the route from them if needed.
- The route is **not** part of Swagger/OpenAPI. `nx run dashboard-api:export-openapi` output and `libs/shared/contracts` generated code must be unchanged by this change (verify by regenerating and diffing).
- Do not change the existing global `enableCors()` behavior for REST. The MCP route is server-to-server; browser access is not a goal.

### 4.5 Tool catalogue (initial)

Inspect the current services, DTOs and the agent service's `tools/registry.py` first. Migrate **every existing agent-side data capability 1:1** (same inputs, same semantics) and add `describe_dataset`. Expected set (adjust names only if the current code strongly suggests otherwise, and record the mapping in the change notes):

| Tool | Purpose | Notes |
|---|---|---|
| `describe_dataset` | Orientation: what data exists | Metrics with units, device ids, time coverage (first/last timestamp), sampling semantics (regular readings every 5 minutes, on-demand readings excluded by default), timestamp convention (UTC, `Z`), whether the data is demo data (from existing database status service). Must reflect new metrics/devices automatically. |
| `list_metrics` | Metric catalogue | **Core contract.** |
| `list_devices` | Device ids | Strings (e.g. `esp32c6`). |
| `get_series` | Downsampled time series | **Core contract.** |
| `get_stats` | min, max, mean, std, count, missing ratio per device | Supports several devices in one call if the service does. |
| `compare_devices` (only if it exists in the agent today) | Per-device comparison for one metric | Implement over the same stats service. Do not invent new behavior. |

Tool design rules:

- `metric_key` is an **enum generated from the catalogue at registration/list time**, so a new sensor appears in the schema without code changes. Device parameters are validated against known devices.
- Time ranges accept a preset (`last_24h`, `last_7d`, `last_30d`) or explicit ISO-8601 UTC `from`/`to` with `Z`. Zone-less timestamps are rejected. Presets are resolved on the server using an injectable clock.
- `include_on_demand` defaults to `false`.
- Outputs: compact JSON, **units always included**, missing data as `null` (never `0`), no interpolation across gaps, and a bounded size (4.6). If the library supports it, return `structuredContent` plus a text content block with the same JSON.
- Descriptions are written **for a small local model**: one or two sentences on when to use the tool, what each parameter means, and what the output contains. Treat descriptions as prompts: they are covered by evals (change 2).
- Errors are returned as tool errors (`isError: true`) with an actionable message, for example "unknown metric_key 'temp'; valid values: temperature, humidity". Never stack traces, never raw SQL.

Server instructions: if the chosen library and spec revision support a server-level `instructions` string, provide a short one (what the dataset is, rules such as UTC and regular-vs-on-demand, suggested first step). Otherwise `describe_dataset` carries that information. The agent service must not hardcode it.

### 4.6 Output bounding

- Setting `MCP_MAX_POINTS_PER_CALL` (default 500). A `get_series` request that would exceed it is **downsampled to a larger bucket** by the service and the response states the effective bucket and `"truncated": true` (or equivalent), never silently dropped.
- Cap the number of devices per call at a documented constant.

### 4.7 Configuration and security

Environment variables (add to `.env.example`, keep the existing layered config conventions):

- `MCP_ENABLED` (default `true`)
- `MCP_MAX_POINTS_PER_CALL` (default `500`)
- `MCP_AUTH_TOKEN` (optional; when set, requests must carry `Authorization: Bearer <token>`)
- `MCP_ALLOWED_ORIGINS` (optional; when a request carries an `Origin` header it must match, per the transport guidance of the implemented spec revision. Verify the exact requirement in the spec revision you implement.)

Read-only by construction: no tool performs writes, and the database connection remains read-only. Log tool name, duration and result size. Do not log secrets or full arguments at info level.

### 4.8 Requirements and scenarios (draft for `dashboard-mcp-server` spec)

Write the spec in the repository's OpenSpec style (`### Requirement:` / `#### Scenario:` with WHEN/THEN, SHALL).

- **Requirement: MCP endpoint.** The API SHALL expose a read-only MCP server over Streamable HTTP at `/api/mcp`.
  - *Scenario: tool discovery.* WHEN an MCP client lists tools THEN the response SHALL contain every tool in the catalogue with name, description and input schema.
  - *Scenario: route excluded from contract.* WHEN `export-openapi` runs THEN the exported spec SHALL NOT contain the MCP route and the generated shell client SHALL be unchanged.
- **Requirement: adapters over shared services.** MCP tools and REST controllers SHALL delegate to the same services and SHALL contain no query or business logic.
  - *Scenario: parity.* WHEN a tool and its REST counterpart are called with equivalent inputs against the same seeded database THEN both SHALL return the same data (envelope aside).
  - *Scenario: no persistence access.* WHEN the MCP module's imports are inspected THEN they SHALL NOT include the repository, Kysely or a database handle.
- **Requirement: dynamic catalogue.** `metric_key` SHALL be an enum derived from the current catalogue.
  - *Scenario: new sensor.* WHEN a derived database containing an additional metric is loaded THEN the tool schema and `describe_dataset` SHALL include it without code changes.
- **Requirement: bounded, unit-bearing outputs.**
  - *Scenario: large range.* WHEN `get_series` is requested for a range exceeding the point cap THEN the response SHALL use a larger effective bucket, state it, and flag truncation.
  - *Scenario: gaps.* WHEN readings are missing THEN the output SHALL contain `null` values, not zeros.
- **Requirement: actionable errors.**
  - *Scenario: invalid metric.* WHEN `get_series` is called with an unknown `metric_key` THEN the server SHALL return a tool error listing valid values.
  - *Scenario: zone-less timestamp.* WHEN `from` lacks a `Z` suffix THEN the server SHALL return a tool error explaining the required format.
- **Requirement: read-only and guarded.**
  - *Scenario: token required.* WHEN `MCP_AUTH_TOKEN` is set and a request lacks it THEN the server SHALL reject the request.
  - *Scenario: filters do not interfere.* WHEN a tool returns an error THEN the global exception filter SHALL NOT replace the MCP error response.

### 4.9 Tasks (change 1)

- [ ] 1.1 Read the current services, DTOs, controllers, `main.ts` and the agent service's data tools; write the REST-to-tool mapping into the change notes.
- [ ] 1.2 Verify the MCP library options against installed versions (Fastify adapter, NestJS 11, Streamable HTTP, current spec revision, stateless operation, Zod version). Choose, then write the ADR.
- [ ] 1.3 Install the approved dependencies with `bun add`.
- [ ] 1.4 Create `mcp/` with the config, tool-definition type and tool registry.
- [ ] 1.5 Extract shared domain constants used by both REST DTOs and MCP schemas into one module; update REST DTOs to use them without changing REST behavior.
- [ ] 1.6 Implement the tools in 4.5 as thin adapters, with schemas, descriptions and bounded outputs.
- [ ] 1.7 Implement the optional auth/origin guard and server instructions (if supported).
- [ ] 1.8 Mount the route at `/api/mcp`; make sure the global pipe and filter do not break MCP responses.
- [ ] 1.9 Unit tests per tool with a fake service; integration test with a real derived database built from the seed generator, using an in-process MCP client; parity test REST vs MCP; error-path tests; dynamic-catalogue test.
- [ ] 1.10 Core-contract file and test (section 5): the server's `list_metrics` and `get_series` satisfy it.
- [ ] 1.11 Verify:
  - [ ] `nx run dashboard-api:export-openapi` then `nx run shared-contracts:generate-contracts` leave the repository unchanged (no diff in generated code)
  - [ ] run the API and connect with an MCP inspector client (run it with `bunx`, do not add it as a dependency): list tools, call every tool, confirm output sizes and units
  - [ ] REST endpoints and the Angular shell still work (`nx serve dashboard-shell` with the API running; the `dashboard-shell-e2e` and `chat-mfe-e2e` suites pass)
- [ ] 1.12 Docs: update `README.md` (architecture diagram, env vars, new route), `.env.example`, `AGENTS.md` (closed-decision wording: the agent will consume data tools through MCP), and skills `nestjs-conventions` (MCP module rules, adapter-only rule, `@Inject` reminder) and `testing-strategy` (parity test).
- [ ] 1.13 `nx affected -t lint test build` passes; change notes list what was verified and the actual findings; `openspec validate --all`.

---

## 5. Core contract

`detect_anomalies` (local) needs raw data, so it depends on two MCP tools. This is the **only** place where the agent service references data tool names. It is a deliberately small, versioned contract:

- `list_metrics`: returns the metric catalogue (key, unit).
- `get_series`: returns time series for one metric over a range, for one or more devices, with the effective bucket and a truncation flag.

Write the exact input and output shapes **explicitly** in a machine-readable file `docs/contracts/mcp-core-contract.json` (JSON Schema for inputs and outputs), derived from the current REST `/api/metrics` and `/api/series` parameters and response fields so the migration is behavior-preserving. Both projects test against this single file:

- `dashboard-api`: the server's tools satisfy the contract (change 1).
- `agent-service`: the client's expectations match it (change 2).

Note for tests: under Vitest `process.cwd()` is the project directory, so locate the file by searching upwards (see `AGENTS.md`).

Anything beyond these two tools is free to change or grow without touching the agent service.

---

## 6. Change 2: `agent-mcp-client` (agent-service)

### 6.1 Capabilities

- New capability: `agent-mcp-tool-discovery`.
- Modified: `agent-tools-catalogue` (data tools now come from MCP; `detect_anomalies` stays local), `agent-system-prompt-and-guardrails` (generic, no data-tool names), `agent-eval-suite` (runs with the MCP backend), `runtime-config-foundation` (new settings, removed `DASHBOARD_API_BASE_URL`).

### 6.2 Dependencies

Approved, subject to verification against the installed version's documentation: the official Python MCP SDK (`mcp`), added with `uv add mcp`. Nothing else without asking. Read the SDK docs for the exact client API of the installed version. The client entry point and transport helpers have changed between revisions.

### 6.3 Components

```
apps/agent-service/src/agent_service/
  clients/mcp_client.py          # connect, list tools, call tool, timeouts, one retry on transport error
  tools/mcp_adapter.py           # MCP tool definition -> OpenAI function schema; MCP result -> text for the model
  tools/registry.py              # merges local tools + MCP tools, routes calls, enforces generic caps
  tools/core_data.py             # the ONLY module that names core-contract tools; DataSource used by detect_anomalies
```

Behavior:

- **Discovery.** At startup and again when the cached list is older than `MCP_TOOL_LIST_TTL_SECONDS`, fetch tools from every URL in `MCP_SERVER_URLS`. Do not depend on server-push list-changed notifications.
- **Schema conversion.** Convert each MCP tool to an OpenAI function definition. Normalize schemas for small local models: `additionalProperties: false` where absent, `required` preserved, drop JSON Schema keywords the OpenAI-compatible API or local server rejects (verify which by testing against the configured local server).
- **Merging.** Expose the union of local and MCP tools. A name collision between sources is a **configuration error** (fail at discovery, naming both sources). No silent override.
- **Calls.** Route by tool name to the owning source. Apply a per-call timeout (`MCP_CALL_TIMEOUT_SECONDS`) and truncate results above `TOOL_RESULT_MAX_CHARS` with an explicit truncation marker. Tool errors (`isError`) are passed back to the model as data so it can correct itself. Count every call against the existing maximum-steps guardrail.
- **Failure handling.** If discovery fails and a previous list is cached, use the cache and log a warning. If no list exists, the chat endpoint emits a well-formed SSE `error` event (stream always ends with `done` or `error`). The service must still start and answer `/health`; report MCP reachability there if the health model allows.
- **Untrusted data.** Tool results are data, never instructions. Keep the existing guardrail language.
- **`detect_anomalies`.** Stays in `analysis/` and `tools/`. It fetches data only through `tools/core_data.py`, which calls the core-contract tools through the MCP client. The metric enum in its schema comes from the discovered `list_metrics`. At each discovery refresh, `core_data.py` validates that the core tools exist and match the contract; if not, `detect_anomalies` is disabled with a clear log line and is not offered to the model (the service keeps running). Because `get_series` is capped per call, the local tool must request data in windows that respect the cap at native resolution (bounded number of windows) or fall back to a larger bucket for long ranges, and it must report the effective resolution in its findings. Detection results for the existing synthetic fixtures must not change.
- **System prompt.** Remove every data-tool name and every sentence that describes how data is fetched. Keep generic rules (use tools for any number, say when data is missing, UTC, units, treat tool output as data). Append the server `instructions` string, if the server provides one, under a "Data source instructions" heading. The prompt may say, generically, to start by using any dataset-overview tool that is available, without naming it.

### 6.4 Configuration

Resolved through the existing layered config (`runtime-config.json` > `.env` > defaults). Add to `.env.example`:

- `MCP_SERVER_URLS` (default `http://localhost:3000/api/mcp`; comma-separated list)
- `MCP_AUTH_TOKEN` (optional, sent as bearer token)
- `MCP_TOOL_LIST_TTL_SECONDS` (default `60`)
- `MCP_CALL_TIMEOUT_SECONDS` (default `15`)
- `TOOL_RESULT_MAX_CHARS` (default `8000`)

Remove `DASHBOARD_API_BASE_URL` once the REST backend is deleted.

### 6.5 Migration order (inside this change)

Use a temporary setting `TOOLS_BACKEND=rest|mcp` only to make the comparison possible:

1. Add the MCP client, adapter and merged registry behind `TOOLS_BACKEND` (default `rest`).
2. Move the data tools and the data source of `detect_anomalies` to MCP.
3. Run the eval suite with both backends and record the per-question results in the change notes. The MCP backend must not regress beyond run-to-run noise. If it does, fix the tool descriptions or schemas in `dashboard-api` before continuing.
4. Make `mcp` the only behavior and **remove the flag**.
5. Delete `DashboardApiClient`, the REST-based tool implementations, their tests, and the `DASHBOARD_API_BASE_URL` setting.

### 6.6 Requirements and scenarios (draft)

- **Requirement: runtime tool discovery.** The agent service SHALL discover data tools from the configured MCP servers and offer them to the model.
  - *Scenario: new tool without agent changes.* GIVEN a fake MCP server exposing a tool the agent service has never seen WHEN a chat request is processed THEN the tool SHALL appear in the tool list sent to the LLM and a call to it SHALL be routed to that server, with no change to agent service source.
  - *Scenario: refresh.* WHEN the cached tool list is older than the TTL THEN the next request SHALL re-fetch it.
- **Requirement: generic prompt.** The system prompt SHALL NOT contain data-tool names.
  - *Scenario: prompt inspection.* WHEN the prompt is built THEN no discovered or core data tool name SHALL appear in its static text.
- **Requirement: name collisions are errors.**
  - *Scenario: collision.* WHEN a local and an MCP tool share a name THEN discovery SHALL fail naming both sources.
- **Requirement: generic guardrails.**
  - *Scenario: oversized result.* WHEN a tool result exceeds `TOOL_RESULT_MAX_CHARS` THEN it SHALL be truncated with an explicit marker.
  - *Scenario: step limit.* WHEN the model makes more tool calls than the maximum THEN the run SHALL stop with a well-formed error or final answer.
  - *Scenario: tool error as data.* WHEN a tool returns an error THEN the error text SHALL be returned to the model, not raised as a service failure.
- **Requirement: anomaly detection through the core contract.**
  - *Scenario: unchanged results.* WHEN `detect_anomalies` runs against the synthetic dataset through MCP THEN it SHALL report the same injected anomalies as before the migration.
  - *Scenario: contract violation.* WHEN the server lacks a core tool or its schema deviates THEN `detect_anomalies` SHALL be disabled with a clear log and the service SHALL keep running.
- **Requirement: graceful MCP outage.**
  - *Scenario: server down, no cache.* WHEN the MCP server is unreachable and no tool list is cached THEN the chat endpoint SHALL emit a well-formed `error` event and the stream SHALL terminate.
- **Requirement: no REST dependency.**
  - *Scenario: removal.* WHEN the agent service source is searched THEN there SHALL be no client for the dashboard REST API and no `DASHBOARD_API_BASE_URL` setting.

### 6.7 Tasks (change 2)

- [ ] 2.1 Read `tools/registry.py`, `tools/schemas.py`, `clients/dashboard_api.py`, `agent/prompt.py`, `agent/orchestrator.py`, the config module and the eval runner; write the mapping from existing tools to MCP tools into the change notes.
- [ ] 2.2 Verify the installed MCP Python SDK client API; add it with `uv add mcp`.
- [ ] 2.3 Implement `mcp_client.py` (connect, list, call, timeout, single retry on transport errors, bearer token).
- [ ] 2.4 Implement `mcp_adapter.py` (schema normalization; result to model text). Test the normalized schemas against the configured local LLM server to confirm they are accepted.
- [ ] 2.5 Rework `registry.py`: merged registry, collision detection, routing, caps, TTL refresh, failure handling.
- [ ] 2.6 Implement `core_data.py` and the contract validation at each refresh; wire `detect_anomalies` to it, including windowed fetching under the point cap.
- [ ] 2.7 Add `TOOLS_BACKEND` temporarily; move all data tools to MCP.
- [ ] 2.8 Generalize the system prompt; add support for server instructions.
- [ ] 2.9 Tests (no network, no real LLM in unit tests): fake MCP server fixture (in-process, built with the SDK) used for discovery, routing, refresh, collision, oversize, tool-error, outage and "new tool without code change" scenarios; core-contract test against `docs/contracts/mcp-core-contract.json`; anomaly regression test on the seeded synthetic dataset; prompt-has-no-tool-names test.
- [ ] 2.10 Evals: run the suite on `rest` and `mcp`, record both in the change notes, resolve regressions by improving descriptions/schemas in `dashboard-api`.
- [ ] 2.11 Flip to MCP-only, remove `TOOLS_BACKEND`, delete the REST client, REST tools, their tests and `DASHBOARD_API_BASE_URL`; update `.env.example` and config tests.
- [ ] 2.12 Verify end to end with the real stack (`dashboard-api` + `agent-service` + local LLM): ask questions that exercise `describe`-style discovery, a series query, stats, and an anomaly question; confirm the SSE stream shows tool steps and ends with `done`. Run `nx e2e dashboard-shell-e2e` and `nx e2e chat-mfe-e2e` and confirm they still pass.
- [ ] 2.13 Proof of the goal (manual, recorded in change notes): add a new dummy tool in `dashboard-api`'s MCP module, restart only the API, and confirm the agent can use it with **no diff in `apps/agent-service`**. Then remove the dummy tool.
- [ ] 2.14 Docs: rewrite `agent-tool-design` ("add data tools in the dashboard MCP module, never in the agent; local tools only for agent-side analysis"), update `fastapi-python-conventions` (MCP client rules), `AGENTS.md` (closed decisions: the agent calls MCP tools, not REST), `README.md` (diagram, env vars) and add an ADR for "agent discovers data tools through MCP; `detect_anomalies` stays local; core contract".
- [ ] 2.15 `nx affected -t lint test build`, `uv run pytest`, `uv run ruff check .` pass; `openspec validate --all`; change notes list what was verified and actual findings.

---

## 7. Risks and what to watch

| Risk | Mitigation |
|---|---|
| The small local model chooses tools worse as the catalogue grows | Keep the catalogue small and curated, write descriptions as prompts, cover them in evals, and re-run evals whenever a tool or description changes |
| MCP spec and SDKs are still moving | Verify installed versions; isolate protocol details in `mcp_client.py` and the server's `tool-registry.ts`; negotiate the version rather than assuming it |
| Nest MCP module and Fastify compatibility | Fallback: official TypeScript SDK mounted on the Fastify instance (decided in task 1.2) |
| Core contract drifts between server and agent | Single contract file tested from both projects |
| Capped `get_series` weakens anomaly detection on long ranges | Windowed fetching at native resolution with a bounded window count, effective resolution reported in findings |
| REST and MCP semantics diverge | Shared services and constants, parity test |
| Extra network surface | Read-only tools, optional bearer token, origin check, no browser exposure intended |

## 8. Definition of done (both changes)

- All tasks checked; every spec scenario has a test or a recorded manual check.
- REST endpoints and the Angular shell are unchanged and still pass their tests and both e2e projects.
- No data-tool name appears in the agent service source or prompt except in `tools/core_data.py` and its tests.
- No REST client for the dashboard exists in the agent service.
- ADRs, `AGENTS.md`, README, `.env.example` and the affected skills are updated and consistent with each other (check for stale statements about the agent calling REST).
- The "no diff in `apps/agent-service`" proof (task 2.13) is recorded.
