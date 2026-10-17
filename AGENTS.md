# AGENTS.md

# Core rules

- Never rely on just your knowledge, specially when working with third-party libraries or APIs, do an in-depth research first, paying attention to use the specific version of the library/API that is used in this project.

Guidance for coding agents working in this repository. Keep this file short; detailed rules live in skills under `.agents/skills/`.

## Project

IoT dashboard + data agent: a proof of concept demonstrating full-stack IoT telemetry and local LLM agent orchestration.

- **Dashboard:** Angular 22 shell (host, zoneless, signals-first, SCSS + Tailwind, ApexCharts) showing environmental measurements from IoT nodes.
- **Chat:** React micro frontend (remote, Vite, SCSS + Tailwind, loaded via Native Federation) that talks to an LLM agent about the dashboard data and detects nodes reporting strange data.
- **Dashboard API:** NestJS (TypeScript), read-only access to a derived SQLite database.
- **Agent service:** FastAPI (Python, managed with `uv`). Calls the NestJS API as tools; talks to an OpenAI-compatible LLM endpoint (local runner or cloud API, configurable) through the standard OpenAI API.
- **Data:** a source SQLite file produced by another project is copied and transformed (ETL) into a derived read-only database.
- **Orchestration:** Nx monorepo. Specs managed with OpenSpec.

## Closed decisions (do not reopen without asking)

- Two backend services only. **No** API gateway, gRPC, message broker, Redis, sagas, outbox or database-per-service.
- **No** free-form SQL tool for the agent. Typed, narrow tools only.
- The agent service never opens the database directly; it calls the NestJS API.
- Anomaly statistics are computed deterministically in Python; the LLM only interprets results.
- The LLM provider is configuration (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`), never hardcoded. Resolved from runtime config (`data/runtime-config.json`) when present, falling back to `.env` or defaults.
- OpenAPI specs are the contract between services; clients are generated, never hand-written.
- **Microfrontends:** Angular host (`dashboard-shell`) + React remote (`chat-mfe`) via Native Federation (browser ESM and Import Maps).
- **Styling:** Tailwind CSS + SCSS across all microfrontends.
- **Angular Architecture:** Angular 22, Zoneless (`provideExperimentalZonelessChangeDetection`), Signals-first (`signal`, `computed`, `input`, `output`), and independent files for component (`.ts`), template (`.html`), and styles (`.scss`) with no inline templates or styles.
- **Unit Testing:** Vitest unified across all projects (NestJS, Angular with `vitest-angular`, React with Vitest).
- **E2E Testing:** A single unified Playwright suite at workspace level (`e2e/`) testing the fully deployed project with no backend mocks (no fragmented per-app e2e suites).
- **Charts:** ApexCharts for time-series visualization.
- **Board identity:** `device_id` is a string (e.g. `'esp32c6'`).
- **Containerization & Deployment:** All services (web host Nginx, NestJS API, FastAPI Agent Service) run in Docker. The optional local LLM runs on the host and is reached via `extra_hosts: ["host.docker.internal:host-gateway"]`.
- **Environment Configuration:** A single centralized `.env` at workspace root drives configuration across Docker Compose and local commands (tracked via `.env.example`).
- **Data Ingestion & Demo Data:** A missing database triggers automatic demo data generation on startup (`is_demo` metadata), indicated visibly in the dashboard toolbar. Real database ingestion is initiated on demand from the Dashboard Settings view with an input file selector.

## Tool Selection & Tooling

- TypeScript / Angular / React scripts: run `nx` directly (e.g. `nx affected ...`, `nx serve ...`); use `bun` for package management (`bun install`, `bun add`). Do not prefix with `bunx nx`. Do not use `npm`, `npx`, `yarn` or `pnpm`.
- Python: use `uv` for everything (`uv sync`, `uv add`, `uv run`). Do not use `pip`, `poetry` or bare `python -m venv`.
- Prefer Nx generators over creating projects by hand.
- Prefer `nx affected` over running everything.

## Commands

```bash
bun install                                         # install JS dependencies
nx affected -t lint test build                      # lint, test, build what changed
nx serve <project>                                  # run a project (dashboard-shell, chat-mfe, dashboard-api, agent-service)
nx run-many -t serve --outputStyle=stream           # run all dev servers simultaneously with real-time logs
bun run e2e                                         # run unified workspace Playwright E2E tests against live stack
bun run docker:build                                # build production Docker images for all services
bun run docker:up                                   # launch full containerized stack via Docker Compose
bun run docker:down                                 # stop containerized stack
nx run dashboard-api:seed                            # generate synthetic source SQLite DB
nx run dashboard-api:etl                            # run in-process ETL pipeline to build derived DB
nx run agent-service:eval                           # run agent evaluation benchmark against active LLM
nx run dashboard-api:export-openapi                 # export OpenAPI spec to dist/apps/dashboard-api/openapi.json
nx run shared-contracts:generate-contracts          # generate Angular httpResource services from openapi.json
cd apps/agent-service && uv sync                    # install Python dependencies
cd apps/agent-service && uv run pytest              # run Python tests
cd apps/agent-service && uv run ruff check .        # run Python linter
```

## Non-negotiable rules

1. **Timestamps are UTC with `Z`** everywhere internally (`2026-10-05T08:36:23Z`). The source database has no `Z`; the ETL normalizes it. Never parse a zone-less timestamp with `new Date(...)`. Convert to the viewer's timezone only in the UI. See skill `data-and-time-rules`.
2. **Regular readings by default.** On-demand (manually triggered) readings are excluded from aggregates unless explicitly requested. The source column `is_fine_tuned` is exposed as `sampling: "scheduled" | "on_demand"`.
3. **Never edit generated code** (OpenAPI clients, build outputs). Change the source contract and regenerate.
4. **Never write to the source database.** It is read-only input, stored in the migrations inbox (`data/migrations/`).
5. **No secrets in the repository or in Docker images.** Configuration comes from environment variables or `data/runtime-config.json` (git-ignored); commit only `.env.example`.
6. **Do not implement beyond the active OpenSpec change.** If something is missing from the spec, update the spec or ask.
7. **No private data in the repo.** Use the synthetic seed generator for fixtures and demos.

## Definition of done

A task is done only when all of these hold:

- Lint, typecheck and tests pass for the affected projects.
- New behavior has tests (and an eval case if it changes agent behavior).
- If an API contract changed: the OpenAPI spec is updated and clients are regenerated.
- The active OpenSpec change (spec, tasks) reflects what was actually built.
- No leftover debug code, commented-out code or unused dependencies.

## Skills

Load the relevant skill before working in its area. Conventions skills hold stable rules; `*-quirks` skills hold situational pitfalls and fixes. Check the matching `*-quirks` skill before debugging an unexpected build, test or runtime failure.

| Skill                                 | Use when                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `openspec-workflow`                   | Starting, implementing or finishing any OpenSpec change                              |
| `nx-workspace-conventions`            | Creating projects/libs, changing boundaries, running tasks                           |
| `data-and-time-rules`                 | Touching the ETL, queries, timestamps, sampling or units                             |
| `agent-tool-design`                   | Adding or changing an agent tool, prompt or guardrail                                |
| `testing-strategy`                    | Writing or reviewing tests, fixtures or evals                                        |
| `angular-conventions`                 | Working in the Angular shell                                                         |
| `react-mfe-conventions`               | Working in the React chat remote                                                     |
| `nestjs-conventions`                  | Working in the NestJS API                                                            |
| `fastapi-python-conventions`          | Working in the FastAPI agent service or any Python code                              |
| `nx-and-tooling-quirks`               | Nx generators/tasks, Vitest, tsconfig, Webpack, ng-openapi, OpenSpec CLI hangs       |
| `angular-and-native-federation-quirks`| Tailwind v4, Native Federation config/versions, zoneless tests, template lint        |
| `react-mfe-and-chat-quirks`           | Vite remote entry, `.env` dir, host/remote CORS, drawer state, streaming scroll      |
| `python-agent-service-quirks`         | Python `__init__`, FastAPI tests, asyncio, Ruff, pytest discovery, tool schemas      |
| `nestjs-and-sqlite-quirks`            | NestJS DI in Vitest, Kysely, `better-sqlite3`, reconnect after ETL swap              |
| `docker-and-deployment-quirks`        | Dockerfiles, compose, root `.env`, containers reaching a host LLM                    |
| `e2e-testing-quirks`                  | Playwright web servers, dynamic-data assertions, streaming chat, local LLM runs      |

## Working style

- Make small, reviewable changes; one OpenSpec change per logical slice.
- Ask before adding a new dependency, and prefer what is already in the workspace.
- When a requirement is ambiguous, ask or record the assumption in the spec rather than guessing.
- Explain non-obvious decisions in an ADR under `docs/adr/`.
