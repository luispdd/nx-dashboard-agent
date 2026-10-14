## Context

Milestone M0 bootstrapped a minimal NestJS application at `apps/dashboard-api` configured with Webpack (`webpack.config.cjs`) and Vitest (`apps/dashboard-api/vitest.config.mts`). Milestone M1 established the derived SQLite database at `data/derived/measurements.db` containing `measurements` and `metrics_catalog`.

This design details the architecture of the production-ready NestJS Dashboard API: migrating to the Fastify adapter, implementing read-only data access with Kysely, delivering the query endpoints, and setting up the OpenAPI client generation pipeline with `ng-openapi`.

## Goals / Non-Goals

**Goals:**
- Provide sub-millisecond, read-only data query capabilities over SQLite using Fastify and Kysely.
- Implement server-side downsampling (`5m`, `15m`, `1h`, `6h`, `1d`) with sparse gap-preserving output.
- Support multi-device queries in a single request for chart visualization and agent tool execution.
- Maintain an automated OpenAPI contract pipeline that publishes specs and generates Angular `httpResource` services.
- Achieve 100% test coverage for controllers, query builders, and contract validation against the seeded synthetic dataset.

**Non-Goals:**
- Mutating or syncing data back to SQLite (strictly read-only).
- Device provisioning, node registration, or authentication.
- Free-form SQL query execution.
- In-memory interpolation of missing intervals.

## Decisions

### Decision 1: Kysely with `better-sqlite3` behind a Repository Interface
- **Choice:** Use `better-sqlite3` opened with `readonly: true` in WAL mode, wrapped by Kysely query builder. Services inject an abstract `MEASUREMENTS_REPOSITORY` token rather than importing a concrete database driver.
- **Rationale:** Kysely provides compile-time type-safety without ORM overhead or runtime schema synchronization. The repository interface decouples business query logic from SQLite internals, making unit testing straightforward with in-memory SQLite fixtures.
- **Alternatives Considered:**
  - *Drizzle ORM:* Excellent, but relational query builder is less ergonomic for analytical time-series downsampling math.
  - *Raw SQL strings:* High risk of typos and lack of compile-time type validation across schema refactors.

### Decision 2: NestJS Fastify Adapter (`@nestjs/platform-fastify`)
- **Choice:** Replace default Express engine with `@nestjs/platform-fastify`.
- **Rationale:** Fastify provides superior JSON serialization throughput and lower latency, ideal for streaming or serving large timeseries payloads.
- **Alternatives Considered:**
  - *Express:* Already in place from bootstrap, but slower JSON serialization and higher memory overhead.

### Decision 3: Sparse Server-Side Downsampling via SQLite Integer Math
- **Choice:** Group measurements by time intervals using SQLite's `unixepoch()` function:
  ```sql
  datetime((unixepoch(ts) / :bucketSeconds) * :bucketSeconds, 'unixepoch') || 'Z'
  ```
  Only emit buckets with recorded readings. Missing intervals are omitted.
- **Rationale:** Keeps response payloads compact. Let the frontend charts (ApexCharts) or agent anomaly detector detect intervals where $\Delta t > 1.5 \times \text{bucket}$ and render breaks natively, avoiding thousands of empty/null rows over sensor outages.
- **Alternatives Considered:**
  - *Padding with `null` values:* Bloats payload over long outages and creates ambiguity between "sensor read null" vs "sensor was silent".
  - *Linear interpolation:* Violates non-negotiable data rules by fabricating artificial data across gaps.

### Decision 4: Deterministic Sample Variance for `/api/stats`
- **Choice:** Calculate standard deviation in SQLite using the sample variance formula:
  $$\text{Var} = \frac{\sum x^2 - \frac{(\sum x)^2}{N}}{N - 1}$$
  $$\text{Std} = \sqrt{\text{Var}}$$
- **Rationale:** Computes summary statistics in a single query pass within the database engine without transferring raw measurements across the C++/Node boundary.
- **Alternatives Considered:**
  - *Node.js in-memory calculation:* Requires loading all matching rows into V8 memory, causing garbage collection pauses on large ranges.

### Decision 5: OpenAPI Client Pipeline with `ng-openapi`
- **Choice:** Annotate NestJS controllers and DTOs with `@nestjs/swagger`. Provide `dashboard-api:export-openapi` to emit `dist/apps/dashboard-api/openapi.json`. Use `ng-openapi` with `@ng-openapi/http-resource` to generate Angular Signals-first resource classes into `libs/shared/contracts`.
- **Rationale:** Automates typed client consumption for `dashboard-shell` using native `httpResource` without manual HTTP wrapper boilerplate.
- **Alternatives Considered:**
  - *Hand-written `httpResource` wrappers:* Lightweight, but requires manual maintenance of fetch parameters.
  - *Traditional Axios/Fetch generator:* Generates promise/callback code unaligned with Angular's Signals and zoneless reactivity.

### Decision 6: Multi-Device Grouped Series Payload
- **Choice:** Format `/api/series` responses as:
  ```json
  {
    "metric": "temperature",
    "unit": "°C",
    "bucket": "1h",
    "series": [
      {
        "device_id": "esp32c6",
        "points": [{ "ts": "2026-10-05T08:00:00Z", "value": 21.4 }]
      }
    ]
  }
  ```
- **Rationale:** Directly maps to ApexCharts multi-series configuration (`series: [{ name, data }]`) and enables agent tools to compare devices with a single HTTP round-trip.

## Risks / Trade-offs

- **[Risk] Webpack ESM compatibility with `@fastify/static` or `@nestjs/swagger`**  
  *Mitigation:* Keep `apps/dashboard-api/webpack.config.cjs` CommonJS-compatible; ensure external dependencies like `better-sqlite3` are treated as externals in Webpack.
- **[Risk] NestJS DI under Vitest with Fastify**  
  *Mitigation:* Maintain explicit `@Inject(...)` decorators on all controller and service constructor parameters to bypass missing `design:paramtypes` metadata in Vitest.
- **[Risk] Zone-less timestamp parsing by consumers**  
  *Mitigation:* Strictly enforce ISO-8601 UTC representation with `Z` in response DTOs and regex validators.
