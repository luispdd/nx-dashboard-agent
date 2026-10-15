## ADDED Requirements

### Requirement: Active Telemetry Filter Context Broadcasting
The trends view SHALL synchronize its active telemetry filter state (selected metric, selected device, active time range preset, point count, and display unit) into the centralized `DashboardContextService` so that downstream components and remote micro frontends receive real-time updates.

#### Scenario: Synchronizing initial metric and default filters
- **WHEN** the trends view completes initial catalog discovery and selects its default metric
- **THEN** it updates `DashboardContextService` with the default metric, selected device (`all` or specific ID), active range preset, and resolved unit

#### Scenario: Updating context on filter change
- **WHEN** the user selects a different metric, device, range preset, or point count in the filter controls
- **THEN** the trends view immediately pushes the updated filter configuration into `DashboardContextService`
