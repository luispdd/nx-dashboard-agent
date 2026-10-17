## ADDED Requirements

### Requirement: Automatic startup seed generation and ETL bootstrap
The dashboard API service SHALL automatically verify the existence of the derived database upon application startup. If `data/derived/measurements.db` is missing, the API SHALL execute the synthetic seed generation to produce `data/migrations/source.db` (if missing) and execute the in-process ETL pipeline to generate a derived database with `is_demo = 'true'` before binding and accepting incoming HTTP requests.

#### Scenario: Startup bootstrap on empty derived database directory
- **WHEN** the dashboard API service starts and `data/derived/measurements.db` does not exist
- **THEN** the service SHALL generate demo seed data, run the ETL migration to produce `measurements.db` marked with `is_demo: 'true'`, and successfully initialize repository connections

#### Scenario: Startup bypass when derived database exists
- **WHEN** the dashboard API service starts and `data/derived/measurements.db` already exists
- **THEN** the service SHALL bypass seed generation and ETL migration, initializing directly against the existing database
