# data-migration-inbox-and-etl Specification

## Purpose

Provides a secure migration inbox for source SQLite databases and an idempotent ETL pipeline that normalizes timestamps, maps sampling types, validates metrics, and atomically builds the derived database.

## Requirements

### Requirement: Migration inbox directory structure and security
The system SHALL provide a dedicated `data/migrations/` directory for uploading or placing source database snapshots, and SHALL prevent raw database files in this folder from being committed to source control.

#### Scenario: Dropping source database into migration inbox
- **WHEN** a source database file `source.db` is placed into `data/migrations/`
- **THEN** the migration inbox SHALL accept the file without triggering Git tracking of `.db` or `.sqlite` files

### Requirement: Source database snapshot and read-only access
The ETL process SHALL access the source database in read-only mode or create a consistent snapshot using the SQLite backup API without writing to the source database.

#### Scenario: Safe ingestion of source database
- **WHEN** the ETL process initiates against `data/migrations/source.db`
- **THEN** the ETL process SHALL not alter, lock indefinitely, or modify the source database file

### Requirement: Timestamp validation and normalization
The ETL pipeline SHALL validate that source timestamps follow ISO-8601 UTC representation (`YYYY-MM-DDTHH:MM:SS`) and normalize them to explicit ISO-8601 UTC format with a `Z` suffix (`YYYY-MM-DDTHH:MM:SSZ`).

#### Scenario: Normalizing valid naive UTC timestamp
- **WHEN** a reading timestamp `2026-10-05T08:36:23` is processed
- **THEN** the ETL SHALL store the timestamp as `2026-10-05T08:36:23Z` in the derived `measurements` table

#### Scenario: Rejecting invalid timestamp format
- **WHEN** a reading contains an unparseable or malformed timestamp string
- **THEN** the ETL SHALL abort execution with a descriptive validation error

### Requirement: JSON metrics flattening and sampling classification
The ETL process SHALL flatten nested JSON metrics from `readings.metrics` into individual measurement rows and map the `is_fine_tuned` column into a discrete `sampling` type.

#### Scenario: Mapping scheduled regular readings
- **WHEN** a reading with `is_fine_tuned = 0` (or `false`) is ingested
- **THEN** each metric in `readings.metrics` SHALL produce a row in `measurements` with `sampling = 'scheduled'`

#### Scenario: Mapping on-demand manual readings
- **WHEN** a reading with `is_fine_tuned = 1` (or `true`) is ingested
- **THEN** each metric in `readings.metrics` SHALL produce a row in `measurements` with `sampling = 'on_demand'`

### Requirement: Catalog consistency and uniform metric unit validation
The ETL process SHALL build a `metrics_catalog` and validate that every metric key in `readings` is declared in `sensor_capabilities` with a uniform measurement unit across all devices.

#### Scenario: Successful catalog construction
- **WHEN** all sensor capabilities declare consistent units for each metric key (e.g. `temperature` in `°C`, `humidity` in `%`)
- **THEN** the ETL SHALL populate `metrics_catalog` with each `metric_key` and its unique `unit`

#### Scenario: Detecting conflicting units across devices
- **WHEN** two devices report the same `metric_key` with different units
- **THEN** the ETL SHALL fail loudly and halt database generation with a conflict report

### Requirement: Atomic swap and derived database indexing
The ETL pipeline SHALL create composite indexes on `measurements(device_id, metric_key, ts)` and perform an atomic swap so readers always see a complete derived database.

#### Scenario: Atomic delivery of derived database
- **WHEN** the ETL pipeline completes all transformations and validations successfully
- **THEN** the output database SHALL be atomically swapped into `data/derived/measurements.db` with query indexes intact

### Requirement: Dataset provenance metadata and demo tracking
The ETL pipeline and synthetic seed generator SHALL maintain an `etl_metadata` table in the derived database storing dataset provenance attributes, including a boolean `is_demo` flag, creation timestamp, reading count, and device count.

#### Scenario: Marking synthetic demo database
- **WHEN** the synthetic seed generator produces a dataset and the ETL processes it
- **THEN** the derived database SHALL include an `etl_metadata` record with key `is_demo` set to `'true'`

#### Scenario: Marking authentic imported database
- **WHEN** a real source database is processed by the ETL pipeline
- **THEN** the derived database SHALL include an `etl_metadata` record with key `is_demo` set to `'false'` and record keys for `imported_at`, `reading_count`, and `device_count`

