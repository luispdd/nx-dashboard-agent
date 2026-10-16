# api-metrics-devices Specification

## Purpose

Provides read-only metadata endpoints for retrieving configured metrics, standard units, and known IoT device identifiers from the derived database.

## Requirements

### Requirement: Retrieve metric catalogue
The API SHALL provide an endpoint `GET /api/metrics` that returns all available metric keys and their corresponding physical units from the metrics catalogue.

#### Scenario: Successful metrics retrieval
- **WHEN** a client performs a `GET` request to `/api/metrics`
- **THEN** the API SHALL return an HTTP 200 response with a JSON array containing every declared metric object with `metric_key` and `unit` (e.g. `temperature` in `°C`, `humidity` in `%`)

#### Scenario: Metrics response structure integrity
- **WHEN** the metrics list is returned
- **THEN** each entry MUST contain non-empty string values for `metric_key` and `unit`, with no duplicate metric keys

### Requirement: Retrieve known devices
The API SHALL provide an endpoint `GET /api/devices` that returns the distinct list of all known device identifiers present in the measurements database.

#### Scenario: Successful device list retrieval
- **WHEN** a client performs a `GET` request to `/api/devices`
- **THEN** the API SHALL return an HTTP 200 response containing a JSON array of device ID strings (e.g. `["esp32c6", "esp32node1", "esp32s3"]`)

#### Scenario: Sorted and unique device identifiers
- **WHEN** multiple readings exist for the same device
- **THEN** the returned devices array SHALL contain distinct identifiers sorted in ascending lexicographical order

### Requirement: Read-only database access
The API service SHALL connect to the derived SQLite database strictly in read-only mode, guaranteeing that data cannot be modified, deleted, or corrupted via API operations.

#### Scenario: Enforcing read-only persistence
- **WHEN** any database operation executes within the API service
- **THEN** the connection SHALL operate in read-only mode and reject any mutating SQL statements

### Requirement: Retrieve database status and provenance
The API SHALL provide an endpoint `GET /api/database/status` that returns the provenance status of the active derived database, including whether it is demo data, total reading count, total device count, and the last imported timestamp.

#### Scenario: Successful database status retrieval for demo data
- **WHEN** a client performs a `GET` request to `/api/database/status` against a database generated from synthetic seed data
- **THEN** the API SHALL return an HTTP 200 response with JSON fields `is_demo: true`, `reading_count: <number>`, `device_count: <number>`, and `last_imported_at: <ISO-8601 string or null>`

#### Scenario: Successful database status retrieval for imported data
- **WHEN** a client performs a `GET` request to `/api/database/status` against a database imported from authentic source telemetry
- **THEN** the API SHALL return an HTTP 200 response with JSON fields `is_demo: false`, `reading_count: <number>`, `device_count: <number>`, and `last_imported_at: <ISO-8601 string>`

