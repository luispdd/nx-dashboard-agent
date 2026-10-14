# workspace-bootstrap Specification

## Purpose

Provides a unified Nx monorepo structure, enforced architectural boundaries, and common testing infrastructure across all services.

## Requirements

### Requirement: Workspace project structure and boundaries
The workspace SHALL enforce strict architectural boundaries and dependency constraints across applications and shared libraries using lint tags.

#### Scenario: Enforcing module boundary tags
- **WHEN** a project attempts to import from an unauthorized scope or internal non-exported module
- **THEN** the linter SHALL fail with a module boundary violation

#### Scenario: Running affected tasks
- **WHEN** `bunx nx affected -t lint test build` is executed
- **THEN** only projects impacted by changes SHALL be evaluated and cached targets reused

### Requirement: Unified unit and E2E test runners
The workspace SHALL support Vitest for unit tests across TypeScript projects and Playwright for end-to-end tests across applications.

#### Scenario: Executing unit tests in non-watch mode
- **WHEN** unit tests are run via Nx
- **THEN** Vitest SHALL execute in non-interactive run mode without hanging CI or batch processes

#### Scenario: Executing E2E tests
- **WHEN** e2e target is triggered for an application
- **THEN** Playwright SHALL execute browser-based validations and generate test reports
