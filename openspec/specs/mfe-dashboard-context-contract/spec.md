# mfe-dashboard-context-contract Specification

## Purpose

Provides a shared typed contract and reactive subscription bridge for exchanging real-time dashboard filter context between the host shell, remote microfrontends, and the agent backend.

## Requirements

### Requirement: Cross-MFE Dashboard Context Data Model
The shared context library SHALL define a normalized `DashboardContext` data structure representing the user's active telemetry inspection view, including selected metric key, selected device identifiers, display unit, and temporal range parameters.

#### Scenario: Complete context definition with time range preset
- **WHEN** the dashboard shell initializes or changes its active view to a preset window
- **THEN** `DashboardContext` provides `selectedMetric` (string), `selectedDevices` (string array), `unit` (string), and `timeRange` with `preset`, `from`, and `to` ISO-8601 UTC timestamp strings

#### Scenario: Point count mode representation
- **WHEN** the dashboard shell filters by latest point count rather than a time window
- **THEN** `DashboardContext` provides `timeRange` containing `points` as a positive integer alongside `from` and `to` bounds if resolved

### Requirement: Lifecycle Mount and Reactive Subscription Bridge
The shared context contract SHALL define mount options for micro frontend remotes with a typed `onContextChange` listener registration callback, enabling hosts to push live updates to the remote without coupling to framework-specific state libraries.

#### Scenario: Registering context change listener on mount
- **WHEN** the host mounts a remote micro frontend into a DOM container
- **THEN** the host provides an initial `context` object and an `onContextChange` registration function that accepts a listener callback and returns an unsubscribe cleanup function

#### Scenario: Dispatching live context updates to registered listener
- **WHEN** the host's active dashboard context changes after initial mounting
- **THEN** the host invokes registered listener callbacks with the new `DashboardContext`, allowing the remote to re-render or update state in real-time

### Requirement: Default Context Fallback Initialization
The shared context library SHALL provide default context factory functions (`createDefaultContainerContext` and `createDefaultDashboardContext`) ensuring standalone remotes and unconfigured hosts initialize with valid baseline filters decoupled from a specific host application.

#### Scenario: Standalone remote execution fallback
- **WHEN** a micro frontend remote runs standalone in development without host options
- **THEN** `createDefaultContainerContext()` (or `createDefaultDashboardContext()`) provides fallback default devices and a 24-hour time range preset
