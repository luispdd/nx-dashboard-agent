## Why

Milestone M3 delivers the user-facing Angular Dashboard Shell, providing a responsive, signals-first, zoneless visualization platform for IoT sensor telemetry. Following the completion of Milestone M2 (which established the read-only NestJS backend API and typed Angular `httpResource` contracts), this milestone connects the frontend directly to the derived database via the API.

Users need an intuitive, high-performance interface to inspect environmental time-series measurements across IoT nodes, analyze trends over custom date ranges, inspect latest telemetry pulses, observe data sampling modes, and manage LLM runtime configurations.

## What Changes

- **Backend Series Limit Support**:
  - Extend `GET /api/series` in `dashboard-api` to accept an optional `limit` query parameter (positive integer).
  - Use SQLite window ranking (`ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY ts DESC)`) to retrieve the latest N measurements per device in chronological order.
  - Re-export `openapi.json` and regenerate typed Angular resource contracts in `libs/shared/contracts`.
- **Chart Infrastructure & ADR**:
  - Integrate `apexcharts` and `ng-apexcharts` as the charting engine in `dashboard-shell`.
  - Record the ApexCharts selection as an architectural decision record (`docs/adr/0015-apexcharts-visualization.md`).
- **Dashboard Shell Architecture**:
  - Build a zoneless Angular 22 application shell (`provideExperimentalZonelessChangeDetection()`) with Tailwind CSS and modular SCSS styles.
  - Establish top navigation with routes for **Trends** (`/` or `/home`), **Device Distribution** (`/distribution`), and **Settings** (`/settings`).
  - Provide a dedicated slide-over / docked container for mounting the React chat assistant remote via Native Federation.
- **Dynamic Telemetry Trends (`/home`)**:
  - On page load, dynamically fetch `/api/metrics` and `/api/devices`.
  - Alphabetically sort discovered device identifiers and deterministically map them to `BOARD_PALETTE` colors.
  - Dynamic filter bar:
    - Metric selector pills dynamically populated from the catalog with physical units.
    - Device dropdown (`All Devices` + individual boards).
    - Two-line mutually exclusive button groups: **Time Range** (`10m`, `1h`, `3h`, `6h`, `1d`, `3d`, `7d`, `30d`) and **Latest Points** (`10`, `50`, `100`, `200`, `500`). Clicking any option in one group immediately deselects the other group.
    - Segmented pill button for data sampling: `Regular Only` (default, `include_on_demand=false`) vs `All Data` (`include_on_demand=true`).
  - Generic telemetry chart component (`<app-telemetry-chart>`) rendering multi-device area/line series with viewer local-timezone axes, smooth curves, markers, interactive tooltips, and gap rendering without synthetic interpolation.
  - Per-board statistics table synchronized with active chart points, displaying Min, Max, Avg, Latest values (with metric units) and the total number of measurements stored/rendered per device.
- **Secondary Views (`/distribution` & `/settings`)**:
  - `/distribution`: Device measurement volume breakdown chart (donut/bar) showing data distribution and board activity balance.
  - `/settings`: LLM runtime configuration management interface for reviewing and updating `base_url`, `model`, and `api_key` (`data/runtime-config.json`).

## Capabilities

### New Capabilities

- `dashboard-shell-layout`: Responsive zoneless Angular 22 shell layout, navigation bar (`Trends`, `Distribution`, `Settings`), theme variables, and docked container for React chat remote.
- `dashboard-telemetry-trends`: Dynamic catalog discovery (`/metrics`, `/devices`), deterministic color assignment, two-line mutually exclusive button group filters (Range vs Points), segmented sampling toggle, generic ApexCharts telemetry chart, and per-board statistics table including measurement counts.
- `dashboard-distribution-and-settings`: Scaffolded secondary route `/distribution` for device measurement volume breakdown, and `/settings` route for LLM runtime configuration.

### Modified Capabilities

- `api-series-and-stats`: Extend `GET /api/series` query parameters to support an optional `limit` integer parameter for retrieving the latest N data points per device, returned in chronological order.

## Impact

- **Applications**:
  - `apps/dashboard-api`: Add `limit` to `SeriesQueryDto`, update `KyselyMeasurementsRepository.getSeries`, update controller unit tests, re-export OpenAPI specification.
  - `apps/dashboard-shell`: Implement navigation, routing, catalog/capabilities service, filter bar, telemetry chart, statistics table, distribution view, and settings view.
- **Libraries**:
  - `libs/shared/contracts`: Re-generate Angular resource clients and DTO models incorporating the new `limit` query parameter.
- **Dependencies**:
  - Adds `apexcharts` and `ng-apexcharts` to workspace dependencies.
