# api-openapi-contract Specification

## Purpose

Defines the OpenAPI schema contract for the Dashboard API and establishes automated tooling to publish specs, validate response shapes, and generate Angular Signals-first resource clients.

## Requirements

### Requirement: OpenAPI specification publication and export
The system SHALL expose a complete OpenAPI 3.0 specification covering all public API endpoints, query schemas, and response DTOs, and SHALL provide a reproducible build target to export the document to disk.

#### Scenario: Live OpenAPI documentation endpoint
- **WHEN** a client or developer navigates to `/api/docs`
- **THEN** the API SHALL serve an interactive OpenAPI / Swagger documentation interface reflecting all active endpoints, schemas, and parameter constraints

#### Scenario: Exporting OpenAPI specification as a build artifact
- **WHEN** the export command `bunx nx run dashboard-api:export-openapi` is executed
- **THEN** the system SHALL emit a valid `openapi.json` file to the distribution artifacts directory without requiring a continuously running server process

### Requirement: Angular resource client generation via ng-openapi
The system SHALL generate typed Angular resource services utilizing `httpResource` and pure TypeScript interfaces from the published OpenAPI specification into the shared contracts library.

#### Scenario: Automated client code generation
- **WHEN** the contract generation command is run
- **THEN** `ng-openapi` SHALL generate type-safe resource services utilizing `@ng-openapi/http-resource` and TypeScript interfaces in `libs/shared/contracts`

#### Scenario: Timestamp preservation in generated models
- **WHEN** models are generated from OpenAPI `date-time` fields
- **THEN** timestamp fields SHALL be typed as ISO-8601 UTC strings (`string`) rather than auto-instantiated JavaScript `Date` objects

### Requirement: OpenAPI contract verification against synthetic dataset
The system SHALL provide contract tests that validate runtime API responses against the generated OpenAPI specification using the synthetic derived database.

#### Scenario: Validating response payload schemas
- **WHEN** contract tests execute against the test API instance seeded with synthetic data
- **THEN** every response payload for `/api/metrics`, `/api/devices`, `/api/series`, and `/api/stats` SHALL strictly conform to its declared OpenAPI schema definition
