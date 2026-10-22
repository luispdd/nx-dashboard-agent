# dashboard-mcp-server Specification

## Purpose

Exposes dashboard telemetry, metric catalogs, and dataset summaries as read-only Model Context Protocol (MCP) tools over Streamable HTTP for consumption by external agents and tools.

## Requirements

### Requirement: Streamable HTTP MCP endpoint
The system SHALL expose a read-only Model Context Protocol (MCP) server over Streamable HTTP at `/api/mcp` that supports stateless tool discovery and tool invocation.

#### Scenario: Tool discovery via tools/list
- **WHEN** an MCP client sends an initialize request followed by a `tools/list` request to `/api/mcp`
- **THEN** the server SHALL return every tool in the catalog with its name, description, and JSON Schema input definition using protocol revision `2024-11-05`

#### Scenario: Server instructions in initialize response
- **WHEN** an MCP client sends an `initialize` request to `/api/mcp`
- **THEN** the server response SHALL include server-level `instructions` specifying that telemetry timestamps are UTC with Z and data is sampled regularly every 5 minutes

#### Scenario: Non-POST requests rejected
- **WHEN** a client sends a GET or DELETE request to `/api/mcp`
- **THEN** the server SHALL respond with HTTP status `405 Method Not Allowed`

### Requirement: Service parity and persistence abstraction
MCP tools and REST controllers SHALL delegate to the same domain services and SHALL contain no direct query or database access logic.

#### Scenario: Parity between REST and MCP results
- **WHEN** an MCP tool (e.g. `get_series`, `get_stats`) and its corresponding REST endpoint are invoked with equivalent arguments against the same seeded database
- **THEN** both responses SHALL contain identical data points, aggregations, and units (envelope formatting aside)

#### Scenario: Architecture boundary enforcement
- **WHEN** imports in `apps/dashboard-api/src/app/mcp/` are statically analyzed
- **THEN** no module in the MCP package SHALL directly import `Kysely`, the database repository, or database connections

### Requirement: Dynamic metric catalogue
The `metric_key` parameter for MCP tools SHALL be an enum derived dynamically from the active metrics catalogue.

#### Scenario: Dynamic metric enum generation
- **WHEN** an MCP client requests `tools/list` against a database containing metrics
- **THEN** the `inputSchema` for tools accepting `metric_key` SHALL specify an `enum` listing exactly the active metric keys

#### Scenario: Describe dataset tool
- **WHEN** an MCP client invokes `describe_dataset`
- **THEN** the response SHALL list all monitored metrics with physical units, registered device IDs, temporal coverage bounds (earliest and latest timestamp), and sampling conventions

### Requirement: Output bounding and unit preservation
Telemetry time series data returned by `get_series` SHALL be strictly bounded to `MCP_MAX_POINTS_PER_CALL` (default 500) and SHALL always preserve physical units.

#### Scenario: Large time range downsampling
- **WHEN** `get_series` is requested for a time range whose native resolution would yield more than the point cap
- **THEN** the service SHALL automatically downsample the series to a larger bucket, return at most `MCP_MAX_POINTS_PER_CALL` points, state the effective bucket, and set `truncated: true`

#### Scenario: Telemetry gaps representation
- **WHEN** readings are missing for a bucket interval in `get_series`
- **THEN** missing values SHALL be represented as `null`, never as zero

### Requirement: Actionable error handling
Errors during tool execution SHALL be returned as MCP tool errors with informative, actionable explanations.

#### Scenario: Unknown metric key error
- **WHEN** a tool is called with an invalid `metric_key`
- **THEN** the response SHALL have `isError: true` and the text SHALL list valid metric keys

#### Scenario: Invalid timestamp format error
- **WHEN** a tool is called with a timestamp that lacks timezone information or does not end with `Z`
- **THEN** the response SHALL have `isError: true` explaining that ISO-8601 UTC with `Z` is required

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
