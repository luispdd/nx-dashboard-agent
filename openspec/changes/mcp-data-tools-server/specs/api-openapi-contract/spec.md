## MODIFIED Requirements

### Requirement: OpenAPI specification publication and export
The system SHALL expose a complete OpenAPI 3.0 specification covering all public API endpoints, query schemas, and response DTOs, and SHALL provide a reproducible build target to export the document to disk, while explicitly excluding internal server-to-server endpoints such as the MCP server.

#### Scenario: Live OpenAPI documentation endpoint
- **WHEN** a client or developer navigates to `/api/docs`
- **THEN** the API SHALL serve an interactive OpenAPI / Swagger documentation interface reflecting all active endpoints, schemas, and parameter constraints

#### Scenario: Exporting OpenAPI specification as a build artifact
- **WHEN** the export command `bunx nx run dashboard-api:export-openapi` is executed
- **THEN** the system SHALL emit a valid `openapi.json` file to the distribution artifacts directory without requiring a continuously running server process

#### Scenario: MCP route exclusion from OpenAPI export
- **WHEN** the OpenAPI specification is generated or exported
- **THEN** the `/api/mcp` endpoint SHALL NOT appear in the OpenAPI document and generated frontend contracts SHALL remain identical
