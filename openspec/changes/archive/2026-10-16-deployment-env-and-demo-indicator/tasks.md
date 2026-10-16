## 1. Centralized Workspace Configuration

- [x] 1.1 Create root `.env.example` documenting all service ports (`WEB_SHELL_PORT=4200`, `WEB_REMOTE_PORT=4204`, `API_PORT=3000`, `AGENT_PORT=8000`), LLM endpoints (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`), database path (`DERIVED_DB_PATH`), and encryption keys (`CONFIG_ENCRYPTION_KEY`), verifying the file exists at repo root.
- [x] 1.2 Update `apps/agent-service/src/agent_service/config.py` to resolve the centralized root `.env` via `find_repo_root() / ".env"`, remove redundant per-app `.env.example` files (`apps/agent-service/.env.example`, `apps/chat-mfe/.env.example`), and verify with `cd apps/agent-service && uv run pytest tests/test_config.py`.

## 2. Database Metadata & Provenance (Seed & ETL)

- [x] 2.1 Update Python seed generator (`apps/agent-service/src/agent_service/data/generate_seed.py`) to mark synthetic datasets with `is_demo = true` and update ETL pipeline (`apps/agent-service/src/agent_service/data/etl.py`) to create the `etl_metadata` table in `measurements.db` storing `is_demo`, `imported_at`, `reading_count`, and `device_count`.
- [x] 2.2 Add unit tests in `apps/agent-service/tests/test_etl.py` asserting `etl_metadata` table creation and verifying `is_demo` flag correctness for both synthetic and imported sources via `cd apps/agent-service && uv run pytest tests/test_etl.py`.
- [x] 2.3 Run `nx run agent-service:seed` and `nx run agent-service:etl` to populate `data/derived/measurements.db` with the `etl_metadata` table and verify with `sqlite3 data/derived/measurements.db "SELECT * FROM etl_metadata;"`.

## 3. Dashboard API Database Status Endpoint

- [x] 3.1 Update Kysely database schema (`apps/dashboard-api/src/app/database/database.schema.ts`) to declare `etl_metadata` table interface.
- [x] 3.2 Add `getDatabaseStatus()` method to `MeasurementsRepository` in `apps/dashboard-api/src/app/database/kysely-measurements.repository.ts` returning `{ isDemo, readingCount, deviceCount, lastImportedAt }` with fallback handling for unpopulated tables, and verify with unit tests in `measurements.repository.spec.ts`.
- [x] 3.3 Add `GET /api/database/status` endpoint to NestJS API with OpenAPI `@ApiOperation` and `@ApiResponse` annotations, and write controller unit tests in `app.controller.spec.ts`.
- [x] 3.4 Export updated OpenAPI specification via `nx run dashboard-api:export-openapi` and regenerate contract client services via `nx run shared-contracts:generate-contracts`.

## 4. Shell Header Demo Data Notification Badge

- [x] 4.1 Create `DatabaseStatusService` in `apps/dashboard-shell/src/app/core/services/database-status.service.ts` querying `GET /api/database/status` on bootstrap and exposing a reactive `isDemo` signal.
- [x] 4.2 Update `HeaderComponent` (`header.component.ts`, `header.component.html`) to inject `DatabaseStatusService` and render an amber "Demo Data" badge with animated pulse dot between navigation links and the AI Assistant toggle when `isDemo()` is true.
- [x] 4.3 Add unit tests in `header.component.spec.ts` verifying that the "Demo Data" badge renders when `isDemo` evaluates to true and is hidden when false, verified via `bun run test --project=dashboard-shell`.

## 5. Full Stack Verification

- [x] 5.1 Run workspace verification across affected packages (`nx run-many -t lint test build --projects=agent-service,dashboard-api,dashboard-shell,shared-contracts`) and verify all suites pass cleanly.
