# ADR-023: Data Pipeline — Read-Only Derived SQLite Database via In-Process ETL

## Status
Accepted

## Context
The source IoT data originates from an external source system that exports SQLite databases containing raw sensor logs. The source database schema has historical quirks:
- Timestamps lack time zone indicators (naive ISO strings like `2026-10-05 08:36:23`).
- On-demand calibration/test readings are marked via an ambiguous boolean column (`is_fine_tuned`).
- Sensor metric names and unit representations vary across firmware revisions.
- Direct queries on the raw source tables are slow for aggregation and lack indexes suited for dashboard visualization.

Directly mutating the source database file or running runtime conversions on every user query hurts query latency and risks corrupting original data archives.

## Decision
We implement a strictly **read-only source database** policy with a **derived read-only database produced via ETL**:

1. **Immutable Source Migrations Inbox**:
   - Source database files are placed in `data/migrations/` (or synthetic seed generation) and treated as immutable read-only artifacts.
2. **Deterministic In-Process ETL**:
   - `dashboard-api` provides an ETL pipeline (`nx run dashboard-api:etl` or in-process execution via Kysely / SQLite) that transforms raw readings into `data/derived.db`.
   - ETL operations:
     - Normalizes timestamps to unambiguous UTC ISO-8601 strings with trailing `Z` (`YYYY-MM-DDTHH:mm:ssZ`).
     - Maps `is_fine_tuned` to semantic `sampling: "scheduled" | "on_demand"`.
     - Standardizes metric identifiers and builds covering indexes for fast time-series slicing.
3. **Derived Database Ownership**:
   - `dashboard-api` opens `data/derived.db` in read-only mode during standard operation.
   - Real database files can be ingested on demand via the Dashboard Settings view, replacing the derived database in a clean, atomic swap.

## Consequences & Verification
- **Data Integrity**: Source telemetry files can never be corrupted by application bugs.
- **Query Performance**: The derived database contains targeted indexes, providing sub-millisecond lookups for dashboard charts and agent tools.
- **Traceability**: ETL transformation logic is tested in unit tests with synthetic and edge-case inputs.
