# ADR-021: Service Decoupling — Agent Service Never Connects Directly to the Database

## Status
Accepted

## Context
In a multi-service architecture with a Python agent service (`apps/agent-service`) and a NestJS data service (`apps/dashboard-api`), a tempting shortcut is having the Python service mount the SQLite database file directly or execute SQLite queries locally.

However, sharing the physical database across services causes critical issues:
1. **Schema Duplication**: Both TypeScript and Python codebases would need independent, duplicate schema definitions, migrations, and query logic.
2. **File Locking & State Contention**: SQLite in WAL mode handles multiple readers well, but concurrent read-locks across separate runtime environments and potential schema migrations can create lock contention.
3. **Bypassing Domain Logic**: Filtering rules (e.g. `sampling: "scheduled"` vs `"on_demand"`, UTC normalization, sensor calibration adjustments) would have to be re-implemented in Python, creating divergence bugs.

## Decision
The Python agent service **never opens or mounts the database directly**. All data access goes through the NestJS `dashboard-api` HTTP endpoints.

1. **Single Source of Data Access**:
   - `dashboard-api` is the sole service with read access to the derived SQLite database (`data/derived.db`).
   - `dashboard-api` exposes domain-centric REST endpoints (`/api/devices`, `/api/measurements`, etc.).
2. **Agent Consumption**:
   - `agent-service` interacts with `dashboard-api` exclusively via an HTTP client using base URL configuration (`DASHBOARD_API_URL`).
   - Domain invariants (timestamp normalization, exclusion of on-demand calibration readings by default) are applied centrally by `dashboard-api`.

## Consequences & Verification
- **Separation of Concerns**: `dashboard-api` owns data retrieval and query performance; `agent-service` owns agentic reasoning and LLM interactions.
- **Portability**: In Docker Compose, the database volume is mounted only into the `dashboard-api` container, preventing multi-container file sharing edge cases.
- **Verification**: Code search confirms no database client (`sqlite3`, `aiosqlite`, `SQLAlchemy`) is imported or instantiated in `apps/agent-service`.
