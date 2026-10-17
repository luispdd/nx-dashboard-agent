## Purpose

Defines the documentation that lets a newcomer understand the architecture, run the stack quickly, and see the design decisions and trade-offs.

## ADDED Requirements

### Requirement: README quick start
The README SHALL include an architecture diagram, a quick start using `.env` and `docker compose up`, a CI status badge and links to the docs.

#### Scenario: Clean-clone run
- **WHEN** a developer follows only the README quick start on a clean clone
- **THEN** the full stack SHALL be running with demo data in under 10 minutes

### Requirement: Consistent ADR set
`docs/adr/` SHALL contain one file per decision using the `ADR-NNN-<slug>.md` naming, with no duplicate numbers, and SHALL include a decision on avoiding full microservices.

#### Scenario: No duplicates
- **WHEN** the ADR directory is listed
- **THEN** each ADR number SHALL appear exactly once

#### Scenario: Microservices decision recorded
- **WHEN** a reader looks for why only two backend services exist
- **THEN** an ADR SHALL explain the decision and its trade-offs

### Requirement: Talking points page
`docs/talking-points.md` SHALL describe key decisions, trade-offs and what was deliberately left out.

#### Scenario: Page exists and links
- **WHEN** the README is read
- **THEN** it SHALL link to `docs/talking-points.md`

### Requirement: Demo material
The repository SHALL include a demo script and a short recording or GIFs of the main flows.

#### Scenario: Demo script covers core flows
- **WHEN** the demo script is followed
- **THEN** it SHALL walk through the dashboard, filters, chat with tool steps and database upload
