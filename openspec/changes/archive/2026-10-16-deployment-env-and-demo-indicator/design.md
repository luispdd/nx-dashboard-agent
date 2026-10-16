## Context

See `proposal.md` for background and motivation. The workspace comprises an Angular 22 shell (`apps/dashboard-shell`), a React chat remote (`apps/chat-mfe`), a NestJS Fastify API (`apps/dashboard-api`), and a FastAPI Python service (`apps/agent-service`).

Previously, configuration was scattered across `apps/agent-service/.env.example` and `apps/chat-mfe/.env.example`, creating divergence risks for upcoming Docker Compose orchestration. Furthermore, the derived SQLite database schema (`data/derived/measurements.db`) only contained `measurements` and `metrics_catalog` tables, with no provenance metadata indicating whether data originated from the synthetic seed generator or an authentic user import.

## Goals / Non-Goals

**Goals:**
- Single root `.env.example` file tracking all workspace configuration keys, service ports, and local LLM connection settings.
- Schema extension in `data/derived/measurements.db` introducing an `etl_metadata` key-value table.
- Python seed generator and ETL pipeline updated to store provenance flags (`is_demo = true/false`, timestamps, counts).
- NestJS API `GET /api/database/status` endpoint exposing typed database status and contract regeneration for Angular.
- Angular zoneless `DatabaseStatusService` exposing an `isDemo` signal to drive a visible amber toolbar notification badge in `HeaderComponent`.

**Non-Goals:**
- Creating Dockerfiles or `docker-compose.yml` (deferred to Slice 3: `deployment-docker-compose`).
- Web upload endpoint and in-browser ETL trigger (deferred to Slice 2: `dashboard-database-upload-and-etl`).

## Decisions

### 1. Key-Value `etl_metadata` Table in SQLite
- **Decision**: Store dataset provenance in a dedicated `etl_metadata` table:
  ```sql
  CREATE TABLE etl_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  ```
- **Rationale**: A simple key-value store in SQLite allows storing `is_demo` ('true'/'false'), `imported_at` (ISO-8601 UTC), `reading_count`, `device_count`, and future upload metadata without requiring schema migrations for every new attribute.
- **Alternatives Considered**:
  - Adding an `is_demo` boolean column to the `measurements` table: Rejected due to storage redundancy over hundreds of thousands of rows and slower table scans.
  - Separate JSON file on disk (e.g. `data/derived/metadata.json`): Rejected because SQLite databases should remain self-contained single-file artifacts that can be swapped atomically.

### 2. Workspace-Level Centralized `.env`
- **Decision**: Establish `.env.example` at the repository root and update application loaders:
  - Python `apps/agent-service/src/agent_service/config.py` updates `SettingsConfigDict` to load `find_repo_root() / ".env"`.
  - Vite `apps/chat-mfe` points to root `.env` or inherits from `process.env`.
  - Docker Compose (Slice 3) natively binds root `.env`.
- **Rationale**: Eliminates per-app configuration fragmentation and prepares the monorepo for single-command container orchestration.
- **Alternatives Considered**:
  - Keeping per-app `.env` files: Rejected because container Compose files require a unified variable source.

### 3. API Contract and Angular Service Integration
- **Decision**:
  - Expose `GET /api/database/status` on `dashboard-api` returning:
    ```typescript
    export class DatabaseStatusDto {
      isDemo!: boolean;
      readingCount!: number;
      deviceCount!: number;
      lastImportedAt!: string | null;
    }
    ```
  - Update OpenAPI generation and regenerate Angular HTTP contracts in `libs/shared/contracts`.
  - Introduce `DatabaseStatusService` in `dashboard-shell/src/app/core/services` using Angular 22 Signals (`signal()`, `toSignal()`) to fetch status on bootstrap.
- **Alternatives Considered**:
  - Embedding database status inside `GET /api/metrics`: Rejected because metrics and database provenance represent distinct operational concerns with different caching characteristics.

### 4. Toolbar "Demo Data" Visual Indicator
- **Decision**:
  - Render an amber pill badge in `HeaderComponent` between navigation links and the AI Assistant toggle:
    ```html
    @if (isDemo()) {
      <div class="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5 shadow-sm" data-testid="demo-data-badge" title="Running on synthetic demo data">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span>Demo Data</span>
      </div>
    }
    ```
- **Rationale**: Clear, non-intrusive notification that immediately informs the user about data authenticity without disrupting dashboard navigation.

## Risks / Trade-offs

- **[Risk]**: Pre-existing `measurements.db` files in developer environments lack the `etl_metadata` table.
  - **Mitigation**: NestJS `DatabaseService` handles missing `etl_metadata` table gracefully with `IF EXISTS` / `try-catch`, defaulting `isDemo` to `true` until the database is regenerated via `nx run agent-service:seed && nx run agent-service:etl`.
- **[Risk]**: Environment variable leakage during test runs.
  - **Mitigation**: Comply with AGENTS.md pitfall rule by isolating tests with explicit mock configurations or clean environment overrides.
