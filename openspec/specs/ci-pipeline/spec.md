# ci-pipeline Specification

## Purpose

Defines the automated GitHub verification that keeps the repository's lint, tests, builds, contracts, end-to-end flows and containers healthy on every change.

## Requirements

### Requirement: Affected-only verification on changes
The pipeline SHALL run lint, test and build for affected projects on every pull request and push to `main`, reusing dependency and Nx caches. Workflows SHALL run natively on Node.js 24 using modern GitHub Actions versions (`v5+`) without runtime deprecation warnings.

#### Scenario: Pull request touching one project
- **WHEN** a pull request changes only one project
- **THEN** only that project and its dependents SHALL be linted, tested and built

#### Scenario: Failing check blocks
- **WHEN** any lint, test or build target fails
- **THEN** the workflow SHALL fail

#### Scenario: Deprecation-free action execution
- **WHEN** workflows execute on GitHub Actions runners
- **THEN** core actions (`checkout`, `setup-node`, `cache`, `upload-artifact`) SHALL execute on Node.js 24 without runtime deprecation warnings

### Requirement: Contract drift detection
The pipeline SHALL regenerate the OpenAPI export and generated clients and fail if the result differs from the committed files.

#### Scenario: Stale generated client
- **WHEN** the API contract changed but generated clients were not regenerated
- **THEN** the contract job SHALL fail and report the differing files

### Requirement: End-to-end run against stub LLM
The pipeline SHALL run the unified Playwright suite against the full stack using the stub OpenAI-compatible LLM and publish the report as an artifact.

#### Scenario: E2E report available
- **WHEN** the E2E job finishes, whether passing or failing
- **THEN** the Playwright HTML report SHALL be uploaded as a workflow artifact

#### Scenario: Synthetic fixture availability in CI
- **WHEN** the E2E suite runs in CI
- **THEN** tracked SQLite fixtures under `e2e/fixtures/` SHALL be present on the runner for database upload tests

### Requirement: Container smoke test
On `main`, the pipeline SHALL build all service images and verify the composed stack reports healthy.

#### Scenario: Stack becomes healthy
- **WHEN** the compose stack is started in CI
- **THEN** all health checks SHALL pass within a bounded timeout or the job SHALL fail

#### Scenario: Container host volume permissions in CI
- **WHEN** the container stack starts on a Linux CI runner
- **THEN** runner UID/GID and write permissions for mounted `./data/` directories SHALL be established so services self-bootstrapping synthetic databases succeed without permission errors

### Requirement: Evals are manual
Agent evaluations SHALL be triggerable manually and SHALL NOT run on pull requests.

#### Scenario: Manual dispatch
- **WHEN** a maintainer dispatches the eval workflow
- **THEN** it SHALL run against the LLM endpoint configured by repository secrets or variables
