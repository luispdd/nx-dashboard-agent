# spike-native-federation Specification

## Purpose

Enables runtime microfrontend federation between an Angular host application and a React remote chat component using Native Federation.

## Requirements

### Requirement: Runtime microfrontend integration
The Angular shell host application SHALL load and mount the React chat microfrontend at runtime without host rebuilds or bundling collisions.

#### Scenario: Dynamic remote mounting
- **WHEN** the dashboard shell requests the chat remote entry point
- **THEN** the browser SHALL resolve the remote module via browser-native ESM and Import Maps and render the chat UI inside the host DOM

#### Scenario: Standalone remote execution
- **WHEN** the React chat remote is served directly in isolation
- **THEN** the application SHALL mount and render independently without requiring the host application

### Requirement: Shared microfrontend context contract
The shell and chat remote SHALL exchange typed dashboard state (selected metric, devices, time range) strictly through the shared contract library.

#### Scenario: Context propagation from host to remote
- **WHEN** the dashboard shell updates the active metric or device selection
- **THEN** the chat remote SHALL receive the updated context through the shared context contract
