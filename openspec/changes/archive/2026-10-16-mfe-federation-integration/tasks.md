## 1. Resizable Drawer Implementation (Angular Shell)

- [x] 1.1 Implement drawer width signal, pointer event listeners (`pointerdown`, `pointermove`, `pointerup`), and clamping logic (`[360px, 50vw]`) in `apps/dashboard-shell/src/app/app.ts`, and verify typecheck passes with `nx typecheck dashboard-shell`
- [x] 1.2 Add resizable left border handle element with `cursor-col-resize` styling, responsive `w-full sm:w-[var(--drawer-width)]` binding, and text selection prevention during drag in `apps/dashboard-shell/src/app/app.html`, and verify styling compiles cleanly with `nx build dashboard-shell`
- [x] 1.3 Add localStorage persistence and window resize clamping for drawer width in `apps/dashboard-shell/src/app/app.ts`, and add unit tests in `apps/dashboard-shell/src/app/app.spec.ts` verifying width clamping and persistence, verifying with `nx test dashboard-shell`

## 2. Shell Wrapper Unit Tests & Resilience

- [x] 2.1 Add unit tests for `ChatWrapperComponent` in `apps/dashboard-shell/src/app/chat-wrapper/chat-wrapper.component.spec.ts` covering remote module mount, loading state, error display, retry action, and context effect observer, and verify tests pass with `nx test dashboard-shell`
- [x] 2.2 Verify and ensure clean unmount and DOM reset when `retry()` is invoked in `ChatWrapperComponent` to prevent duplicate roots, verifying with `nx test dashboard-shell`

## 3. Remote Runtime Error Boundary (Chat MFE)

- [x] 3.1 Implement `ChatErrorBoundary` component in `apps/chat-mfe/src/app/components/chat-error-boundary.tsx` with fallback card and "Reset Assistant" action, and add unit test in `chat-error-boundary.spec.tsx` verifying error catching and reset behavior, verifying with `nx test chat-mfe`
- [x] 3.2 Wrap `<App />` inside `ChatErrorBoundary` in `apps/chat-mfe/src/remote-entry.tsx`, and verify unit tests and build pass with `nx test chat-mfe && nx build chat-mfe`

## 4. Unified Workspace-Level End-to-End Suite

- [x] 4.1 Set up a single workspace-level Playwright configuration in `e2e/playwright.config.ts` orchestrating the whole project from cold start via `webServer` across all four services (`dashboard-api` at `http://localhost:3000/api`, `agent-service` at `http://localhost:8000/health`, `chat-mfe` at `http://localhost:4204`, and `dashboard-shell` at `http://localhost:4200`)
- [x] 4.2 Implement live backend API tests in `e2e/specs/01-api-services.spec.ts` verifying `dashboard-api` status and `agent-service` health from the live deployment
- [x] 4.3 Implement standalone chat microfrontend tests in `e2e/specs/02-chat-mfe.spec.ts` verifying remote UI mount and controls on port 4204
- [x] 4.4 Implement dashboard shell navigation, telemetry trends, and per-board statistics table tests in `e2e/specs/03-dashboard-shell.spec.ts` on port 4200 against live data without mocks and without hardcoded database record count assertions
- [x] 4.5 Implement full-stack assistant integration tests in `e2e/specs/04-fullstack-agent-integration.spec.ts` covering Native Federation remote mounting, live SSE token streaming from FastAPI agent service, filter context propagation, conversation persistence across drawer toggles, and drawer border resizing with 50% max clamping
- [x] 4.6 Remove fragmented app-level E2E directories (`apps/chat-mfe-e2e`, `apps/dashboard-shell-e2e`, and `apps/dashboard-api` e2e targets) to ensure exactly one unified E2E suite exists for the monorepo

## 5. Verification & Root Script Integration

- [x] 5.1 Configure the root `"e2e"` script in `package.json` to execute the single top-level workspace suite (`playwright test -c e2e/playwright.config.ts`)
- [x] 5.2 Run workspace-wide lint and unit tests across affected projects with `nx run-many -t lint,test --projects=dashboard-shell,chat-mfe,shared-mfe-context` and verify zero errors
- [x] 5.3 Execute the unified cold-start end-to-end test suite via `bun run e2e` and verify that all parts of the fully deployed project pass without mocks
