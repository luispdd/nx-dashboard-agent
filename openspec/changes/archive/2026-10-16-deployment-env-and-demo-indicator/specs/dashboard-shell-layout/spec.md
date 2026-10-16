## ADDED Requirements

### Requirement: Demo data notification badge
The dashboard shell navigation header SHALL display a visible "Demo Data" announcement badge when connected to an API serving synthetic demo measurements, and omit or hide the badge when connected to authentic imported telemetry.

#### Scenario: Displaying demo badge for synthetic data
- **WHEN** the dashboard shell initializes and `GET /api/database/status` indicates `is_demo: true`
- **THEN** the header toolbar SHALL render an amber "Demo Data" badge with an active pulse indicator and a tooltip or text explaining that the active data is synthetic

#### Scenario: Hiding demo badge for authentic data
- **WHEN** the dashboard shell initializes and `GET /api/database/status` indicates `is_demo: false`
- **THEN** the header toolbar SHALL not render the "Demo Data" warning badge
