## ADDED Requirements

### Requirement: Ingest database via multipart upload
The API SHALL provide an endpoint `POST /api/database/import` that accepts a multipart SQLite database file (`.db`, `.sqlite`, `.sqlite3`), triggers in-process validation and ETL transformation, updates active database connections, and returns an import summary report.

#### Scenario: Successful database upload and ingestion
- **WHEN** a client performs a `POST` request to `/api/database/import` with a valid SQLite database file
- **THEN** the API SHALL save the file to `data/migrations/source.db`, execute the ETL pipeline, refresh its read-only database connection, and return an HTTP 200 response containing `is_demo: false`, `readings_processed`, `measurements_inserted`, `catalog_entries`, `devices_count`, and `imported_at`

#### Scenario: Rejecting non-database or malformed file uploads
- **WHEN** a client uploads an invalid file or a database missing required tables (`readings`, `sensor_capabilities`)
- **THEN** the API SHALL reject the request with an HTTP 400 response and descriptive validation error message without altering the existing derived database

#### Scenario: Rejecting invalid file extensions
- **WHEN** a client uploads a file without a permitted SQLite extension (`.db`, `.sqlite`, `.sqlite3`)
- **THEN** the API SHALL reject the upload with an HTTP 400 Bad Request error
