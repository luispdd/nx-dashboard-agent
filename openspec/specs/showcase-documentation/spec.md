# showcase-documentation Specification

## Purpose

Defines the architectural decision records and documentation standards that let contributors understand the architecture, design decisions, and trade-offs.

## Requirements

### Requirement: Consistent ADR set
`docs/adr/` SHALL contain one file per decision using the `ADR-NNN-<slug>.md` naming, with no duplicate numbers, an index in `docs/adr/README.md`, and SHALL include a decision on avoiding full microservices as well as backfill ADRs for closed architecture decisions.

#### Scenario: No duplicates
- **WHEN** the ADR directory is listed
- **THEN** each ADR number SHALL appear exactly once

#### Scenario: Microservices decision recorded
- **WHEN** a reader looks for why only two backend services exist
- **THEN** an ADR SHALL explain the decision and its trade-offs

#### Scenario: ADR index
- **WHEN** a reader accesses `docs/adr/README.md`
- **THEN** it SHALL provide an index table of all ADRs with links, statuses, and scopes
