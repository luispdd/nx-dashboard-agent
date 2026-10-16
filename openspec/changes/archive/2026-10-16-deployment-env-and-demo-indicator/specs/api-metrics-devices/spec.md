## ADDED Requirements

### Requirement: Retrieve database status and provenance
The API SHALL provide an endpoint `GET /api/database/status` that returns the provenance status of the active derived database, including whether it is demo data, total reading count, total device count, and the last imported timestamp.

#### Scenario: Successful database status retrieval for demo data
- **WHEN** a client performs a `GET` request to `/api/database/status` against a database generated from synthetic seed data
- **THEN** the API SHALL return an HTTP 200 response with JSON fields `is_demo: true`, `reading_count: <number>`, `device_count: <number>`, and `last_imported_at: <ISO-8601 string or null>`

#### Scenario: Successful database status retrieval for imported data
- **WHEN** a client performs a `GET` request to `/api/database/status` against a database imported from authentic source telemetry
- **THEN** the API SHALL return an HTTP 200 response with JSON fields `is_demo: false`, `reading_count: <number>`, `device_count: <number>`, and `last_imported_at: <ISO-8601 string>`
