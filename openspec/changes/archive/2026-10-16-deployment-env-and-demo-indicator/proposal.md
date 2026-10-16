## Why

Currently, configuration across the monorepo is fragmented across isolated per-project `.env.example` files (`apps/agent-service/.env.example`, `apps/chat-mfe/.env.example`), which prevents single-file orchestration for Docker Compose and uniform developer onboarding. Furthermore, the dashboard lacks any visible indication of whether displayed telemetry originates from synthetic demo seed data or an authentic ingested SQLite database, obscuring data lineage and state from users exploring the proof of concept.

To establish the operational baseline for containerization (Milestone M7), this change consolidates workspace configuration into a single centralized `.env` file at the repository root, introduces `is_demo` provenance metadata into the derived database schema during ETL and seed generation, exposes database status via the NestJS API, and renders an amber "Demo Data" indicator in the dashboard toolbar.

## What Changes

- **Centralized Workspace Configuration**:
  - Add single root `.env.example` tracking all service ports, LLM endpoints (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`), database paths (`DERIVED_DB_PATH`), and security encryption keys (`CONFIG_ENCRYPTION_KEY`).
  - Deprecate and remove fragmented per-app `.env.example` and `.env` files in `apps/agent-service` and `apps/chat-mfe`.
  - Update Python `Settings` loader in `agent-service` to resolve root `.env` consistently across local commands and containers.
- **Database Provenance Metadata**:
  - Add `etl_metadata` table (`key TEXT PRIMARY KEY, value TEXT NOT NULL`) to `data/derived/measurements.db`.
  - Update Python seed generator (`agent_service.data.generate_seed`) to mark synthetic datasets with `is_demo = true`.
  - Update ETL pipeline (`agent_service.data.etl`) to persist provenance metadata (`is_demo = true` for synthetic seeds, `is_demo = false` for real imports, along with `imported_at`, `reading_count`, `device_count`).
- **Database Status API Endpoint**:
  - Add `GET /api/database/status` endpoint in NestJS `dashboard-api` returning `{ isDemo: boolean, readingCount: number, deviceCount: number, lastImportedAt: string | null }`.
  - Add OpenAPI contract definitions and update generated Angular HTTP resource contracts in `libs/shared/contracts`.
- **Toolbar "Demo Data" Indicator**:
  - Add `DatabaseStatusService` in `dashboard-shell` querying database status on initialization via signals.
  - Update `HeaderComponent` in `dashboard-shell` to render an amber "Demo Data" pill badge with live pulse indicator when running on synthetic demo data.

## Capabilities

### Modified Capabilities
- `runtime-config-foundation`: Update configuration resolution to load from the centralized workspace root `.env` rather than per-app `.env` files.
- `data-migration-inbox-and-etl`: Add `etl_metadata` table to derived database schema tracking `is_demo` provenance flag and import statistics.
- `api-metrics-devices`: Add `GET /api/database/status` endpoint reporting database provenance, record counts, and import timestamps.
- `dashboard-shell-layout`: Add "Demo Data" notification badge to the top navigation header toolbar when operating against synthetic data.

## Impact

- **Affected Applications**:
  - `apps/agent-service`: Python `Settings` configuration loader, seed generator, ETL pipeline.
  - `apps/dashboard-api`: Kysely database schema, database repository, controller and OpenAPI contract.
  - `apps/dashboard-shell`: Header toolbar template, navigation styling, database status signal service.
  - `apps/chat-mfe`: Environment variable consumption aligned with root configuration.
  - `libs/shared/contracts`: Regenerated contracts for the new status endpoint.
- **Breaking Changes**: None. Backwards compatibility for existing local workflows is preserved with sensible fallback defaults.
