## MODIFIED Requirements

### Requirement: Query downsampled time-series measurements
The API SHALL provide an endpoint `GET /api/series` that returns time-series data downsampled into discrete time buckets for one or more devices, optionally limited to the most recent data points per device.

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

#### Scenario: Limiting series to latest N measurements per device
- **WHEN** a client provides `limit=50` in the query parameters
- **THEN** the API SHALL return at most the 50 most recent bucketed data points for each device, sorted in chronological order (ascending timestamp)

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

#### Scenario: Rejecting non-positive limit parameter
- **WHEN** a client provides `limit=0` or `limit=-5`
- **THEN** the API SHALL return an HTTP 400 Bad Request error indicating limit must be a positive integer
