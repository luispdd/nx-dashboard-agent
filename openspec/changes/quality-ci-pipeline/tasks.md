## 1. Core CI workflow

- [ ] 1.1 Add `.github/workflows/ci.yml` with checkout (`fetch-depth: 0`), Bun, uv, Node setup, caches and `nrwl/nx-set-shas`; verify the workflow is accepted by GitHub (push to a branch, run succeeds)
- [ ] 1.2 Run `nx affected -t lint test build` in the workflow; verify a PR touching one project only runs that project and dependents
- [ ] 1.3 Ensure python targets (`agent-service` lint/test) work from CI via `uv sync`; verify they pass on the runner

## 2. Contract drift job

- [ ] 2.1 Add a job running `nx run dashboard-api:export-openapi` and `nx run shared-contracts:generate-contracts` then `git diff --exit-code`; verify it passes on a clean tree
- [ ] 2.2 Verify it fails when a contract change is made without regenerating (test on a throwaway branch)

## 3. E2E workflow

- [ ] 3.1 Add `.github/workflows/e2e.yml` starting the stub LLM and the stack, setting `LLM_BASE_URL` to the stub, and running `bun run e2e`; gate behind `quality-test-strategy` stub availability
- [ ] 3.2 Upload `playwright-report/` as an artifact with `if: always()`; verify the artifact is present on a run

## 4. Docker smoke and evals

- [ ] 4.1 Add `.github/workflows/docker.yml` for `main`: build images, `docker compose up -d --wait`, check health, tear down; verify run succeeds
- [ ] 4.2 Add `.github/workflows/evals.yml` with `workflow_dispatch` only and endpoint configuration from variables/secrets; verify it does not trigger on PRs

## 5. Documentation and verification

- [ ] 5.1 Document the workflows and required settings in `docs/` (short section; badge is added by `docs-showcase`)
- [ ] 5.2 Run `openspec validate --all` and confirm it passes
