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
- **Vitest `process.cwd()` Path Resolution**: Under `vitest run`, `process.cwd()` resolves to the individual project directory (e.g. `apps/dashboard-api`) instead of the workspace root. File lookups targeting workspace roots (`data/...`, `dist/...`) must search upwards recursively rather than assuming `resolve(process.cwd(), ...)`.
- **`ng-openapi` in ESM Workspaces**: In ESM root workspaces (`"type": "module"`), name the config `openapi.config.cjs` using `require()`. Generated client output (`libs/shared/contracts/src/generated/`) emits `@ts-nocheck` directives; add `{ ignores: ["src/generated/**/*"] }` to the library's `eslint.config.mjs`.
- **Kysely SQLite Integer Division & UTC Timestamps**: Template expressions `${bucketSeconds}` in Kysely `sql` strings parameterize values as SQLite binds, producing floating-point division. Wrap interval seconds with `sql.raw(bucketSeconds.toString())`. SQLite `datetime()` uses space separation; format as ISO UTC via `replace(datetime(...), ' ', 'T') || 'Z'`.
- **NestJS Optional Providers in Vitest**: Optional constructor dependencies (e.g. `sqliteInstance?: Database.Database`) trigger `UnknownDependenciesException` in Vitest unless explicitly decorated with `@Optional()`.
- **Tailwind v4 in Angular ApplicationBuilder**: Tailwind v4 cannot process through Sass. Keep the Tailwind v4 entry in a plain `.css` file (`src/tailwind.css`) with `@import "tailwindcss";` and `@theme { ... }`, adding it to `styles` alongside `styles.scss` in `project.json`. Do not import or `@use "tailwindcss"` in `.scss`. Project-level `.postcssrc.json` registering `@tailwindcss/postcss` is resolved natively by `@angular/build:application`.
- **Native Federation Dev Proxy**: Native Federation's `serve` target wraps `serve-original` (`@angular/build:dev-server`). Add `"proxyConfig": "<path>/proxy.conf.json"` to the `options` block of `serve-original`, not to `serve` or `esbuild`.
- **OpenAPI Export Prerequisite for API Contract Tests**: `apps/dashboard-api/src/app/openapi-contract.spec.ts` verifies against `dist/apps/dashboard-api/openapi.json`. Run `nx run dashboard-api:export-openapi` before executing API tests if `dist/` is clean or newly cloned.
- **Playwright `dependsOn` vs `webServer` Conflict**: `@nx/playwright/plugin` infers `"dependsOn": [{"target": "serve", "projects": ["<app>"]}]`. This causes port collision errors if the dev server is already running, or hangs batch runs indefinitely because the dev server never exits. Override `targets.e2e` in `<app>-e2e/project.json` with `"dependsOn": []` and let Playwright's native `webServer` block manage the lifecycle (`reuseExistingServer: true`), adding `reporter: [['list'], ['html', { open: 'never' }]]` in `playwright.config.mts` so Playwright never blocks CLI execution.
- **Native Federation Secondary Bundling & `@angular/animations`**: Never include `@angular/platform-browser` in `.patch([...], { includeSecondaries: { keepAll: true } })` in `federation.config.mjs`. This causes Native Federation to bundle `@angular/platform-browser/animations`, crashing esbuild with `Could not resolve "@angular/animations/browser"` when `@angular/animations` is not installed. Patch only `@angular/core`, `@angular/common`, and `@angular/router`.
- **Native Federation & Angular Build Version Lock**: Keep `@angular-architects/native-federation` strictly aligned with the minor version of `@angular/build` (e.g. `~22.2.2`). Version mismatches break `@angular/build` private API assumptions in `JavaScriptTransformer.transformData`, causing the Angular Linker to be skipped and emitting unlinked `ɵɵngDeclareInjectable` declarations that crash at runtime with `_PlatformLocation needs to be compiled using the JIT compiler`. Always wipe `node_modules/.cache/native-federation` when updating Angular or Native Federation versions.
- **Micro Frontend Remote Inactive "CORS" False Alarm**: When `dashboard-shell` boots, Native Federation fetches remotes defined in `federation.manifest.json` (e.g. `http://localhost:4204/remoteEntry.json`). If `chat-mfe` is not running, browsers fail the cross-origin TCP connection and report it as `CORS request did not succeed (status code: null)`. This is connection refusal (remote server stopped), not a CORS misconfiguration. Start the remote with `nx serve chat-mfe`.
- **Python Package Submodule Shadowing in `__init__.py`**: Importing a callable with the same name as a submodule in `__init__.py` (e.g. `from agent_service.main import main`) shadows the module attribute, breaking Uvicorn target resolution (`uvicorn agent_service.main:app` fails with `AttributeError: 'function' object has no attribute 'app'`). Export `app` and `create_app` or alias entrypoint functions instead.
- **FastAPI Lifespan & `TestClient` in Unit Tests**: Bare `httpx.AsyncClient(transport=ASGITransport(app))` does not trigger FastAPI async lifespan context managers. Use `TestClient(app)` from `fastapi.testclient` as a context manager (`with TestClient(app):`) to execute startup and shutdown hooks deterministically in tests.
- **Async Task Cancellation Assertions**: `task.cancel()` sets `task.cancelling() > 0` immediately, but `task.cancelled()` evaluates to `True` only after the event loop runs. In tests verifying task cancellation, yield to the event loop via `await asyncio.sleep(0)` before asserting `assert task.cancelled()`.
- **Python Loop Variable Binding in Closures (Ruff B023)**: Defining inner helper functions or closures inside loops that reference the loop iteration variable triggers Ruff `B023` and causes late-binding bugs. Bind loop variables explicitly as default parameter values (e.g. `def flush(dev=dev_id):`) or pass them as direct arguments.
- **LLM Tool Pydantic Schema Strictness (`extra="forbid"`)**: For tool function parameter definitions, Pydantic schemas must specify `model_config = ConfigDict(extra="forbid")`. This emits `"additionalProperties": false` in JSON Schema, preventing small or local LLMs from hallucinating unrecognized arguments that fail validation.
- **Vite Dev Server Remote Entry MIME Type**: Vite dev mode serves on-demand without building `remoteEntry.js` to disk. Dynamic host imports fall back to `index.html` (`text/html`), causing browser errors (`Unsupported Content-Type "text/html"`). Fix by adding a custom dev middleware in `vite.config.mts` to serve `remoteEntry.js` and build assets with `application/javascript` and CORS headers, plus adding `"dependsOn": ["build"]` to `serve` in `project.json`.
- **Nx Multi-Project Serve Streaming**: `nx run-many -t serve` displays spinners indefinitely in interactive TUI mode because dev servers are continuous daemons. Pass `--outputStyle=stream` to view real-time startup logs and port bindings.
- **Playwright Multi-WebServer for MFEs**: When testing an MFE host that loads remotes dynamically, configure `webServer` in `playwright.config.mts` as an array (host + remotes) with `reuseExistingServer: true` so all endpoints are up before tests execute.
- **Micro Frontend Origin Resolution in CORS**: When a remote MFE (e.g. `chat-mfe` on port 4204) mounts into a host shell (`dashboard-shell` on port 4200), browser `fetch` requests execute within the host's browsing context (`origin: http://localhost:4200`). Backend CORS configs (e.g. FastAPI `agent-service`) must permit both host and remote origins, including `localhost` and `127.0.0.1` variants.
- **MFE DOM State Persistence Across UI Toggles**: Toggling microfrontend host drawers or modals with Angular `@if` destroys the wrapper DOM and unmounts the remote's React root (`root.unmount()`), wiping in-memory state (messages, active streams). Keep the wrapper mounted in the DOM and toggle visibility via CSS transforms (`translate-x-full` / `translate-x-0`), backdrop opacity, and `[attr.inert]="!isOpen() ? '' : null"`.
- **Token Streaming vs. Smooth Scrolling Conflict**: Applying `scroll-smooth` or `scroll-behavior: smooth` to a chat message container during high-frequency token streams (~20 events/sec) causes animated scroll latency. Mid-flight scroll events falsely flag that the user has scrolled up (`distanceFromBottom > threshold`), permanently disengaging auto-scroll. Use instant scroll pinning (`el.scrollTop = el.scrollHeight`) without `scroll-smooth` during active streaming.
- **Single Workspace E2E Suite vs. Parallel Per-App Playwright WebServers**: Multiple per-app E2E projects (`dashboard-shell-e2e`, `dashboard-api:e2e`) concurrently spawning dev servers via nested `bun nx run <service>:serve` in Playwright `webServer` blocks trigger Nx circular task detection (`Nx detected a recursive loop of tasks: ... -> dashboard-api:serve -> dashboard-api:build`) and hang the interactive TUI. Maintain strictly one top-level workspace E2E suite (`e2e/`) orchestrating the entire stack once and testing each tier sequentially.
- **E2E Invariance to Dynamic Database State**: End-to-end tests against real SQLite data must never assert hardcoded record counts, static element numbers, or exact measurement values. If testing tables or charts, assert structural rendering and populated rows (`tbody tr`), and use point-count filters (e.g. "50 pts") rather than relative historical presets ("Last 1d") to remain resilient across data migrations.
- **Streaming Chat Submit Button State Assertions**: When chat input forms clear text immediately on submission (`setText('')`), the send button remains disabled even after stream completion (`disabled={!text.trim() || isStreaming}`). Never assert `expect(sendBtn).toBeEnabled()`; verify stream completion by asserting `expect(stopBtn).not.toBeVisible()` and `expect(sendBtn).toBeVisible()`.
- **Zoneless Angular `ngOnInit` Async Tracking in Vitest**: Angular executes component lifecycle hooks synchronously and does not await promises returned by `async ngOnInit()`. In zoneless testing (`provideExperimentalZonelessChangeDetection`), `await fixture.whenStable()` does not wait for untracked native microtasks or async dynamic module loaders. Expose and store the initialization promise (e.g. `protected mountPromise: Promise<void> | null`) and await it explicitly (`await fixture.componentInstance['mountPromise']`) before asserting post-initialization state or flushing component effects.
- **Sequential Execution for E2E Tests with Local LLMs (`workers: 1`)**: Running Playwright E2E tests with parallel workers (`workers > 1`) against a local LLM server divides GPU/CPU compute and queues requests, inflating streaming latency (from ~7s to >60s) and triggering test assertion timeouts. Configure `workers: 1` in `e2e/playwright.config.ts` so end-to-end integration tests execute sequentially at full model inference throughput.
- **`better-sqlite3` Native Addon & Bun Crash**: Running scripts that load `better-sqlite3` directly via `bun run` or `bun` triggers a fatal N-API panic (`Error::New napi_get_last_error_info`). For standalone CLI runners touching `better-sqlite3` (e.g. `apps/dashboard-api/src/etl-cli.ts`), run with Node.js and `jiti` (`node apps/dashboard-api/src/etl-runner.cjs`), not bare `bun`.
- **Linux Inode Detachment on Atomic File Swaps (`reconnect()`)**: On Linux, replacing an SQLite file atomically via `fs.renameSync` associates the path with a new inode. Existing open file descriptors continue querying the unlinked old inode. Persistence repositories (e.g. `KyselyMeasurementsRepository`) must close and recreate their database instance (`reconnect()`) immediately following an ETL atomic swap.
- **Angular Template Linter A11y on Dropzones**: Adding `(click)` handlers to custom upload dropzone container elements (`<div>`) triggers `@angular-eslint/template` errors (`click-events-have-key-events` and `interactive-supports-focus`). Ensure the dropzone element defines `tabindex="0"`, `role="button"`, and keyboard listeners (`(keydown.enter)` / `(keydown.space)`).
- **Docker Host Loopback on Linux (`network_mode: host`)**: Local LLM inference engines (such as Unsloth Studio) running on the Linux host bind strictly to `127.0.0.1`. When `agent-service` runs in a standard Docker bridge network, `host.docker.internal` maps to the bridge gateway (`172.17.0.1`), which cannot route packets to the host's loopback interface and fails with `[Errno 111] Connection refused`. Configure `network_mode: host` on `agent-service` in `docker-compose.yml` (with `http://127.0.0.1:8888/v1` for LLM and `http://localhost:3000` for `dashboard-api`) to allow direct loopback access without modifying the host LLM runner.
- **Centralized Root `.env` Configuration**: Docker Compose reads environment variables from `.env` in the workspace root. Ensure `.env` is created from `.env.example` and populated with secrets like `LLM_API_KEY`. It is excluded by `.gitignore` (`*.env`) so secrets are never committed.
- **Vite `envDir` in Monorepo Sub-Apps**: In sub-applications bundled with Vite (`apps/chat-mfe`), Vite resolves `.env` files relative to its `root` (`apps/chat-mfe`). When environment configuration is centralized at workspace root, configure `envDir: '../../'` in `vite.config.mts` so Vite exposes root `VITE_*` variables to the client build without requiring redundant per-app `.env` files.

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
