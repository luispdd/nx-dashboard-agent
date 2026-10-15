# Technical Design: mfe-dashboard-context-contract

## Context

The system architecture pairs an Angular 22 Zoneless host (`apps/dashboard-shell`) with a React micro frontend (`apps/chat-mfe`) via Native Federation, querying a FastAPI agent service (`apps/agent-service`). See `proposal.md` for motivation and background.

Currently, `libs/shared-mfe-context` contains an unrefined `DashboardContext` interface with static properties. `ChatWrapperComponent` mounts `chat-mfe` once on `ngOnInit` with a static default context. When the user modifies filters in `TrendsViewComponent`, these changes are not propagated to the mounted React remote or the backend agent service.

## Goals / Non-Goals

**Goals:**
- Provide a typed, framework-agnostic `DashboardContext` data structure in `libs/shared-mfe-context` carrying the active metric, devices, display unit, and time range.
- Provide a clean callback subscription bridge in `MountOptions` (`onContextChange`) allowing the Angular host to notify the React remote of real-time filter changes.
- Implement `DashboardContextService` in `apps/dashboard-shell` using Angular Signals, wired to `TrendsViewComponent` filter updates.
- Use Angular's `effect()` in `ChatWrapperComponent` to forward signal changes to the active remote listener.
- Extend FastAPI `ChatRequest` with an optional `context` model and inject active context into `build_system_prompt()`.

**Non-Goals:**
- Building the complete React chat UI and SSE token rendering (deferred to `chat-mfe-ui`).
- Shell drawer layout persistence and Native Federation Playwright E2E automation (deferred to `mfe-federation-integration`).
- Anomaly chart visual overlay markers (deferred to `dashboard-anomaly-highlights`).

## Decisions

### Decision 1: Pure Callback Subscription (`onContextChange`) via Angular `effect()`
- **Choice**: The contract defines:
  ```typescript
  export interface MountOptions {
    context: DashboardContext;
    onContextChange?: (listener: (ctx: DashboardContext) => void) => () => void;
    onAction?: (action: DashboardAction) => void;
  }
  ```
  In `ChatWrapperComponent`, an Angular `effect()` monitors `dashboardContextService.activeContext()` and executes the registered listener callback.
- **Rationale**: 
  - Aligns with the project's zoneless, signals-first architecture without introducing RxJS Observables across MFE boundaries.
  - Avoids framework coupling: React receives a plain JavaScript callback and Angular manages its reactivity natively.
- **Alternatives considered**:
  - *RxJS Subject / Observable*: Rejected per architectural preference for Angular Signals and `effect()`.
  - *Window `CustomEvent`*: Rejected because global event listeners pollute the window scope and complicate isolated testing.

### Decision 2: Scope Context Exclusively to Telemetry Trends Filters
- **Choice**: `DashboardContextService` captures:
  - `selectedMetric`: Active metric key string (e.g. `'temperature'`).
  - `selectedDevices`: Array of device IDs (or all discovered devices when `'all'` is selected).
  - `unit`: Active display unit string (e.g. `'°C'`).
  - `timeRange`: Normalized object with `preset` (e.g. `'1d'`), resolved UTC `from`/`to` ISO strings, and optional `points` count.
- **Rationale**: The telemetry trends view is the primary analytical dashboard surface. Scoping context to its filters ensures the agent accurately mirrors the active visualization.

### Decision 3: Structured System Prompt Injection in `agent-service`
- **Choice**: Extend `apps/agent-service/src/agent_service/api/chat.py` with:
  ```python
  class TimeRangeContext(BaseModel):
      preset: str | None = None
      from_ts: str | None = Field(default=None, alias="from")
      to_ts: str | None = Field(default=None, alias="to")
      points: int | None = None

  class DashboardContextModel(BaseModel):
      selected_metric: str | None = None
      selected_devices: list[str] = Field(default_factory=list)
      unit: str | None = None
      time_range: TimeRangeContext | None = None
  ```
  `build_system_prompt(now_utc, user_timezone, context)` appends an `## Active Dashboard Context` block instructing the model to prioritize active filters when interpreting ambiguous user queries.
- **Rationale**:
  - Avoids mutating conversation history or injecting synthetic user messages.
  - Keeps system instructions authoritative and structured.

## Risks / Trade-offs

- **[Risk]** Model over-relies on active context and ignores explicit user overrides (e.g. user views temperature but explicitly asks "How is humidity on esp32c6?").
  - **Mitigation**: The system prompt explicitly instructs: *"When the user specifies a specific metric or time window in their message, their explicit input takes precedence over the active dashboard context."*
- **[Risk]** Context changes while an SSE stream is actively in flight.
  - **Mitigation**: Context is captured at request dispatch time per chat turn. Live context updates update subsequent turns without aborting or corrupting active SSE streams.
