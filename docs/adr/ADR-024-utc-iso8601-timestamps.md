# ADR-024: Temporal Data — UTC with Z Timestamps Everywhere Internally

## Status
Accepted

## Context
Timezone mishandling is one of the most prolific sources of subtle data bugs in distributed telemetry systems.
Common failure modes:
1. Parsing ambiguous strings like `2026-10-05 08:36:23` with JavaScript `new Date(...)` or Python `datetime.fromisoformat()`, causing the runtime environment's local timezone (e.g. host machine vs container UTC) to silently shift readings by several hours.
2. Inconsistent representations across APIs (epoch milliseconds in some endpoints, local ISO strings in others).
3. Incorrect aggregation buckets when grouping sensor readings across days or hours.

## Decision
We enforce a strict **UTC with `Z` suffix** timestamp policy across all backend services, database records, API contracts, and agent prompts:

1. **Internal Representation**:
   - All internal timestamps must match the format `YYYY-MM-DDTHH:mm:ssZ` (e.g. `2026-10-05T08:36:23Z`).
   - The ETL pipeline converts all naive timestamps from the source SQLite database into UTC with `Z`.
2. **API & Serialization**:
   - NestJS DTOs, SQLite storage, Pydantic schemas, and OpenAPI specs serialize timestamps as ISO-8601 UTC strings with `Z`.
   - Never parse a zone-less timestamp with JavaScript `new Date(str)`.
3. **Presentation Layer**:
   - Timestamps are converted to the user's local browser timezone solely at the presentation boundary in the Angular dashboard or React chat UI.

## Consequences & Verification
- **Predictable Time-Series Alignment**: Charts, range filters, and anomaly detection windows align without clock skew across timezones.
- **Container Parity**: Local development on developer laptops and Docker containers in cloud environments produce identical temporal query results.
- **Static & Runtime Tests**: E2E and unit test assertions explicitly enforce UTC format and `Z` suffix validation.
