# synthetic-seed-generator Specification

## Purpose

Generates realistic synthetic source SQLite databases containing multi-node environmental sensor readings and injected anomalies for tests and demonstrations without private data.

## Requirements

### Requirement: Synthetic source schema compatibility
The synthetic seed generator SHALL produce a valid SQLite database that matches the schema of the real IoT source system (`nodes`, `sensor_capabilities`, `readings`, `sync_state`).

#### Scenario: Generating compatible tables
- **WHEN** the seed generator script executes
- **THEN** the target SQLite database SHALL contain `nodes`, `sensor_capabilities`, `readings`, and `sync_state` with identical primary and unique keys

### Requirement: Cadence and realistic time-series generation
The seed generator SHALL generate regular readings at approximately 5-minute intervals per device with realistic diurnal variations and occasional on-demand readings (`is_fine_tuned = 1`).

#### Scenario: Populating scheduled readings
- **WHEN** a date range is specified (e.g. past 7 days)
- **THEN** the generator SHALL create continuous series of regular readings with realistic fluctuations for each configured device

#### Scenario: Interleaving on-demand readings
- **WHEN** generating reading batches
- **THEN** occasional readings SHALL have `is_fine_tuned = 1` representing manual user triggers

### Requirement: Injected deterministic anomalies
The seed generator SHALL support injecting known anomalies (peer deviation, spike, flatline, reading gap) to provide a ground truth for anomaly detection evaluation.

#### Scenario: Generating peer deviation anomaly
- **WHEN** anomaly generation is enabled for a specified node
- **THEN** that node SHALL produce readings systematically shifted from the peer median for a defined time window

#### Scenario: Generating flatline sensor failure
- **WHEN** flatline anomaly is triggered
- **THEN** the affected sensor metric SHALL output identical values with zero variance over consecutive intervals

### Requirement: Seed generation destination in migration inbox
The seed generator SHALL support writing directly to `data/migrations/source.db` or an arbitrary target path.

#### Scenario: Default destination in migration inbox
- **WHEN** the generator runs with default options
- **THEN** the synthetic database SHALL be placed at `data/migrations/source.db` ready for the ETL pipeline
