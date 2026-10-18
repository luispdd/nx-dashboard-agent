# test-strategy Specification

## Purpose

Defines the testing layers, their responsibilities and the E2E LLM modes so the repository's tests are balanced, deterministic where required and runnable in CI.

## Requirements

### Requirement: Documented test layers
The repository SHALL document, for unit, contract and end-to-end tests, what each layer covers and what it must not cover.

#### Scenario: Strategy document exists
- **WHEN** a contributor looks for testing guidance
- **THEN** a strategy document under `docs/` SHALL describe each layer and when to add a test to it

### Requirement: E2E LLM mode selection
The E2E suite SHALL run in stub-LLM mode by default in CI and SHALL support a real-LLM mode that is opt-in via environment configuration.

#### Scenario: CI default
- **WHEN** the E2E suite runs in CI without overrides
- **THEN** the agent SHALL be configured to use the stub LLM endpoint

#### Scenario: Local real LLM
- **WHEN** a developer enables real-LLM mode
- **THEN** the suite SHALL use the configured `LLM_BASE_URL` and run with a single worker

### Requirement: Data-invariant E2E assertions
E2E tests SHALL NOT assert hardcoded record counts or exact measurement values.

#### Scenario: Structural assertions only
- **WHEN** an E2E test checks tables or charts
- **THEN** it SHALL assert structure and populated state rather than specific data values

### Requirement: E2E Test Fixtures Tracking
The repository SHALL track and version-control synthetic test fixtures (including sample SQLite databases) required by end-to-end test suites under `e2e/fixtures/` and exempt them from workspace-level database ignore rules.

#### Scenario: Tracking synthetic test databases
- **WHEN** an E2E test requires an input database fixture (e.g. Settings database upload)
- **THEN** the fixture file SHALL be committed under `e2e/fixtures/` with a gitignore exception (`!e2e/fixtures/*.sqlite`) rather than ignored or dynamically fetched
