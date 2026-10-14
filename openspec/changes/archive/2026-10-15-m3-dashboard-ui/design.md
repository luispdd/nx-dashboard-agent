## Context

See `proposal.md` for background and motivation. The system has completed Milestone M1 (derived database `measurements.db`) and Milestone M2 (NestJS Dashboard API and generated OpenAPI clients in `libs/shared/contracts`). Milestone M3 builds the frontend visualization shell in Angular 22, connecting to the API via generated `httpResource` clients.

## Goals / Non-Goals

**Goals:**
- Deliver a fast, responsive, and aesthetically polished Angular 22 dashboard shell using zoneless change detection and Signals-first state management.
- Provide dynamic, catalog-driven telemetry views without hardcoded sensor metrics or board names.
- Enable dual-mode telemetry filtering through two-line mutually exclusive button groups (time range presets vs latest point counts) and a segmented pill sampling toggle.
- Synchronize chart visualizations and the per-board statistics table (including measurement counts) with zero visual divergence.
- Scaffold secondary routes for device measurement volume breakdown (`/distribution`) and LLM runtime settings (`/settings`).

**Non-Goals:**
- Full hardware poller or MQTT live connection monitoring (out of scope for this dashboard).
- Direct database access from the frontend (strictly mediated by `dashboard-api`).
- Bidirectional device control (the dashboard is strictly a read-only telemetry viewer).
- Implementation of the React chat remote internals (handled in Milestone M6; M3 only provides the shell host mounting container).

## Decisions

### Decision 1: Server-side `limit` query parameter on `GET /api/series`
- **Choice**: Extend `SeriesQueryDto` and `KyselyMeasurementsRepository` to support `limit?: number`. When specified, SQLite uses window ranking `ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY ts DESC)` to fetch the latest N points per device, returned in ascending chronological order.
- **Rationale**: Keeps network payloads compact and deterministic. Prepares the API for reuse by LLM agent tools in M4/M5 where tools frequently query "the last 10 readings" of a node.
- **Alternatives considered**:
  - *Client-side slicing only*: Requires fetching large time windows over the wire even when only 10 points are needed.
  - *Separate `/api/series/latest` endpoint*: Adds unnecessary API surface when a query parameter naturally composes with existing `metric`, `devices`, and `include_on_demand` parameters.

### Decision 2: Chart library choice — ApexCharts
- **Choice**: Adopt ApexCharts (`apexcharts` and `ng-apexcharts`) for time-series and distribution charts, recorded in `docs/adr/0015-apexcharts-visualization.md`.
- **Rationale**: Native datetime X-axis support with automatic browser timezone formatting (`datetimeUTC: false`), built-in pan/zoom toolbars, gradient area fills, synchronized crosshair tooltips, and seamless null-point gap rendering without linear interpolation.
- **Alternatives considered**:
  - *Chart.js*: Requires external date adapters and manual plugins for pan/zoom and gap styling.
  - *ECharts*: High bundle size and more verbose configuration for standard telemetry curves.

### Decision 3: Dynamic catalog discovery with deterministic palette assignment
- **Choice**: On page load, `CapabilitiesService` queries `GET /api/metrics` and `GET /api/devices`. Device IDs are sorted alphabetically and assigned colors in order from a 10-color theme palette (`BOARD_PALETTE`).
- **Rationale**: Complete decoupling from static sensor lists. If new sensors or boards are added to the database, the dashboard immediately visualizes them without code changes. Sorting ensures stable color assignment across refreshes.
- **Alternatives considered**:
  - *Random color assignment*: Inconsistent and disorienting across page refreshes.
  - *Hardcoded device configurations*: Violates the requirement that metrics and boards must be discovered dynamically on the fly.

### Decision 4: Two-line mutually exclusive filter controls
- **Choice**: Render two distinct button rows: **Time Range** (`10m`, `1h`, `3h`, `6h`, `1d`, `3d`, `7d`, `30d`) and **Latest Points** (`10`, `50`, `100`, `200`, `500`). Clicking any option in one row immediately activates it and clears/unselects all options in the other row.
- **Rationale**: Maximizes clarity and minimizes friction. Eliminates the need for a separate "Mode" toggle or dropdown while preventing conflicting filter states (e.g. asking for "Last 7 days" and "10 points" simultaneously).
- **Alternatives considered**:
  - *Explicit Mode Switch dropdown*: Adds an unnecessary click before the user can choose the desired preset.
  - *Combining range and limit*: Creates ambiguous query semantics (e.g. "50 points within last 7 days").

### Decision 5: Synchronized client-side statistics calculation
- **Choice**: Derive the per-board statistics table directly from the active `chartSeries()` points rendered on screen, calculating `min`, `max`, `avg`, `latest`, and `count` (number of measurements) per device.
- **Rationale**: Guarantees 100% mathematical and visual alignment between the chart and the table with zero additional network requests.
- **Alternatives considered**:
  - *Separate call to `GET /api/stats` on every filter click*: Inefficient, and risk of mismatch if bucketing or time bounds differ slightly between the series and stats queries.

### Decision 6: Angular architecture conventions
- **Choice**: Strictly comply with workspace conventions: zoneless change detection (`provideExperimentalZonelessChangeDetection`), `ChangeDetectionStrategy.OnPush`, Signals-first state (`signal()`, `computed()`, `input()`, `output()`), and strict file separation (`.ts`, `.html`, `.scss` with no inline templates/styles).

## Risks / Trade-offs

- **[Risk]** Window functions on large SQLite tables causing slow queries.  
  → **Mitigation**: The composite index `idx_measurements_series ON measurements(device_id, metric_key, ts)` established in Milestone M1 directly satisfies the partitioned ranking query with index scans.
- **[Risk]** ApexCharts canvas rendering lag during rapid filter switching.  
  → **Mitigation**: Chart options and series are provided as pure `computed()` signals to `ng-apexcharts`, triggering clean canvas updates only when data changes.
- **[Risk]** Timezone discrepancies between UTC database timestamps and local viewer displays.  
  → **Mitigation**: Timestamps are passed to ApexCharts as UTC millisecond timestamps (`new Date(ts).getTime()`) while setting `xaxis.datetimeUTC = false`. ApexCharts formats labels and tooltips in the viewer's local timezone.
