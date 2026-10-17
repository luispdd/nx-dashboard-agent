## Why

Currently, data ingestion and the ETL pipeline are located in `apps/agent-service`, creating an unnecessary dependency between the dashboard data layer and the Python agent stack. The dashboard must be 100% self-sufficient and able to run, ingest databases, and perform ETL migrations without depending on `agent-service` or the Python runtime. Furthermore, to provide a true self-service proof of concept, the dashboard must allow operators to upload real SQLite databases directly from the browser Settings view, run the transformation in-process within the NestJS API, and immediately transition the live dashboard from demo data to real telemetry.

## What Changes

- **In-Process TypeScript ETL in `dashboard-api`**:
  - Add `@fastify/multipart` to NestJS Fastify setup to support multipart file uploads.
  - Implement `EtlService` in `apps/dashboard-api` using `better-sqlite3` to perform the complete ETL pipeline natively in TypeScript:
    - Validate schema integrity and required tables (`sensor_capabilities`, `readings`).
    - Validate uniform metric units across devices and normalize metric keys (`temp` -> `temperature`, `hum` -> `humidity`, `%RH` -> `%`, `Cel` -> `°C`).
    - Normalize timestamps to ISO-8601 UTC with `Z`.
    - Map `is_fine_tuned` to `sampling` (`scheduled` | `on_demand`).
    - Flatten JSON metrics into `measurements` table with composite index `idx_measurements_series`.
    - Maintain `etl_metadata` (`is_demo = false`, `reading_count`, `measurement_count`, `device_count`, `imported_at`).
    - Atomic file swap of `data/derived/measurements.db`.
  - Add equivalent Vitest test suite (`apps/dashboard-api/src/app/database/etl.service.spec.ts`) replicating all test cases from the Python suite.
  - Add `reconnect()` method to `KyselyMeasurementsRepository` in NestJS to re-open `better-sqlite3` on the newly swapped inode.
  - Add `POST /api/database/import` endpoint on `AppController` streaming uploaded files to `data/migrations/source.db`, triggering the in-process ETL, and returning import statistics.
- **Decouple and Remove ETL from `agent-service`**:
  - Delete `apps/agent-service/src/agent_service/data/etl.py`.
  - Delete `apps/agent-service/tests/test_etl.py`.
  - Remove `etl` script entry from `apps/agent-service/project.json` and `pyproject.toml`.
  - Retarget workspace `etl` script in root `package.json` to `nx run dashboard-api:etl`.
- **Settings View Side-by-Side Ingestion Box**:
  - Refactor `SettingsViewComponent` layout into a responsive two-column grid (`grid grid-cols-1 lg:grid-cols-2`).
  - Add a new card to the right of the existing LLM settings card dedicated to "Telemetry Database Ingestion".
  - Include current database status indicator (Demo Data vs. Live Data badge, counts, last imported timestamp).
  - Include file picker and dropzone accepting `.db`, `.sqlite`, `.sqlite3` files with selected file details.
  - Add "Upload & Run ETL" action with loading spinner and disabled state during processing.
  - Add status message box displaying detailed migration results (readings processed, measurements inserted, devices found) or descriptive validation error alerts.
  - Automatically refresh `DatabaseStatusService` and `CapabilitiesService` upon success so the toolbar badge and filter dropdowns update immediately.
- **Contract & Client Regeneration**:
  - Export updated OpenAPI spec via `nx run dashboard-api:export-openapi`.
  - Regenerate shared Angular client services via `nx run shared-contracts:generate-contracts`.

## Capabilities

### Modified Capabilities
- `api-metrics-devices`: Add `POST /api/database/import` endpoint accepting multipart SQLite database uploads, executing in-process TypeScript ETL, refreshing active database connections, and returning import statistics.
- `dashboard-distribution-and-settings`: Add secondary database ingestion card to the right of the existing LLM configuration in the `/settings` view, with file selection, upload execution, progress states, and validation reporting.
- `data-migration-inbox-and-etl`: Migrate the ETL pipeline to `dashboard-api` in TypeScript, removing ETL responsibility from `agent-service` and establishing full independence for the dashboard data layer.

## Impact

- **Affected Applications**:
  - `apps/dashboard-api`: Fastify multipart registration, in-process TypeScript ETL service, controller endpoint, repository reconnection, OpenAPI spec export, CLI etl target.
  - `apps/agent-service`: Removal of `etl.py` and `test_etl.py`; removal of etl task target from project and pyproject configuration.
  - `apps/dashboard-shell`: Settings view template, component logic, styles, and unit tests.
  - `libs/shared/contracts`: Regenerated typed Angular client services.
- **Dependencies**:
  - Added `@fastify/multipart` to workspace `package.json` for Fastify multipart request parsing.
- **Clean Service Independence**:
  - The dashboard is 100% independent and can run, seed, and ingest data without `agent-service`.
  - `agent-service` depends strictly on dashboard HTTP REST endpoints with zero database ingestion or ETL coupling.
- **Breaking Changes**: None.
