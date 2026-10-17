## Context

The workspace uses Nx with `bun`, a Python service managed by `uv`, Vitest for unit tests and one workspace-level Playwright suite in `e2e/`. Existing quirks that shape CI: `dashboard-api` contract tests need `nx run dashboard-api:export-openapi` first; generated contracts come from `nx run shared-contracts:generate-contracts`; Playwright must run with `workers: 1`; Nx loads `.env` into tasks. The repo is `luispdd/nx-dashboard-agent` on GitHub. See proposal.md.

## Goals / Non-Goals

**Goals:**
- Fast PR feedback via `nx affected`.
- Deterministic, secret-free CI (stub LLM).
- Visible health: workflows, report artifacts.

**Non-Goals:**
- Deployment/release automation, container registry publishing.
- Running real-LLM evals on PRs.

## Decisions

- **Workflows split by purpose**: `ci.yml` (affected lint/test/build + contract drift), `e2e.yml` (full stack with stub), `docker.yml` (smoke on `main`), `evals.yml` (`workflow_dispatch`). Alternative: one monolithic workflow. Rejected: separate jobs give clearer status and let slow jobs be scoped.
- **Nx affected base/head** via `nrwl/nx-set-shas`; `fetch-depth: 0`.
- **Tooling setup**: `oven-sh/setup-bun`, `astral-sh/setup-uv`, cache `~/.bun/install/cache`, uv cache and `.nx/cache`. Pin Node to the workspace version.
- **Contract drift job**: run `export-openapi`, `generate-contracts`, then `git diff --exit-code` over generated paths and committed spec files.
- **E2E**: start the stub LLM, set `LLM_BASE_URL` to it, bring up the stack (compose or `nx run-many -t serve`), run `bun run e2e`, upload `playwright-report/`. The compose route is preferred since it also validates images, but serve-mode is the fallback if CI time is excessive.
- **Docker smoke**: `bun run docker:build`, `docker compose up -d --wait`, then check health endpoints, `docker compose down -v`.
- **Secrets**: none required; evals read endpoint config from repository variables/secrets only when manually dispatched.
- Third-party actions are version-pinned (verify current major versions when implementing).

## Risks / Trade-offs

- [`better-sqlite3` native build slows or breaks on runner] -> use the official Linux runner image and cache; check Node ABI.
- [E2E flakiness from startup timing] -> explicit health waits, Playwright `webServer` with `reuseExistingServer: true` as in the workspace.
- [Docker job duration] -> only on `main` and path-filtered.
- [E2E depends on `quality-test-strategy` stub] -> land the job first as non-required or `if: false` until the stub exists, then enable.
- [Nx Cloud absence] -> local cache only; acceptable for this repo size.
