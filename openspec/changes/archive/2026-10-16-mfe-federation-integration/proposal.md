# Proposal: mfe-federation-integration

## Why

Milestone M6 Slice 3 completes the microfrontend federation integration between the Angular 22 dashboard shell (`dashboard-shell`) and the React chat assistant remote (`chat-mfe`). While Slices 1 and 2 established the context contract and built the streaming chat assistant UI, the drawer needs enhanced usability with an adjustable width like Chrome DevTools, a runtime error boundary to prevent host disruptions, and a unified workspace-level end-to-end integration test suite that boots the entire project and tests each part of the live deployed system without mocks.

## What Changes

- **DevTools-Style Resizable Drawer**:
  - Implement a draggable vertical left border handle on the shell's chat drawer with horizontal resize cursor (`col-resize`).
  - Clamp dynamic width between a readable minimum (360px) and a maximum of 50% of the browser's viewport width (`50vw`).
  - Prevent text selection during active dragging and decouple width transitions during drag for responsive 60fps tracking.
  - Persist preferred drawer width in `localStorage` across drawer toggles and page reloads, gracefully defaulting to full width on mobile viewports (< 640px).
- **React Remote Error Boundary**:
  - Implement a robust `ChatErrorBoundary` component in `apps/chat-mfe` catching uncaught React render exceptions.
  - Render an in-component recovery card with a "Reset Assistant" button that restores the UI to a clean state without impacting the host shell.
- **Shell Wrapper Unit Test Suite**:
  - Add unit tests in `apps/dashboard-shell/src/app/chat-wrapper/chat-wrapper.component.spec.ts` covering remote module loading, error handling, retry connection, and context subscription cleanup.
  - Add unit tests in `apps/dashboard-shell/src/app/app.spec.ts` for drawer resizing, clamping, and persistence.
- **Unified Workspace-Level End-to-End Suite**:
  - Implement a single top-level Playwright suite at `e2e/playwright.config.ts` wired to the root `"e2e"` command in `package.json`.
  - Multi-service cold-start orchestration booting the whole project (NestJS API, FastAPI Agent, React Chat MFE, Angular Shell).
  - Layered test coverage verifying every tier of the project:
    1. Backend API service endpoints and health.
    2. Standalone Chat MFE loading and controls on port 4204.
    3. Live dashboard trends, navigation, and per-board statistics without hardcoded database record counts.
    4. Full-stack live assistant integration: drawer toggle via Native Federation, live SSE streaming from FastAPI agent and local LLM, filter context propagation, conversation persistence, and border resizing.

## Capabilities

### Modified Capabilities
- `dashboard-shell-layout`: Adds requirements for interactive draggable drawer resizing, 50% viewport maximum width clamping, minimum width constraints, and width persistence across drawer toggles.
- `chat-mfe-assistant-ui`: Adds requirement for remote runtime error boundary catching uncaught component exceptions and providing in-place state recovery.

## Impact

- **Affected Apps & Libs**:
  - `apps/dashboard-shell`: Drawer resize handle, pointer event listeners, width clamping, and unit tests.
  - `apps/chat-mfe`: `ChatErrorBoundary` component wrapping `<App />` in `remote-entry.tsx` and error boundary unit tests.
  - `e2e/`: Unified top-level Playwright configuration and test specs covering all parts of the project.
  - `package.json`: Root `"e2e"` script targeting the single workspace-wide E2E suite.
- **Dependencies**: No new npm packages; uses standard DOM Pointer Events, React Error Boundary patterns, and existing Playwright / Vitest test runners.
