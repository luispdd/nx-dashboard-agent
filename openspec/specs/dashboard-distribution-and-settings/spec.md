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
