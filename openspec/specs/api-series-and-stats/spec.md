# api-series-and-stats Specification

## Purpose

Provides high-performance time-series downsampling, multi-device groupings, and statistical summary aggregations over environmental measurements.

## Requirements

### Requirement: Query downsampled time-series measurements
The API SHALL provide an endpoint `GET /api/series` that returns time-series data downsampled into discrete time buckets for one or more devices.

#### Scenario: Querying time series with default bucketing
- **WHEN** a client requests `GET /api/series?metric=temperature`
- **THEN** the API SHALL return an HTTP 200 response with `metric`, `unit`, `bucket`, and a `series` array containing each device's sparse points `{ ts, value }`

#### Scenario: Filtering by multiple devices
- **WHEN** a client provides `devices=esp32c6,esp32s3` in the query string
- **THEN** the API SHALL return series data strictly for the specified devices

#### Scenario: Server-side downsampling across custom intervals
- **WHEN** a client requests `bucket=1h` over a designated `from` and `to` window
- **THEN** the API SHALL aggregate measurements within 1-hour intervals, computing the arithmetic mean value for each bucket and aligning bucket timestamps to UTC with a `Z` suffix

#### Scenario: Sparse gap-preserving response
- **WHEN** a sensor experiences an outage and produces no measurements during a time window
- **THEN** the API SHALL omit empty buckets rather than inserting synthetic zero or interpolated values

#### Scenario: Scheduled vs on-demand sampling filtering
- **WHEN** `include_on_demand` is false or omitted
- **THEN** the API SHALL exclude `on_demand` manual readings and aggregate regular `scheduled` readings only

#### Scenario: Including on-demand readings explicitly
- **WHEN** `include_on_demand=true` is specified
- **THEN** the API SHALL include both `scheduled` and `on_demand` readings in the aggregated output

#### Scenario: Rejecting invalid or unknown metric key
- **WHEN** a client requests `/api/series?metric=nonexistent_metric`
- **THEN** the API SHALL return an HTTP 400 Bad Request error indicating the metric is invalid

#### Scenario: Rejecting zone-less or malformed timestamps
- **WHEN** a client provides a `from` or `to` parameter lacking UTC `Z` format (e.g. `2026-10-05T08:00:00`)
- **THEN** the API SHALL return an HTTP 400 Bad Request error

### Requirement: Statistical summaries calculation
The API SHALL provide an endpoint `GET /api/stats` that computes descriptive statistics for a specified metric across one or more devices over a time window.

#### Scenario: Computing statistical metrics
- **WHEN** a client requests `GET /api/stats?metric=temperature&from=2026-10-05T00:00:00Z&to=2026-10-06T00:00:00Z`
- **THEN** the API SHALL return an HTTP 200 response containing per-device statistical summaries including `device_id`, `metric`, `unit`, `min`, `max`, `mean`, `std`, `count`, and `missing_ratio`

#### Scenario: Statistical standard deviation precision
- **WHEN** sample readings are aggregated
- **THEN** `std` SHALL represent the sample standard deviation calculated deterministically from the underlying measurements

#### Scenario: Safe handling of devices with zero readings
- **WHEN** a device has no readings in the requested time window
- **THEN** the API SHALL return `count: 0`, `missing_ratio: 1.0`, and `null` values for `min`, `max`, `mean`, and `std` without error
