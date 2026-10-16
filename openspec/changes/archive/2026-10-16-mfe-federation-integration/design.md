# Technical Design: mfe-federation-integration

## Context

The system consists of an Angular 22 zoneless host shell (`dashboard-shell`) loading an autonomous React 19 microfrontend (`chat-mfe`) via Native Federation (`@angular-architects/native-federation`). In previous slices, the context contract (`shared-mfe-context`) and streaming chat UI (`chat-mfe-ui`) were implemented. The chat wrapper component remains mounted in the shell DOM to preserve in-memory conversation state across slide-over drawer toggles.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a responsive, draggable DevTools-style vertical left border on the chat drawer allowing the user to resize the drawer width smoothly between 360px and 50% of the viewport width.
- Ensure 60fps drag performance by disabling text selection and decoupling CSS transitions during active dragging.
- Persist the preferred drawer width in `localStorage` (`iot-dashboard-chat-drawer-width`) with responsive fallback on mobile viewports (< 640px).
- Protect the host application from unhandled React component exceptions via a dedicated `ChatErrorBoundary` in `apps/chat-mfe`.
- Establish a single, unified workspace-level Playwright E2E suite (`e2e/`) that launches the entire project and tests every part of the deployed stack without backend route mocks.

**Non-Goals:**
- Fragmented per-app E2E suites (no separate `dashboard-shell-e2e`, `chat-mfe-e2e`, or `dashboard-api:e2e`).
- `Escape` key handling (explicitly excluded based on user requirements).
- Vertical drawer resizing or multi-position docking (drawer remains docked to the right viewport edge).
- Hardcoding database row counts or values in test assertions (the derived SQLite database is dynamic and subject to data updates).

## Decisions

### 1. Pointer Events and Window-Level Drag Tracking
- **Decision**: Track drag operations using DOM `pointerdown` on the resize handle, with `pointermove` and `pointerup` attached to `window`.
- **Rationale**: If the user moves the mouse rapidly, the cursor can exit the narrow resize handle bounding box. Window-level listeners ensure uninterrupted tracking and reliable release. During active drag, `user-select: none` and `cursor: col-resize` are applied to `document.body` to prevent accidental text highlighting across the dashboard.
- **Alternatives Considered**: 
  - CSS `resize: horizontal`: Lacks programmatic maximum clamping (50% max) and cannot easily integrate with `localStorage` or Angular signals.
  - Drag and Drop API: Overkill, introduces unnecessary drag ghost images and clunky event lifecycles.

### 2. Width Calculation, Clamping and Responsive Constraints
- **Decision**: 
  $$\text{rawWidth} = \text{window.innerWidth} - \text{clientX}$$
  $$\text{drawerWidth} = \max(360, \min(\text{rawWidth}, \lfloor\text{window.innerWidth} \times 0.5\rfloor))$$
- **Rationale**: 
  - Minimum width of 360px ensures that the header (context pill and clear button), markdown tables, and message bubbles have sufficient horizontal space.
  - Maximum width of 50vw guarantees that the main dashboard telemetry view remains visible and usable while the assistant is open.
  - On mobile screens (`< 640px`), the drawer overrides custom widths and expands to full viewport width (`100%`).
- **Persistence**: On `pointerup`, the clamped width is stored in `localStorage.setItem('iot-dashboard-chat-drawer-width', width.toString())`. On startup, the value is retrieved, falling back to 480px.

### 3. Decoupling CSS Transitions During Active Resizing
- **Decision**: Toggle a boolean flag `isResizing()` during drag. When `isResizing()` is true, disable CSS transition rules on the drawer (`transition: none`).
- **Rationale**: Retaining CSS `transition: transform 300ms, width 300ms` during real-time dragging causes visual lag and stutter. Disabling transitions during drag gives smooth 60fps tracking, while re-enabling them when idle preserves smooth slide-over open/close animations.

### 4. React Remote Error Boundary (`ChatErrorBoundary`)
- **Decision**: Wrap `<App />` in a standard React Error Boundary class component inside `apps/chat-mfe/src/remote-entry.tsx`.
- **Rationale**: In React 19, an uncaught render or streaming exception unmounts the entire React root, leaving an empty void in the shell container. `ChatErrorBoundary` catches errors, logs diagnostic information, and displays an inline dark-themed card with a "Reset Assistant" button that clears error state and restores the conversational UI.

### 5. Unified Workspace-Level Playwright End-to-End Suite
- **Decision**: Replace fragmented app-level E2E projects with a single workspace-level Playwright suite at `e2e/playwright.config.ts`, directly mapped to `"e2e"` in root `package.json`.
- **Multi-Service Cold-Start Orchestration**: A single composite `webServer` block boots the whole project:
  1. `dashboard-api` (`bun nx run dashboard-api:serve`, readiness probe `http://localhost:3000/api`)
  2. `agent-service` (`bun nx run agent-service:serve`, readiness probe `http://localhost:8000/health`)
  3. `chat-mfe` (`bun nx run chat-mfe:serve`, readiness probe `http://localhost:4204`)
  4. `dashboard-shell` (`bun nx run dashboard-shell:serve`, readiness probe `http://localhost:4200`)
- **Layered Test Structure**: Once all four tiers are operational, the suite executes dedicated specs across each part:
  - `01-api-services.spec.ts`: Validates backend HTTP endpoints (`dashboard-api` status and `agent-service` health).
  - `02-chat-mfe.spec.ts`: Validates standalone React chat remote rendering and basic controls on port 4204.
  - `03-dashboard-shell.spec.ts`: Validates Angular host navigation, filter controls, live charts, and per-board statistics without backend route mocks.
  - `04-fullstack-agent-integration.spec.ts`: Validates full integration (Native Federation remote loading, real-time SSE streaming from live FastAPI agent and LLM, filter context propagation, conversation persistence across drawer toggles, and drawer border resizing).
- **Decoupling from Dynamic Database Counts**: Assertions verify structural element rendering, active filters, and populated telemetry rows (`tbody tr`) without asserting hardcoded record counts or static telemetry values.

## Risks / Trade-offs

- **[Risk]** Resizing the browser window could cause a previously saved drawer width to exceed 50% of the new smaller viewport.
  - **Mitigation**: Add a window `resize` event listener in `App` that re-clamps `drawerWidth()` to `Math.min(drawerWidth(), window.innerWidth * 0.5)`.
- **[Risk]** Port conflict or circular task invocation between parallel Nx `e2e` targets.
  - **Mitigation**: Decommission separate per-app E2E targets (`apps/chat-mfe-e2e`, `apps/dashboard-shell-e2e`, and `apps/dashboard-api:e2e`). Run strictly one unified top-level Playwright suite.
- **[Risk]** Slow response times on local LLM cold-start causing test timeouts.
  - **Mitigation**: Set Playwright test timeout to 90 seconds in `e2e/playwright.config.ts` to accommodate token generation latency.
