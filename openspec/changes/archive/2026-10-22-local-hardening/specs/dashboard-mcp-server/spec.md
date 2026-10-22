## MODIFIED Requirements

### Requirement: Optional authentication and origin guard
The MCP endpoint SHALL enforce the shared Origin and Host allowlists by default and verify bearer tokens using a constant-time comparison when configured.

#### Scenario: Unauthorized request rejected
- **WHEN** `MCP_AUTH_TOKEN` is configured and a request to `/api/mcp` lacks a matching `Authorization: Bearer <token>` header
- **THEN** the server SHALL reject the request with HTTP 401 Unauthorized using a constant-time token comparison

#### Scenario: MCP origin enforcement
- **WHEN** a request arrives at `/api/mcp` with an `Origin` header not included in `ALLOWED_ORIGINS` (or alias `MCP_ALLOWED_ORIGINS`)
- **THEN** the server SHALL reject the request with HTTP 403 Forbidden

#### Scenario: MCP Host header check
- **WHEN** a request arrives at `/api/mcp` with a `Host` header outside `ALLOWED_HOSTS`
- **THEN** the server SHALL reject the request with HTTP 403 Forbidden
