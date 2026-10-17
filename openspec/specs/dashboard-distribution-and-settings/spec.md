# dashboard-distribution-and-settings Specification

## Purpose

Provides secondary dashboard views for inspecting measurement volume distribution across IoT boards and managing local LLM runtime connection settings.

## Requirements

### Requirement: Device Measurement Volume Distribution
The distribution view (`/distribution`) SHALL display an interactive chart breaking down total measurement volume and reading frequency across discovered IoT devices.

#### Scenario: Visualizing device measurement shares
- **WHEN** a user navigates to `/distribution`
- **THEN** the view SHALL render an ApexCharts donut or bar chart illustrating the relative proportion and raw count of measurements contributed by each active board

#### Scenario: Device comparison insights
- **WHEN** device counts are uneven or one board exhibits reduced reporting frequency
- **THEN** the view SHALL visually reflect the discrepancy to aid in identifying offline or reporting-deficient devices

### Requirement: LLM Runtime Configuration Management
The settings view (`/settings`) SHALL allow users to view, validate, and update runtime connection parameters for the backend LLM service.

#### Scenario: Reviewing existing runtime configuration
- **WHEN** a user navigates to `/settings`
- **THEN** the view SHALL display input fields for LLM Base URL, Model Name, and API Key (masked by default)

#### Scenario: Updating connection parameters
- **WHEN** a user modifies configuration values and submits the form
- **THEN** the application SHALL persist the updated parameters and confirm the save operation to the user

### Requirement: Database Ingestion Interface in Settings
The settings view (`/settings`) SHALL provide a database ingestion card positioned alongside the LLM runtime configuration that allows users to inspect active database status, select a SQLite database file, and execute in-process ETL ingestion.

#### Scenario: Viewing active database status in ingestion card
- **WHEN** a user navigates to `/settings`
- **THEN** the view SHALL render an ingestion card to the right of the LLM settings displaying the current database provenance badge ("Demo Data" vs. "Imported Telemetry"), record counts, and last imported timestamp

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

