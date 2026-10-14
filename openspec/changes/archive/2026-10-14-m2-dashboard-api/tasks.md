## 1. Fastify & Data Layer Infrastructure

- [x] 1.1 Install backend dependencies (`@nestjs/platform-fastify`, `fastify`, `@fastify/static`, `better-sqlite3`, `@types/better-sqlite3`, `kysely`, `@nestjs/swagger`, `class-validator`, `class-transformer`) and verify package installation cleanly resolves with `bun install`.
- [x] 1.2 Migrate `apps/dashboard-api/src/main.ts` to `FastifyAdapter`, configure CORS, global prefix `/api`, and verify the server boots with `bunx nx serve dashboard-api`.
- [x] 1.3 Implement typed SQLite database configuration and Kysely database schema definitions (`measurements`, `metrics_catalog`) in `apps/dashboard-api/src/app/database/`.
- [x] 1.4 Create the abstract `MeasurementsRepository` interface and its Kysely implementation connecting to `data/derived/measurements.db` in read-only mode with WAL enabled, verified by unit tests in `apps/dashboard-api/src/app/database/measurements.repository.spec.ts`.
- [x] 1.5 Configure global `ValidationPipe` with whitelist settings and a standardized `HttpExceptionFilter` in `apps/dashboard-api/src/app/common/`, verified by controller test cases.

## 2. Metrics & Devices Endpoints (`api-metrics-devices`)

- [x] 2.1 Implement `MetricsService` and `MetricsController` for `GET /api/metrics`, returning list of metrics with units from `metrics_catalog`.
- [x] 2.2 Implement `DevicesService` and `DevicesController` for `GET /api/devices`, returning distinct sorted list of device IDs from `measurements`.
- [x] 2.3 Add unit and integration tests for `MetricsController` and `DevicesController` verifying responses against seeded SQLite data with `bunx nx test dashboard-api`.

## 3. Downsampled Series & Stats Endpoints (`api-series-and-stats`)

- [x] 3.1 Define query DTOs (`SeriesQueryDto`, `StatsQueryDto`) with `class-validator` validating required metric keys, optional multi-device lists, ISO-8601 UTC timestamps with `Z`, and bucket intervals (`5m`, `15m`, `1h`, `6h`, `1d`).
- [x] 3.2 Implement `SeriesService` with Kysely downsampling query using `unixepoch` bucket math, sparse non-empty aggregation, and multi-device grouping.
- [x] 3.3 Implement `GET /api/series` in `SeriesController`, verified by tests covering bucketing, multi-device responses, and `include_on_demand` filtering.
- [x] 3.4 Implement `StatsService` and `StatsController` for `GET /api/stats` computing SQL-level sample variance/std, min, max, mean, count, and missing ratio.
- [x] 3.5 Add unit tests in `apps/dashboard-api/src/app/stats/stats.service.spec.ts` testing zero-reading devices, missing ratios, and numeric precision with `bunx nx test dashboard-api`.

## 4. OpenAPI Contract & Client Generation (`api-openapi-contract`)

- [x] 4.1 Decorate all controllers, query parameters, and response DTOs with `@nestjs/swagger` annotations and enable Swagger UI at `/api/docs`.
- [x] 4.2 Create an OpenAPI export script and Nx target `dashboard-api:export-openapi` emitting `dist/apps/dashboard-api/openapi.json`, verified by running `bunx nx run dashboard-api:export-openapi`.
- [x] 4.3 Install `ng-openapi` and `@ng-openapi/http-resource`, configure `openapi.config.ts` in `libs/shared/contracts/`, and verify generation of TypeScript models and Angular `httpResource` services.
- [x] 4.4 Add contract integration tests verifying that actual API endpoint responses match the generated OpenAPI specification using the synthetic dataset with `bunx nx test dashboard-api`.
