# ADR-015: Charting Library Selection — ApexCharts for Time-Series & Telemetry Visualization

## Status
Accepted

## Context
The Angular dashboard shell (`apps/dashboard-shell`) requires a charting engine for visualizing IoT environmental telemetry across multiple ESP32 boards.

Key requirements and constraints:
1. **Time-Series Capabilities**: Native datetime X-axis support with automatic conversion to the viewer's local browser timezone (`datetimeUTC: false`) while handling UTC ISO-8601 timestamps from the API.
2. **Gap Rendering**: Ability to display sparse time series with true visual gaps rather than synthetic zero-interpolation or misleading straight diagonals connecting disjoint intervals.
3. **Interactive Navigation**: Built-in pan, zoom in/out, reset, and synchronized crosshair tooltips with physical units.
4. **Modern UI Aesthetics**: High visual appeal with dark-theme styling, gradient area fills, customizable markers, and responsive layouts.
5. **Angular 22 Zoneless Compatibility**: Standalone integration compatible with `OnPush` change detection and Signals-first component architectures.

## Decision
We adopt **ApexCharts** (`apexcharts` and `ng-apexcharts`).

1. **Angular Integration**:
   - `ng-apexcharts` provides the `<apx-chart>` component wrapped inside a generic `<app-telemetry-chart>` presentation component.
   - All chart series and configuration options are passed as pure `computed()` signals to maintain zoneless `OnPush` performance.
2. **Timezone & Gap Configuration**:
   - Timestamps are provided as UTC millisecond epoch timestamps (`new Date(ts).getTime()`).
   - `xaxis.datetimeUTC = false` delegates local timezone formatting directly to the browser Intl engine.
   - Sparse points omit missing buckets, rendering clean visual breaks across device downtime.
3. **Distribution & Summary Visuals**:
   - ApexCharts also powers the secondary `/distribution` view using donut and bar charts for device measurement volume breakdown.

## Alternatives Considered
- **Chart.js**: Requires external date adapters (`date-fns` / `luxon`), additional plugins for zoom/pan, and more manual configuration for gradient area fills.
- **Apache ECharts**: High bundle weight and complex imperative option configuration for standard environmental time series.

## Consequences & Verification
- **Installation**: `apexcharts` and `ng-apexcharts` installed via `bun add`.
- **Bundle & Build**: Successfully compiles with Angular 22 ApplicationBuilder (esbuild/Vite).
- **Verification**: Verified with unit and Playwright E2E tests for time-range filtering, zoom controls, and multi-series line rendering.
