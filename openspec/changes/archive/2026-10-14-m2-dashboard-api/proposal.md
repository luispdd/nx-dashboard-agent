## Why

Milestone M2 delivers the Dashboard API backend using NestJS, acting as the typed, high-performance, read-only data service for both the Angular Dashboard Shell and the FastAPI Agent Service (tool execution backend). 

Following the completion of Milestone M1 (which established the derived SQLite database at `data/derived/measurements.db`), this API provides the authoritative query interface for environmental measurements, metric catalogues, and device metadata. It introduces server-side downsampling, multi-device series queries, deterministic statistical aggregation, and an automated OpenAPI contract pipeline that publishes specs and generates native Angular `httpResource` clients via `ng-openapi`.

## What Changes

- **Fastify Adapter Migration**: Replace NestJS default Express engine with `@nestjs/platform-fastify` for high JSON throughput.
- **Read-Only SQLite Data Access with Kysely**: Implement a typed SQLite repository using `better-sqlite3` (`readonly: true`, WAL mode enabled) and Kysely query builder, decoupled behind an injectable `MeasurementsRepository` interface.
- **Metadata Endpoints**:
  - `GET /api/metrics`: Lists available metric keys, associated units, and catalog metadata from `metrics_catalog`.
  - `GET /api/devices`: Returns distinct active device identifiers (`device_id`) from `measurements`.
- **Time-Series Querying & Server-Side Bucketing**:
  - `GET /api/series`: Accepts `metric` (required), `devices` (comma-separated or multiple parameters), `from`, `to` (UTC ISO-8601 with `Z`), `bucket` (`5m`, `15m`, `1h`, `6h`, `1d`), and `include_on_demand` (boolean, default `false`).
  - Implements downsampling via SQLite `unixepoch(ts)` bucketing math.
  - Emits sparse bucket averages (returns existing buckets without synthetic zero/null interpolation).
  - Returns multi-series payloads grouped by device for direct consumption by ApexCharts and LLM agent tools.
- **Statistical Summaries**:
  - `GET /api/stats`: Computes `min`, `max`, `mean`, `std` (via SQL variance formula), `count`, and `missing_ratio` for requested devices and metrics over a designated time window.
- **OpenAPI & Client Contract Pipeline**:
  - Fully document endpoints with `@nestjs/swagger` decorators and class-validator DTOs.
  - Provide an export script/target (`dashboard-api:export-openapi`) to emit `openapi.json`.
  - Integrate `ng-openapi` (with `@ng-openapi/http-resource`) to generate Angular Signals-first resource services and TypeScript models into `libs/shared/contracts`.

## Capabilities

### New Capabilities

- `api-metrics-devices`: Provides Fastify setup, read-only SQLite Kysely data repository, and metadata retrieval endpoints (`/api/metrics`, `/api/devices`).
- `api-series-and-stats`: Implements time-series queries with server-side downsampling, sparse gap-handling, multi-device groupings (`/api/series`), and statistical summaries (`/api/stats`).
- `api-openapi-contract`: Configures Swagger documentation, OpenAPI JSON export, contract validation tests, and Angular `httpResource` client generation via `ng-openapi`.

### Modified Capabilities

None.

## Impact

- **Applications**:
  - `apps/dashboard-api`: Major implementation — Fastify adapter, configuration, database repository module, controllers, DTOs, services, and tests.
  - `apps/dashboard-shell`: Consumes generated contracts and `httpResource` services.
- **Libraries**:
  - `libs/shared/contracts`: Receives generated OpenAPI TypeScript models and Angular resource classes.
- **Dependencies**:
  - Adds `@nestjs/platform-fastify`, `fastify`, `@fastify/static`, `better-sqlite3`, `@types/better-sqlite3`, `kysely`, `@nestjs/swagger`, `class-validator`, `class-transformer`.
  - Development tools: `ng-openapi`, `@ng-openapi/http-resource`.
