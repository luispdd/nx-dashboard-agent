# Technical Design: Workspace Lint and Code Formatting Cleanup

## Context

See [proposal.md](file:///home/fuchik0ma/code/nx-dashboard-agent/openspec/changes/workspace-lint-cleanup/proposal.md) for background and motivation.
The monorepo contains 7 Nx targets evaluated during CI lint checks. While `nx run-many -t lint` succeeds, 31 warnings are emitted across TypeScript projects, 18 Python files violate formatting standards, and root `eslint .` fails against generated OpenAPI clients.

## Goals / Non-Goals

**Goals:**
- Eliminate all 31 ESLint warnings across `dashboard-api`, `chat-mfe`, and `e2e`.
- Ensure root-level `eslint .` passes cleanly with 0 errors and 0 warnings by ignoring auto-generated client code.
- Format all Python files with `ruff format .` so `ruff format --check .` passes without errors.
- Maintain 100% test pass rate and zero runtime/API contract behavior changes.

**Non-Goals:**
- Modifying auto-generated client code in `libs/shared/contracts/src/generated/`.
- Changing API contracts or database schema.
- Re-architecting state or replacing existing libraries.

## Decisions

### 1. Global Ignore for Generated Code in Root ESLint Configuration
- **Decision**: Add `"libs/shared/contracts/src/generated/**"` and `"**/src/generated/**"` to the `ignores` block in the workspace root [eslint.config.mjs](file:///home/fuchik0ma/code/nx-dashboard-agent/eslint.config.mjs).
- **Rationale**: `libs/shared/contracts` contains generated TypeScript code managed by `@ng-openapi/http-resource`. Per Rule 3 of AGENTS.md, generated code must never be edited manually. While the library-level `eslint.config.mjs` already ignores this path, the root config must also ignore it so whole-repo linting runs cleanly.
- **Alternatives Considered**: Modifying ESLint rules to permit `@ts-nocheck` was rejected because it reduces linting strictness for handwritten codebase files.

### 2. Type Narrowing (`unknown` and Type Guards over `any`)
- **Decision**:
  - In [apps/dashboard-api/src/app/common/http-exception.filter.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/common/http-exception.filter.ts), type exception payloads as `unknown` and extract status/message using safe type checks.
  - In [apps/dashboard-api/src/app/common/request-logging.interceptor.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/common/request-logging.interceptor.ts), type stream observables with `Observable<unknown>`.
  - In [apps/chat-mfe/src/app/hooks/use-chat-stream.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/chat-mfe/src/app/hooks/use-chat-stream.ts), type SSE chunk payloads as `Record<string, unknown>` or `unknown`.
- **Rationale**: Replaces loose `any` with type-safe constructs without adding overhead or runtime changes.

### 3. Safe Pattern Extraction in E2E Tests
- **Decision**: In [e2e/specs/04-fullstack-agent-integration.spec.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/e2e/specs/04-fullstack-agent-integration.spec.ts), replace `match![1]` non-null assertions with an explicit test assertion `expect(match).toBeTruthy()` followed by safe indexing, or a helper function.
- **Rationale**: Complies with `@typescript-eslint/no-non-null-assertion` while keeping test failure messages informative if a regex fails to match.

### 4. Unused Variable Pruning and Prefixing
- **Decision**:
  - Remove unused imports (`HttpException`, `MEASUREMENTS_REPOSITORY`, `screen`).
  - Prefix unavoidable unused variables (e.g. catch error parameter in [etl.service.ts](file:///home/fuchik0ma/code/nx-dashboard-agent/apps/dashboard-api/src/app/database/etl.service.ts)) with an underscore (`_err`).
- **Rationale**: Cleans up warning noise while preserving necessary signature structures.

### 5. Automated Python Formatting via Ruff
- **Decision**: Run `uv run ruff format .` inside `apps/agent-service`.
- **Rationale**: Fixes formatting without altering AST or logic, aligning formatting check with `ruff check .`.

## Risks / Trade-offs

- **[Risk] Test assertion changes in E2E**: Changing regex extraction could affect test execution if an indexing assumption changes.
  - *Mitigation*: Run unit tests and E2E specs to verify assertions still accurately validate LLM responses.
- **[Risk] React hook dependency alteration**: Adding `mountOptions` or restructuring dependencies in `apps/chat-mfe/src/app/app.tsx` could cause re-triggering of effects.
  - *Mitigation*: Ensure stable object references or memoize `mountOptions` to prevent redundant mounts.
