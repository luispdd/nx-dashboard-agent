# agent-tools-catalogue Specification

## Purpose

Provides typed, schema-validated tools for the agent to query telemetry metrics, device lists, time-series, and summary statistics from the NestJS Dashboard API over HTTP.

## Requirements

### Requirement: Metric and Device Discovery Tools
The agent service SHALL expose `list_metrics` and `list_devices` tools discovered dynamically via the MCP server that retrieve active metrics with canonical units and registered device identifiers.

#### Scenario: Discover available metrics
- **WHEN** the agent invokes `list_metrics`
- **THEN** the system routes the call to the MCP server and returns the catalogue of available metric keys along with their measurement units

#### Scenario: Discover registered devices
- **WHEN** the agent invokes `list_devices`
- **THEN** the system routes the call to the MCP server and returns the list of registered board identity strings

### Requirement: Telemetry Statistics Query Tool
The agent service SHALL expose a `get_stats` tool via MCP for a specific device, metric, and time window, returning numerical summaries including min, max, mean, standard deviation, count, and missing ratio.

#### Scenario: Retrieve daily statistics for a device
- **WHEN** the agent invokes `get_stats` with `device_id="esp32c6"`, `metric_key="temperature"`, `from="2026-10-14T00:00:00Z"`, and `to="2026-10-14T23:59:59Z"`
- **THEN** the system calls the MCP tool and returns the aggregated statistics including mean and standard deviation with explicit units

#### Scenario: Handle empty readings window
- **WHEN** `get_stats` is invoked for a time window containing zero readings
- **THEN** the tool returns a response indicating zero count and null values for min, max, mean, and std without raising an unhandled error

### Requirement: Telemetry Series Query Tool
The agent service SHALL expose a `get_series` tool via MCP to fetch downsampled time-series points bounded by a maximum point limit.

#### Scenario: Fetch bounded time series
- **WHEN** the agent invokes `get_series` with a metric, device, bucket interval, and time window
- **THEN** the system queries the MCP tool, caps the returned data points to the requested limit, and returns timestamp-value pairs with truncation metadata if truncated

### Requirement: Multi-Device Comparison Tool
The agent service SHALL expose a `compare_devices` tool via MCP that returns comparative statistics across all devices for a given metric and time window.

#### Scenario: Compare metrics across peer devices
- **WHEN** the agent invokes `compare_devices` for `metric_key="temperature"` over a specified time window
- **THEN** the system returns a list of statistical summaries for each reporting device side-by-side

### Requirement: Strict Input Validation and Sampling Rules
All tool inputs SHALL be validated using Pydantic models forbidding unrecognized fields. All queries SHALL default to regular scheduled readings (`include_on_demand=false`) unless on-demand readings are explicitly requested.

#### Scenario: Reject invalid metric key
- **WHEN** a tool is called with a metric key not present in the known catalogue
- **THEN** parameter validation rejects the call and returns a descriptive error message indicating the accepted metric keys

#### Scenario: Enforce ISO UTC timestamps with Z
- **WHEN** a tool receives `from` or `to` parameters not formatted as ISO-8601 UTC strings ending with `Z`
- **THEN** validation fails with a clear format error requiring ISO-8601 UTC format
