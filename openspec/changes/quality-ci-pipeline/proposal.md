## Why

There is no CI. Lint, typecheck, tests, builds, generated-contract freshness and E2E only run when a developer remembers to. M8 requires a pipeline so a published repo is demonstrably healthy.

## What Changes

- Add GitHub Actions workflows for `luispdd/nx-dashboard-agent`.
- PR/push pipeline: `nx affected -t lint test build` with Bun and uv dependency caching and Nx cache.
- Contract-drift job: export the OpenAPI spec, regenerate clients, fail if the working tree changes.
- E2E job: run the unified Playwright suite against the full stack using the stub OpenAI-compatible LLM (from `quality-test-strategy`); upload the HTML report as an artifact.
- Docker smoke job on `main`: build all images and verify the stack becomes healthy.
- Agent evals stay a manual (`workflow_dispatch`) job because they need a real LLM.
- Status badge in README is handled by `docs-showcase`.

## Capabilities

### New Capabilities
- `ci-pipeline`: Automated verification of lint, tests, builds, contract freshness, E2E and container health on GitHub.

### Modified Capabilities

## Impact

- New `.github/workflows/*.yml`.
- May require small Nx/target tweaks so jobs run non-interactively.
- Depends on the stub LLM from `quality-test-strategy` for the E2E job (that job can land disabled until the stub exists).
