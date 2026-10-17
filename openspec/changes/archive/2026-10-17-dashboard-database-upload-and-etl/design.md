## Context

See `proposal.md` for motivation. Previously, data ingestion and the ETL pipeline were located in `apps/agent-service/src/agent_service/data/etl.py`. This design establishes strict service independence: the dashboard stack (Angular shell + NestJS API) must be 100% self-sufficient and capable of running, generating demo data, ingesting uploaded databases, and executing ETL transformations completely without `agent-service`. In turn, `agent-service` is strictly an API client that queries the dashboard over HTTP (`DashboardApiClient`) with zero database writes, zero migrations, and zero ETL responsibilities.

In this change, the complete ETL pipeline is implemented natively in TypeScript inside `apps/dashboard-api` using `better-sqlite3`, replicating all transformation and validation rules with equivalent Vitest unit tests. Redundant ETL code in `apps/agent-service` is deleted. The NestJS API receives uploaded SQLite database files via `@fastify/multipart`, stages them in `data/migrations/source.db`, executes the in-process TypeScript ETL, refreshes its database connection, and returns status metadata. In the frontend, an ingestion card is added to the Settings view to the right of the existing LLM configuration.

## Goals / Non-Goals

**Goals:**
- Implement in-process TypeScript ETL in `apps/dashboard-api` using `better-sqlite3`, validating tables, checking uniform metric units, normalizing timestamps to ISO-8601 UTC with `Z`, mapping `is_fine_tuned` to `sampling`, indexing `measurements`, and maintaining `etl_metadata` (`is_demo = false`).
- Replicate all existing Python ETL unit tests into Vitest tests (`apps/dashboard-api/src/app/database/etl.service.spec.ts`) to guarantee identical outcomes and validation behavior.
- Remove redundant ETL code and tests from `apps/agent-service` (`etl.py`, `test_etl.py`, and project/pyproject script targets).
- Provide a robust `POST /api/database/import` endpoint in `dashboard-api` using `@fastify/multipart` streaming to write the uploaded file to `data/migrations/source.db` and trigger `EtlService.runEtl()`.
- Implement dynamic connection refresh in `KyselyMeasurementsRepository` so that `better-sqlite3` immediately binds to the newly swapped database inode.
- Add an ingestion card to the right of the LLM configuration in `/settings` with file selection, progress feedback, detailed migration metrics, and error reporting.
- Reactively update `DatabaseStatusService` and `CapabilitiesService` upon successful import so header badges and filter menus update without full page reloads.

**Non-Goals:**
- Any background execution or process calls to `agent-service`.
- Background task queues or resumable upload protocols (direct multipart streaming supports POC database sizes).
- Multi-database tenancy or multi-file merging.

## Decisions

### 1. Migrating ETL to TypeScript in `dashboard-api`
- **Decision**: Implement the ETL pipeline directly in Node.js inside `apps/dashboard-api` using `better-sqlite3`, and completely remove the Python ETL implementation from `apps/agent-service`.
- **Rationale**: The dashboard owns the database schema and query layer (`measurements.db`). Making `dashboard-api` self-sufficient ensures that the dashboard can be developed, tested, containerized, and deployed independently of the Python agent. `better-sqlite3` provides fast, transactional C++ bindings with identical SQLite semantics.
- **Alternatives Considered**: Leaving ETL in Python and having NestJS call it via child process. Rejected because it couples the dashboard to Python and `agent-service`, violating service independence.

### 2. Comprehensive Test Parity in Vitest
- **Decision**: Port the exact test suite from `apps/agent-service/tests/test_etl.py` into `apps/dashboard-api/src/app/database/etl.service.spec.ts`:
  1. Timestamp validation and UTC `Z` normalization.
  2. Sampling mapping (`0`/`false` -> `'scheduled'`, `1`/`true` -> `'on_demand'`).
  3. Metric catalog creation and conflicting unit detection across devices.
  4. End-to-end transformation and composite index creation.
  5. Rejection of readings with undeclared metrics.
  6. Provenance metadata tracking (`is_demo = true` vs. `is_demo = false`).
  7. Explicit `is_demo` parameter override.
- **Rationale**: Guarantees identical data transformation outcomes and failure handling between the previous Python implementation and the new TypeScript service.

### 3. File Upload Streaming via `@fastify/multipart`
- **Decision**: Register `@fastify/multipart` on the Fastify adapter in `apps/dashboard-api/src/main.ts` with a 100MB file limit. Pipe the incoming multipart file stream directly to `data/migrations/source.db`.
- **Rationale**: Streaming directly to disk ensures that multi-megabyte SQLite files do not buffer into the Node.js V8 heap, avoiding memory spikes, and places the file at the designated migration inbox location.
- **Alternatives Considered**: Raw binary `application/octet-stream` upload. Rejected because standard `multipart/form-data` integrates cleanly with standard HTML `<input type="file">` and Swagger/OpenAPI documentation.

### 4. Dynamic SQLite Connection Refresh in `KyselyMeasurementsRepository`
- **Decision**: Add a `reconnect()` method to `KyselyMeasurementsRepository` that closes the existing `better-sqlite3` database instance and re-instantiates `this.sqlite` and `this.db`.
- **Rationale**: On Linux, replacing a file atomically via `fs.renameSync` associates the file path with a new inode. Existing open file descriptors in Node.js continue reading from the unlinked old inode. Calling `reconnect()` guarantees immediate consistency for subsequent queries.
- **Alternatives Considered**: Process restart. Rejected because restarting the NestJS server disrupts active connections and drops in-flight HTTP requests.

### 5. Settings View Responsive Grid Layout
- **Decision**: Structure `SettingsViewComponent` into a responsive 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start`).
  - **Left Box**: Existing LLM runtime configuration form (Base URL, Model identifier, API key, save/reset actions).
  - **Right Box**: Telemetry database ingestion card containing active provenance status, file drag-and-drop selector, "Upload & Run ETL" trigger, and detailed validation / success reporting.
- **Rationale**: Respects the user's explicit design requirement for a dedicated box to the right of the existing one while maintaining full mobile responsiveness (stacking to 1 column on narrow screens).
- **Alternatives Considered**: Tabs or modal dialog. Rejected because a side-by-side view allows simultaneous inspection of system connection parameters and database provenance.

## Technical Architecture

```
+--------------------------------------------------------------------------------------------------+
| SettingsViewComponent (/settings)                                                                |
|                                                                                                  |
| [ Left Card: LLM Settings ]                    [ Right Card: Database Ingestion & Status ]       |
| - Base URL, Model, API Key                     - Active status badge (Demo vs. Live)             |
| - Save / Reset buttons                         - File dropzone (.db, .sqlite, .sqlite3)          |
|                                                - "Upload & Run ETL" button                       |
|                                                - Migration summary / Error alert box             |
+------------------------------------------------+-------------------------------------------------+
                                                 |
                                                 | multipart/form-data
                                                 v
+--------------------------------------------------------------------------------------------------+
| Dashboard API (NestJS + Fastify)                                                                 |
|                                                                                                  |
| 1. AppController: POST /api/database/import                                                      |
| 2. Streams file directly to data/migrations/source.db                                            |
| 3. In-Process EtlService.runEtl():                                                               |
|    - Open source.db in read-only mode via better-sqlite3                                         |
|    - Validate sensor_capabilities and readings tables                                            |
|    - Check unit consistency across devices; normalize metric keys                                |
|    - Create staging DB: data/derived/measurements.db.tmp.<pid>                                   |
|    - Parse JSON metrics; normalize timestamps to UTC 'Z'                                         |
|    - Insert into measurements, metrics_catalog, and etl_metadata (is_demo = false)               |
|    - Create composite index: idx_measurements_series                                             |
|    - Atomic swap: fs.renameSync(tmp, measurements.db)                                            |
| 4. Calls KyselyMeasurementsRepository.reconnect()                                                |
| 5. Returns 200 OK with DatabaseStatusDto                                                         |
+--------------------------------------------------------------------------------------------------+
                                                 ^
                                                 | HTTP REST (Read-Only)
                                                 |
+------------------------------------------------+-------------------------------------------------+
| Agent Service (FastAPI)                                                                          |
| - Consumes Dashboard API via DashboardApiClient                                                  |
| - ZERO ETL logic, ZERO database writes                                                           |
+--------------------------------------------------------------------------------------------------+
```

## Risks / Trade-offs

- **[Risk] Fastify Multipart compatibility with Fastify 5**: Installing an incompatible major version of `@fastify/multipart` would break Fastify startup.
  - **Mitigation**: Install `@fastify/multipart@^9`, which is specifically compiled for `fastify@^5`.
- **[Risk] Schema or unit validation failure on upload**: User uploads an invalid SQLite file or database missing tables.
  - **Mitigation**: `EtlService` validates schema and units, throwing `BadRequestException` with the specific failure details before any swap occurs, leaving the existing derived database completely untouched.
- **[Risk] Stale database connection**: Open file descriptors in Node.js might point to old inode after `fs.renameSync`.
  - **Mitigation**: `KyselyMeasurementsRepository.reconnect()` closes and re-opens connection immediately after the atomic swap completes.
