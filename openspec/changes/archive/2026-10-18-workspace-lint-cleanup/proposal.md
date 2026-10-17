# Proposal: Workspace Lint and Code Formatting Cleanup

## Why

While all Nx lint targets currently pass, a full audit of workspace linters revealed 31 ESLint warnings, 18 unformatted Python files, and an ESLint configuration gap where root-level `eslint .` fails due to scanning auto-generated client contracts. Cleaning up these warnings eliminates latent code smell, ensures strict adherence to TypeScript and React hook best practices, and establishes consistent formatting across the monorepo without behavioral regressions.

## What Changes

- **Root ESLint Configuration**: Add `**/src/generated/**` and `libs/shared/contracts/src/generated/**` to global ignores in [eslint.config.mjs](file:///home/fuchik0ma/code/nx-dashboard-agent/eslint.config.mjs) so root-level lint commands do not flag generated OpenAPI artifacts.
- **Unused Variables Cleanup**: Remove unused imports (`HttpException`, `MEASUREMENTS_REPOSITORY`, `screen`) and prefix unused catch variables (such as `_err` in [etl.service.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/database/etl.service.ts)) across `dashboard-api` and `chat-mfe`.
- **Type Narrowing**: Replace arbitrary `any` annotations with `unknown` or concrete types in [http-exception.filter.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/common/http-exception.filter.ts), [request-logging.interceptor.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/common/request-logging.interceptor.ts), [use-chat-stream.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/chat-mfe/src/app/hooks/use-chat-stream.ts), and test fixtures.
- **React Hook Dependencies**: Explicitly handle or memoize dependencies in [apps/chat-mfe/src/app/app.tsx](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/chat-mfe/src/app/app.tsx) to satisfy `react-hooks/exhaustive-deps`.
- **E2E Non-Null Assertions**: Safely extract regex matches or use expect matchers in [e2e/specs/04-fullstack-agent-integration.spec.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/e2e/specs/04-fullstack-agent-integration.spec.ts) to eliminate `@typescript-eslint/no-non-null-assertion` warnings.
- **Python Code Formatting**: Apply `ruff format .` across [apps/agent-service](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/agent-service) so both `ruff check .` and `ruff format --check .` pass cleanly.

## Non-goals

- Do not alter runtime behavior, API endpoints, or database queries.
- Do not modify or hand-edit generated OpenAPI clients (per Rule 3 of AGENTS.md).
- Do not migrate Angular shell executor from `@nx/eslint:lint` to inferred targets in this change (leave Nx configuration migration to a dedicated workspace tooling update).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` is configured in `.openspec.yaml` since this is a pure code-quality and tooling hygiene change without requirement changes).

## Impact

- **Affected Code**: `apps/dashboard-api`, `apps/chat-mfe`, `apps/agent-service`, `e2e`, and root `eslint.config.mjs`.
- **APIs / Contracts**: No contract changes or OpenAPI schema drift.
- **Dependencies**: No dependency additions or removals.
- **ADR**: No architectural decision record needed.
