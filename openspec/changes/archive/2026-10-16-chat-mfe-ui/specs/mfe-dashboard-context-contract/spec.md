## MODIFIED Requirements

### Requirement: Default Context Fallback Initialization
The shared context library SHALL provide default context factory functions (`createDefaultContainerContext` and `createDefaultDashboardContext`) ensuring standalone remotes and unconfigured hosts initialize with valid baseline filters decoupled from a specific host application.

#### Scenario: Standalone remote execution fallback
- **WHEN** a micro frontend remote runs standalone in development without host options
- **THEN** `createDefaultContainerContext()` (or `createDefaultDashboardContext()`) provides fallback default devices and a 24-hour time range preset
