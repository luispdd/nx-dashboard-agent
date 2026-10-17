## 1. Dependencies and Fastify Multipart Setup

- [x] 1.1 Add `@fastify/multipart` dependency to `package.json` (`@fastify/multipart@^9`) and verify installation with `bun install`
- [x] 1.2 Register `@fastify/multipart` plugin in `apps/dashboard-api/src/main.ts` with 100MB file size limits and verify `nx build dashboard-api` succeeds

## 2. TypeScript ETL Implementation and Vitest Test Parity in `dashboard-api`

- [x] 2.1 Implement `EtlService` in `apps/dashboard-api/src/app/database/etl.service.ts` using `better-sqlite3` to validate tables, enforce uniform metric units, normalize timestamps to ISO-8601 UTC with `Z`, map sampling types, flatten JSON metrics, write `etl_metadata` (`is_demo = false`), and atomically swap `data/derived/measurements.db`
- [x] 2.2 Replicate all Python ETL unit test cases into Vitest in `apps/dashboard-api/src/app/database/etl.service.spec.ts` and verify all tests pass (`nx test dashboard-api`)
- [x] 2.3 Add `etl` CLI target in `apps/dashboard-api/project.json` and retarget workspace `package.json` `"etl"` command to `nx run dashboard-api:etl`

## 3. Removal of Redundant ETL from `agent-service`

- [x] 3.1 Remove `apps/agent-service/src/agent_service/data/etl.py` and `apps/agent-service/tests/test_etl.py`
- [x] 3.2 Remove `etl` script target from `apps/agent-service/project.json` and `pyproject.toml`, and verify `uv run pytest` passes in `agent-service`

## 4. API Import Endpoint and Contract Generation

- [x] 4.1 Implement `reconnect()` method in `KyselyMeasurementsRepository` to rebind the SQLite connection to the newly swapped database inode
- [x] 4.2 Implement `POST /api/database/import` endpoint on `AppController` in `apps/dashboard-api/src/app/app.controller.ts` streaming upload to `data/migrations/source.db`, executing `EtlService.runEtl()`, refreshing repository, and returning `DatabaseStatusDto`
- [x] 4.3 Add unit and integration tests for the import endpoint in `apps/dashboard-api/src/app/app.controller.spec.ts`
- [x] 4.4 Export updated OpenAPI specification (`nx run dashboard-api:export-openapi`) and regenerate shared contracts (`nx run shared-contracts:generate-contracts`), verifying `DatabaseService` includes `appControllerImportDatabase`

## 5. Settings View Side-by-Side UI Implementation

- [x] 5.1 Update `SettingsViewComponent` template (`settings-view.component.html`) to a responsive 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start`) with the new Database Ingestion card placed to the right of the existing LLM settings card
- [x] 5.2 Implement file drag-and-drop selector, file details preview, and "Upload & Run ETL" action with loading spinner and disabled state in `settings-view.component.ts`
- [x] 5.3 Implement status reporting in the ingestion card (displaying readings processed, measurements inserted, and devices detected on success; displaying error details on failure) and reactively refresh `DatabaseStatusService` and `CapabilitiesService`
- [x] 5.4 Write unit tests in `apps/dashboard-shell/src/app/features/settings/settings-view.component.spec.ts` verifying file selection, upload execution, success reporting, error reporting, and service refreshes (`nx test dashboard-shell`)

## 6. End-to-End Verification and Workspace Checks

- [x] 6.1 Run full workspace lint, test, and build targets (`nx run-many -t lint test build`) and verify zero regressions across all projects
- [x] 6.2 Add an end-to-end test in `e2e/specs/03-dashboard-shell.spec.ts` verifying the Settings view upload form and toolbar status reactivity
