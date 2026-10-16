## ADDED Requirements

### Requirement: Dataset provenance metadata and demo tracking
The ETL pipeline and synthetic seed generator SHALL maintain an `etl_metadata` table in the derived database storing dataset provenance attributes, including a boolean `is_demo` flag, creation timestamp, reading count, and device count.

#### Scenario: Marking synthetic demo database
- **WHEN** the synthetic seed generator produces a dataset and the ETL processes it
- **THEN** the derived database SHALL include an `etl_metadata` record with key `is_demo` set to `'true'`

#### Scenario: Marking authentic imported database
- **WHEN** a real source database is processed by the ETL pipeline
- **THEN** the derived database SHALL include an `etl_metadata` record with key `is_demo` set to `'false'` and record keys for `imported_at`, `reading_count`, and `device_count`
