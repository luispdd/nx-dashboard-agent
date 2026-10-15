# Proposal: mfe-dashboard-context-contract

## Why

Milestone M6 requires the conversational AI agent running inside the React chat micro frontend (`apps/chat-mfe`) to be aware of what the Angular dashboard shell (`apps/dashboard-shell`) is currently displaying. Without a shared context contract and reactive bridge, user queries like "Why does esp32c6 look odd?" cannot resolve the active metric, board selection, or historical time window without forcing the user to re-specify filters manually.

## What Changes

- **Shared Context Contract (`libs/shared-mfe-context`)**:
  - Extend `DashboardContext` to carry `selectedMetric`, `selectedDevices`, display `unit`, and structured `timeRange` (`from`, `to`, `preset`, `points`).
  - Define `MountOptions` with a typed subscription callback `onContextChange: (listener: (ctx: DashboardContext) => void) => () => void` enabling the host to push live updates to the mounted remote without framework-coupled abstractions.
  - Provide helper constructors and default state factories (`createDefaultDashboardContext()`).

- **Angular Shell Telemetry Context Broadcasting (`apps/dashboard-shell`)**:
  - Implement `DashboardContextService` providing an Angular Signal-based `activeContext` state.
  - Update `TrendsViewComponent` to synchronize active telemetry filter changes (`selectedMetric`, `selectedDevice`, `selectedRange`, `selectedPoints`, `currentUnit`) into `DashboardContextService`.
  - Use Angular's `effect()` in `ChatWrapperComponent` to dispatch real-time context updates to the mounted React micro frontend listener whenever filter signals change.

- **FastAPI Agent Service Context Grounding (`apps/agent-service`)**:
  - Extend the `ChatRequest` schema (`POST /api/chat`) to accept an optional `context: DashboardContextModel` payload.
  - Update `build_system_prompt()` and `AgentOrchestrator` to inject active dashboard filters (metric, devices, time window) into the model's system instructions, allowing ambiguous or comparative questions to default to the currently inspected telemetry view.

## Capabilities

### New Capabilities

- `mfe-dashboard-context-contract`: Defines the shared context contract, lifecycle mount options, and reactive subscription bridge between the Angular host, React remote, and FastAPI agent service.

### Modified Capabilities

- `agent-system-prompt-and-guardrails`: Grounding requirements extended to include active dashboard context injection into the system prompt and `ChatRequest` payload validation.
- `dashboard-telemetry-trends`: Trends view filter controls extended to broadcast active filter state to `DashboardContextService` via Angular signals.

## Impact

- **Affected Packages**:
  - `libs/shared-mfe-context`: Contract interfaces and subscription types.
  - `apps/dashboard-shell`: New `DashboardContextService`, modifications to `TrendsViewComponent` and `ChatWrapperComponent`.
  - `apps/agent-service`: `ChatRequest` Pydantic model in `api/chat.py`, `build_system_prompt` in `agent/prompt.py`, and `AgentOrchestrator` in `agent/orchestrator.py`.
- **API Contracts**: Non-breaking extension to `POST /api/chat` accepting optional `context` JSON field.
- **Dependencies**: Zero new npm or Python packages; leverages Angular signals, standard TypeScript callback types, and existing Pydantic models.
