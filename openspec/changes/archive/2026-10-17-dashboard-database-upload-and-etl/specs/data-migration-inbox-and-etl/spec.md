## ADDED Requirements

### Requirement: In-process API ETL execution on migration inbox upload
The dashboard API service SHALL provide an in-process TypeScript ETL pipeline that transforms source SQLite databases directly using `better-sqlite3` upon database upload or CLI invocation, fully decoupling data migration from the agent service.

#### Scenario: Running ETL pipeline on uploaded database
- **WHEN** an uploaded source database is placed into `data/migrations/source.db` by the API service
- **THEN** the in-process ETL pipeline SHALL validate schema integrity, enforce uniform metric units, normalize timestamps to ISO-8601 UTC with 'Z', map `is_fine_tuned` to `sampling`, build `measurements` and `etl_metadata` with `is_demo = 'false'`, and atomically swap the target derived database

#### Scenario: Preserving derived database on validation failure
- **WHEN** ETL validation fails during schema or timestamp checks on an uploaded database
- **THEN** the pipeline SHALL abort and leave the existing derived database file completely intact
