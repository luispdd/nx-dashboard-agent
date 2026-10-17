# Continuous Integration & Automation

This document outlines the GitHub Actions workflow pipeline configured for `luispdd/nx-dashboard-agent`.

## Workflow Architecture

The repository uses automated GitHub Actions workflows split by purpose to ensure fast developer feedback, deterministic pull request checks, contract freshness, end-to-end verification, and container health.

| Workflow | File | Trigger | Purpose |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | Pull request & push to `main` | Runs `nx affected -t lint test build` and verifies contract drift freshness. |
| **E2E** | `.github/workflows/e2e.yml` | Pull request & push to `main` | Executes Playwright end-to-end tests against the live stack with the deterministic LLM stub. |
| **Docker Smoke** | `.github/workflows/docker.yml` | Push to `main` & manual dispatch | Builds multi-container images, brings up stack with `--wait`, verifies health checks, and tears down. |
| **Agent Evals** | `.github/workflows/evals.yml` | Manual dispatch only (`workflow_dispatch`) | Runs the agent evaluation benchmark suite against a real or remote LLM endpoint. |

---

## 1. Core CI (`ci.yml`)

The CI workflow contains two parallel jobs:

### Affected Verification (`affected`)
- **Checkout & Git SHAs**: Uses `actions/checkout@v4` with `fetch-depth: 0` and `nrwl/nx-set-shas@v4` to calculate base and head commits.
- **Runtimes & Tooling**: Configures Node.js (v22), Bun (`oven-sh/setup-bun@v2`), and uv (`astral-sh/setup-uv@v5` with Python 3.13).
- **Caching**: Restores Bun dependency cache (`~/.bun/install/cache`), uv wheel cache, and local Nx computational cache (`.nx/cache`).
- **Dependency Installation**: Runs `bun install --frozen-lockfile` and `uv sync` in `apps/agent-service`.
- **Target Execution**: Runs `nx affected -t lint test build`. If a PR only changes one project, only that project and its dependents are tested, linted, and built.

### Contract Drift Detection (`contract-drift`)
- Automatically regenerates the OpenAPI schema from the NestJS controllers (`nx run dashboard-api:export-openapi`) and the Angular resource services (`nx run shared-contracts:generate-contracts`).
- Runs `git diff --exit-code` against the working tree. If any API endpoint or DTO changed without the generated contracts being committed, the job fails immediately.

---

## 2. End-to-End Suite (`e2e.yml`)

- **Deterministic Execution**: Uses the mock OpenAI-compatible server in `e2e/fixtures/llm-stub` (`E2E_LLM_MODE=stub`, port 8890).
- **Stack Lifecycle**: Playwright's `webServer` orchestration automatically starts the LLM stub, `dashboard-api`, `agent-service`, `chat-mfe`, and `dashboard-shell`.
- **Browser Automation**: Installs Chromium and system dependencies via `bunx playwright install --with-deps chromium`.
- **Report Artifacts**: Uploads `playwright-report/` via `actions/upload-artifact@v4` with `if: always()`, ensuring failure traces and test results are inspectable on GitHub.
- **Gating**: Gated behind verification of `e2e/fixtures/llm-stub/main.ts` presence.

---

## 3. Docker Smoke Test (`docker.yml`)

- Runs on merges to `main` and on-demand via `workflow_dispatch`.
- Prepares environment variables from `.env.example`.
- Builds all three production container images (`Dockerfile.api`, `Dockerfile.agent`, `Dockerfile.web`).
- Starts the stack using `docker compose up -d --wait --wait-timeout 120`, verifying all defined service health checks turn healthy.
- Inspects container status with `docker compose ps` and logs on failure.
- Tears down the containers and associated volumes (`docker compose down -v`).

---

## 4. Agent Evals (`evals.yml`)

- **Manual Trigger Only**: Configured with `workflow_dispatch` exclusively; it does not trigger on pull requests or code pushes.
- **Configurable Endpoint**: Accepts optional inputs for `llm_base_url` and `llm_model`, falling back to repository secrets/variables (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`).
- **Runner**: Executes `uv run python -m agent_service.evals.runner` inside `apps/agent-service` and outputs benchmark accuracy metrics.

---

## Required Secrets and Variables

For standard pull requests and CI, **no secrets or external API keys are required**. All CI and E2E checks run completely offline and deterministically.

For the manual Agent Evals workflow (`evals.yml`), the following repository secrets or variables may optionally be set:

| Name | Type | Description |
| --- | --- | --- |
| `LLM_BASE_URL` | Variable / Secret | OpenAI-compatible endpoint URL (e.g. `http://host:8888/v1` or remote endpoint). |
| `LLM_MODEL` | Variable / Secret | Model identifier (e.g. `unsloth/Qwen3.5-4B-GGUF`). |
| `LLM_API_KEY` | Secret | Optional API key if calling an authenticated cloud provider. |
