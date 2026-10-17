# agent-observability Specification

## Purpose

Makes agent runs observable through structured, correlated logs of LLM calls and tool executions across agent-service and dashboard-api.

## Requirements

### Requirement: Structured run logs
`agent-service` SHALL emit one JSON log record per LLM call and per tool call, each carrying a run id, step index, duration in milliseconds and outcome.

#### Scenario: Tool call logged
- **WHEN** the agent executes a tool
- **THEN** a record SHALL be logged with run id, step, tool name, duration, status (`ok` or `error`) and result size

#### Scenario: LLM call logged
- **WHEN** the agent completes an LLM call
- **THEN** a record SHALL be logged with run id, step, model, duration and finish reason

#### Scenario: Run summary
- **WHEN** a run ends, successfully or not
- **THEN** a summary record SHALL be logged with total duration, step count, tool-call count and final status

### Requirement: Cross-service correlation
Requests from `agent-service` to `dashboard-api` SHALL carry an `x-request-id` header derived from the run id, and `dashboard-api` SHALL include it in its request logs.

#### Scenario: Header propagated
- **WHEN** a tool calls the dashboard API during a run
- **THEN** the outgoing request SHALL include `x-request-id` and the API log entry SHALL contain the same value

### Requirement: Privacy-preserving defaults
By default, logs SHALL NOT contain prompt text, model output or tool result payloads. These SHALL be logged only when an explicit debug setting is enabled.

#### Scenario: Default logging
- **WHEN** a run completes with default settings
- **THEN** no user prompt text or tool payload SHALL appear in the logs

#### Scenario: Debug enabled
- **WHEN** the debug payload setting is enabled
- **THEN** prompts and tool arguments and results MAY be included in log records

### Requirement: Eval latency reporting
The evaluation runner SHALL report per-case latency and tool-call counts.

#### Scenario: Eval report
- **WHEN** an eval run completes
- **THEN** its output SHALL include latency and tool-call count for each case
