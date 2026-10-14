# dashboard-telemetry-trends Specification

## Purpose

Provides dynamic catalog discovery, multi-device time-series telemetry charts, dual-mode filter controls, and synchronized per-board statistics for environmental metrics.

## Requirements

### Requirement: Dynamic Catalog Discovery on Page Load
The dashboard SHALL query the backend metadata endpoints `/api/metrics` and `/api/devices` upon initial view load and populate filter options dynamically without hardcoded metric keys or device lists.

#### Scenario: Metric catalog population
- **WHEN** the trends view initializes
- **THEN** it SHALL fetch available metrics from `/api/metrics`, format their human-readable labels and display units, and render a selectable metric pill for each item

#### Scenario: Device list and deterministic color assignment
- **WHEN** the device list is received from `/api/devices`
- **THEN** the system SHALL sort the device identifiers alphabetically and deterministically assign each device a distinct theme color from `BOARD_PALETTE` in index order

### Requirement: Two-Line Mutually Exclusive Filter Controls
The trends view SHALL provide two dedicated filter rows for temporal range presets and latest point counts, where selecting an option in one row immediately unselects the other row.

#### Scenario: Selecting a time range preset
- **WHEN** a user clicks a time range button (e.g. `Last 1d`)
- **THEN** the system SHALL set the active time range, clear any selected point count so that all point buttons become unselected, and query `/api/series` with `from` and the corresponding downsampling `bucket`

#### Scenario: Selecting a latest point count
- **WHEN** a user clicks a point count button (e.g. `50`)
- **THEN** the system SHALL set the active point count to 50, clear any selected time range so that all range buttons become unselected, and query `/api/series` with `limit=50` and `bucket=5m`

#### Scenario: Switching between filter rows
- **WHEN** a user with an active point selection clicks a time range button
- **THEN** the point count button SHALL visually unselect and the newly selected time range button SHALL activate immediately without manual mode toggling

### Requirement: Sampling Mode Segmented Pill Toggle
The trends view SHALL provide a segmented pill control to switch between regular scheduled telemetry and all telemetry data including manual on-demand readings.

#### Scenario: Default scheduled sampling mode
- **WHEN** the dashboard loads or resets
- **THEN** the sampling control SHALL default to `Regular Only` (`include_on_demand=false`), excluding manually triggered on-demand readings from aggregates

#### Scenario: Toggling all data
- **WHEN** the user selects `All Data` in the segmented toggle
- **THEN** the system SHALL set `include_on_demand=true` and refresh the active series query to incorporate on-demand measurements

### Requirement: Telemetry Chart Visualization
The trends view SHALL render multi-device time series using ApexCharts area/line charts with smooth curves, gradient fills, local timezone axes, interactive tooltips, and gap preservation.

#### Scenario: Viewer local timezone axis display
- **WHEN** series data containing UTC timestamps is received
- **THEN** the chart X-axis labels and tooltips SHALL format timestamps converted to the viewer's local browser timezone rather than raw UTC

#### Scenario: Gap rendering without synthetic interpolation
- **WHEN** a device has missing telemetry across time intervals
- **THEN** the chart SHALL render visible gaps in the device curve rather than interpolating continuous straight lines across missing intervals

#### Scenario: Point marker rendering without toolbar
- **WHEN** the telemetry chart renders time-series data
- **THEN** it SHALL render individual readings as discrete point markers on the curve, omit the chart toolbar controls, and disable text data labels

### Requirement: Per-Board Synchronized Statistics Table
The trends view SHALL display a per-device statistics table positioned directly below the chart, dynamically calculated from the active chart series points.

#### Scenario: Statistics display with measurement counts
- **WHEN** series points are rendered for one or more devices
- **THEN** the statistics table SHALL display a row for each board showing its color badge, device identifier, Min, Max, Average, Latest values formatted with the active metric's unit, and the total count of measurements rendered for that device

#### Scenario: Immediate synchronization on filter change
- **WHEN** the user alters the metric, device filter, time range, or point count
- **THEN** the statistics table values and measurement counts SHALL update immediately to match the newly rendered points
