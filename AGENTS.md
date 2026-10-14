# AGENTS.md

Guidance for coding agents working in this repository. Keep this file short; detailed rules live in skills under `.agents/skills/`.

## Project

IoT dashboard + data agent: a proof of concept used as an interview showcase and as a learning project.

- **Dashboard:** Angular 22 shell (host, zoneless, signals-first, SCSS + Tailwind, ApexCharts) showing environmental measurements from IoT nodes.
- **Chat:** React micro frontend (remote, Vite, SCSS + Tailwind, loaded via Native Federation) that talks to an LLM agent about the dashboard data and detects nodes reporting strange data.
- **Dashboard API:** NestJS (TypeScript), read-only access to a derived SQLite database.
- **Agent service:** FastAPI (Python, managed with `uv`). Calls the NestJS API as tools; talks to an OpenAI-compatible LLM endpoint (local runner or cloud API, configurable) through the standard OpenAI API.
- **Data:** a source SQLite file produced by another project is copied and transformed (ETL) into a derived read-only database.
- **Orchestration:** Nx monorepo. Specs managed with OpenSpec.

Full details, milestones and decisions: `iot-dashboard-agent-plan.md`. Read the relevant milestone before starting work on it.

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
- **E2E Testing:** Playwright across all apps.
- **Charts:** ApexCharts for time-series visualization.
- **Board identity:** `device_id` is a string (e.g. `'esp32c6'`).

## Tool Selection & Tooling

- TypeScript / Angular / React scripts: use `nx`, `bun` or `bunx` (e.g. `bunx nx ...`, `bun install`). Do not use `npm`, `npx`, `yarn` or `pnpm`.
- Python: use `uv` for everything (`uv sync`, `uv add`, `uv run`). Do not use `pip`, `poetry` or bare `python -m venv`.
- Prefer Nx generators over creating projects by hand.
- Prefer `nx affected` over running everything.

## Nx Generator & CLI Quirks

- **No Positional Arguments**: Modern Nx generators reject positional path arguments. Always pass explicit named flags: `--name=<name> --directory=<dir>`.
- **Always Pass Non-Interactive Flags**: Explicitly supply choices (e.g., `--unitTestRunner=vitest`, `--style=scss`, `--ssr=false`) to prevent generator prompts from hanging background executions.
- **Angular Bundler Flag**: `@nx/angular:app` accepts `esbuild`, `rspack`, or `webpack` (`--bundler=vite` does not exist). Use `--bundler=esbuild` to get Angular's official ApplicationBuilder (uses Vite dev server under the hood).
- **React Bundler Flag**: `@nx/react:app` accepts `vite`, `rsbuild`, `rspack`, or `webpack` (raw `esbuild` does not exist). Use `--bundler=vite`.

## Toolchain Quirks & Pitfalls

- **Webpack in ESM Workspaces**: If root `package.json` contains `"type": "module"`, any Webpack configuration using CommonJS must be named `webpack.config.cjs`. A `.js` file will break `@nx/webpack/plugin` graph inference with `require is not defined in ES module scope`.
- **Angular Vitest Version Lock**: Angular's `@angular/build:unit-test` executor strictly requires `vitest@^4.0.8`. Do not install Vitest 5+ in this workspace.
- **Vitest Non-Watch Execution**: In `nx.json`, ensure `@nx/vitest` plugin uses `"testMode": "run"` instead of `"watch"` so CI and batch tasks (`nx run-many -t test`) exit cleanly.
- **NestJS DI under Vitest**: Vitest does not emit TypeScript `design:paramtypes` metadata by default. Add explicit `@Inject(ServiceName)` to controller constructor parameters (e.g. `@Inject(AppService) private readonly appService: AppService`) to prevent undefined injection in tests without extra compiler plugins.
- **Root tsconfig & DOM Lib**: Project configs must extend `tsconfig.base.json`. Keep root `tsconfig.json` clean (no `verbatimModuleSyntax` or `bun` types). Ensure `tsconfig.base.json` includes `"dom"` and `"dom.iterable"` in `compilerOptions.lib` for Angular ApplicationBuilder.
- **Vite Remote Entry Rollup Signatures**: When bundling React MFE entries (`apps/chat-mfe`), specify `preserveEntrySignatures: 'exports-only'` in `build.rollupOptions` so Rollup does not strip entry exports (`mount`, `Chat`) from `remoteEntry.js`.
- **OpenAI-Compatible Endpoint Normalization**: Some local servers (like Unsloth Studio) mount OpenAI routes at `/v1` while `/api` is reserved for their UI. The LLM client normalizes any `/api` suffix to `/v1` automatically.
- **Pytest Auto-Discovery**: Prefix helper/probe functions in non-test or imported modules with `probe_` or `check_`, never `test_`, to avoid Pytest collecting them as failing test cases.
- **Nx Environment Injection in Python Tests**: Nx automatically loads `.env` into `os.environ` when executing tasks. Tests asserting fallback behavior or missing environment variables (e.g. Pydantic Settings in `agent-service`) must isolate or delete ambient variables with a `monkeypatch.delenv` fixture to avoid developer `.env` leakage.
- **OpenSpec CLI Execution**: Run `openspec <cmd>` directly; never prefix with `bunx` or `npx`. Bare `openspec validate` opens an interactive menu; pass explicit flags like `openspec validate --all` or `openspec validate --specs` to avoid hanging background executions.
- **Python Project Target Delegation**: Configure `apps/agent-service/project.json` with `nx:run-commands` wrapping `uv run <command>` (e.g. `uv run uvicorn`, `uv run pytest`, `uv run ruff`).

## Commands

```bash
bun install                                         # install JS dependencies
bunx nx affected -t lint test build                 # lint, test, build what changed
bunx nx serve <project>                             # run a project (dashboard-shell, chat-mfe, dashboard-api, agent-service)
bunx nx e2e <project>-e2e                           # run Playwright E2E tests
bunx nx run agent-service:seed                      # generate synthetic source SQLite DB
bunx nx run agent-service:etl                       # run ETL pipeline to build derived DB
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

Load the relevant skill before working in its area:

| Skill                        | Use when                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `openspec-workflow`          | Starting, implementing or finishing any OpenSpec change    |
| `nx-workspace-conventions`   | Creating projects/libs, changing boundaries, running tasks |
| `data-and-time-rules`        | Touching the ETL, queries, timestamps, sampling or units   |
| `agent-tool-design`          | Adding or changing an agent tool, prompt or guardrail      |
| `testing-strategy`           | Writing or reviewing tests, fixtures or evals              |
| `angular-conventions`        | Working in the Angular shell                               |
| `react-mfe-conventions`      | Working in the React chat remote                           |
| `nestjs-conventions`         | Working in the NestJS API                                  |
| `fastapi-python-conventions` | Working in the FastAPI agent service or any Python code    |

## Working style

- Make small, reviewable changes; one OpenSpec change per logical slice.
- Ask before adding a new dependency, and prefer what is already in the workspace.
- When a requirement is ambiguous, ask or record the assumption in the spec rather than guessing.
- Explain non-obvious decisions in an ADR under `docs/adr/`.
