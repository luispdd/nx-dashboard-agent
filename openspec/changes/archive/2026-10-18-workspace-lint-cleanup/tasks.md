## 1. ESLint Root Configuration

- [x] 1.1 Add `"libs/shared/contracts/src/generated/**"` and `"**/src/generated/**"` to root `eslint.config.mjs` ignores and verify that running `bunx eslint libs/shared/contracts/` reports 0 errors and 0 warnings

## 2. Dashboard API Warnings Cleanup

- [x] 2.1 Remove unused imports and prefix unused variables (`HttpException` in `http-exception.filter.spec.ts`, `_err` in `etl.service.ts`, `MEASUREMENTS_REPOSITORY` in `stats.service.spec.ts`) and verify with `nx lint dashboard-api`
- [x] 2.2 Replace explicit `any` usages with `unknown` or typed structures in `http-exception.filter.ts`, `request-logging.interceptor.ts`, `app.controller.ts`, `main.ts`, and spec files
- [x] 2.3 Verify `nx lint dashboard-api` completes with 0 errors and 0 warnings

## 3. Chat MFE Warnings Cleanup

- [x] 3.1 Remove unused `screen` import in `markdown-content.spec.tsx`
- [x] 3.2 Refactor `useEffect` dependencies or memoize `mountOptions` in `apps/chat-mfe/src/app/app.tsx` to resolve `react-hooks/exhaustive-deps`
- [x] 3.3 Narrow `any` types in `use-chat-stream.ts` to `unknown` / structured types
- [x] 3.4 Verify `nx lint chat-mfe` completes with 0 errors and 0 warnings

## 4. E2E Test Warnings Cleanup

- [x] 4.1 Replace non-null assertions (`!`) on regex match captures in `e2e/specs/04-fullstack-agent-integration.spec.ts` with safe assertions or helper extraction
- [x] 4.2 Verify `nx lint e2e` completes with 0 errors and 0 warnings

## 5. Python Code Formatting

- [x] 5.1 Format Python files across `apps/agent-service` by running `uv run ruff format .`
- [x] 5.2 Verify `uv run ruff check .` and `uv run ruff format --check .` both pass cleanly with 0 errors

## 6. Verification & Regression Check

- [x] 6.1 Run full workspace lint check `nx run-many -t lint --skip-nx-cache` and verify all 7 projects pass with 0 errors and 0 warnings
- [x] 6.2 Run `nx run-many -t test` and verify unit tests pass across all projects
- [x] 6.3 Run `nx run-many -t build` and verify all builds succeed
