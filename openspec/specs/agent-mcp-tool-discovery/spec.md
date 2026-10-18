# agent-mcp-tool-discovery Specification

## Purpose

Discovers telemetry and orientation tools dynamically at runtime from configured Model Context Protocol (MCP) servers and routes tool calls transparently without hardcoding data tool names in the agent service.

## Requirements

### Requirement: Runtime MCP tool discovery and caching
The agent service SHALL discover data tools dynamically from configured MCP servers at startup and refresh the cached catalogue when the cache exceeds `MCP_TOOL_LIST_TTL_SECONDS`.

#### Scenario: Discovered tools offered to model
- **WHEN** an MCP server exposes tools at the configured `MCP_SERVER_URLS`
- **THEN** every discovered tool SHALL be converted to an OpenAI function definition and offered to the model during chat completions

#### Scenario: Periodic TTL refresh
- **WHEN** a chat request arrives and the cached tool catalogue is older than `MCP_TOOL_LIST_TTL_SECONDS`
- **THEN** the agent service SHALL re-fetch the tool list from the MCP server before generating completion requests

### Requirement: Tool schema normalization
The agent service SHALL normalize discovered MCP input schemas to ensure compatibility with local OpenAI-compatible LLM runners.

#### Scenario: Schema cleaning
- **WHEN** an MCP tool schema contains JSON Schema metadata keywords such as `$schema`, `$id`, or `$defs`
- **THEN** the adapter SHALL strip these keywords and enforce `"type": "object"` and `"additionalProperties": false`

### Requirement: Dynamic tool dispatch and bounded results
The agent service SHALL route tool calls by name to the owning MCP server, enforce per-call timeouts and result caps, and treat tool errors as model feedback.

#### Scenario: Result truncation
- **WHEN** an MCP tool returns content exceeding `TOOL_RESULT_MAX_CHARS` (default 8000)
- **THEN** the result SHALL be truncated with an explicit truncation notice and passed to the model

#### Scenario: Tool error returned as feedback
- **WHEN** an MCP tool returns `isError: true`
- **THEN** the error text SHALL be supplied back to the model as tool output data to enable self-correction rather than crashing the chat session

### Requirement: Core contract verification and anomaly decoupling
`detect_anomalies` SHALL remain a local Python tool that validates the core contract (`list_metrics` and `get_series`) at each discovery refresh and fetches raw data using windowed requests under the point cap.

#### Scenario: Core contract validation passes
- **WHEN** the discovered MCP tools include `list_metrics` and `get_series` conforming to `docs/contracts/mcp-core-contract.json`
- **THEN** `detect_anomalies` SHALL be enabled and offered to the model with metric enum choices derived from `list_metrics`

#### Scenario: Windowed series fetching
- **WHEN** `detect_anomalies` requests 30 days of data at native resolution
- **THEN** it SHALL request data in time-bounded chunks that do not exceed the server's point cap, reassemble the series, and compute statistical anomalies identically to the baseline

#### Scenario: Core contract deviation
- **WHEN** an MCP server lacks `get_series` or deviates from `mcp-core-contract.json`
- **THEN** `detect_anomalies` SHALL be disabled with a warning log, and the service SHALL continue running with the remaining tools

### Requirement: Collision detection and outage resilience
The tool registry SHALL prevent silent overrides and handle unreachable MCP servers gracefully.

#### Scenario: Tool name collision error
- **WHEN** an MCP tool shares the same name as a local tool or another server's tool
- **THEN** discovery SHALL raise a configuration error naming both conflicting sources

#### Scenario: Graceful MCP outage
- **WHEN** the MCP server is unreachable and no previous tool list is cached
- **THEN** the chat endpoint SHALL emit a well-formed SSE `error` event and cleanly terminate the stream
