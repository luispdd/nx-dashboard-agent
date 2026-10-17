## ADDED Requirements

### Requirement: Database Ingestion Interface in Settings
The settings view (`/settings`) SHALL provide a database ingestion card positioned alongside the LLM runtime configuration that allows users to inspect active database status, select a SQLite database file, and execute in-process ETL ingestion.

#### Scenario: Viewing active database status in ingestion card
- **WHEN** a user navigates to `/settings`
- **THEN** the view SHALL render an ingestion card to the right of the LLM settings displaying the current database provenance badge ("Demo Data" vs. "Live Data"), record counts, and last imported timestamp

#### Scenario: Selecting a database file
- **WHEN** a user selects or drops a valid `.db`, `.sqlite`, or `.sqlite3` file
- **THEN** the ingestion card SHALL display the file name and file size, and enable the "Upload & Run ETL" action button

#### Scenario: Executing database upload and displaying progress
- **WHEN** a user clicks "Upload & Run ETL" with a selected file
- **THEN** the card SHALL disable inputs, display an active progress spinner, and transmit the file to `/api/database/import`

#### Scenario: Displaying migration success summary
- **WHEN** the upload and ETL ingestion succeeds
- **THEN** the card SHALL display a success report showing processed readings, inserted measurements, discovered devices, and refresh the global database status and metric capabilities

#### Scenario: Displaying validation error message
- **WHEN** the upload or ETL ingestion fails due to validation errors or connection failures
- **THEN** the card SHALL display a distinct error alert detailing the failure message while preserving the user's view state
