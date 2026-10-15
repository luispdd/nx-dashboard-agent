## 1. Shared Context Library (`libs/shared-mfe-context`)

- [x] 1.1 Expand `DashboardContext` interface with `selectedMetric`, `selectedDevices`, display `unit`, and structured `timeRange` (`from`, `to`, `preset`, `points`) in `libs/shared-mfe-context/src/lib/shared-mfe-context.ts`
- [x] 1.2 Define `MountOptions` with `onContextChange` subscription callback type and update `createDefaultDashboardContext()` factory in `libs/shared-mfe-context/src/lib/shared-mfe-context.ts`
- [x] 1.3 Add unit tests in `libs/shared-mfe-context/src/lib/shared-mfe-context.spec.ts` covering contract serialization and default context values; verify with `nx test shared-mfe-context`

## 2. Shell Context Service & Trends Integration (`apps/dashboard-shell`)

- [x] 2.1 Implement `DashboardContextService` in `apps/dashboard-shell/src/app/core/services/dashboard-context.service.ts` managing an Angular signal-based `activeContext`
- [x] 2.2 Wire `TrendsViewComponent` to synchronize active metric, selected devices, range preset, points, and unit into `DashboardContextService` on filter changes
- [x] 2.3 Update `ChatWrapperComponent` to invoke the registered `onContextChange` listener via an Angular `effect()` when `activeContext` changes
- [x] 2.4 Add Vitest unit tests in `dashboard-context.service.spec.ts` and `trends-view.component.spec.ts` verifying signal synchronization; verify with `nx test dashboard-shell`

## 3. Agent Service Context Grounding (`apps/agent-service`)

- [x] 3.1 Define Pydantic models `DashboardContextModel` and `TimeRangeContext` in `apps/agent-service/src/agent_service/api/chat.py` and add optional `context` field to `ChatRequest`
- [x] 3.2 Update `build_system_prompt()` in `apps/agent-service/src/agent_service/agent/prompt.py` to accept `context` and render the `## Active Dashboard Context` instruction section
- [x] 3.3 Update `AgentOrchestrator.run()` in `apps/agent-service/src/agent_service/agent/orchestrator.py` to forward context into prompt creation
- [x] 3.4 Add Pytest tests in `apps/agent-service/tests/test_chat_context.py` asserting context parsing in `POST /api/chat` and prompt formatting; verify with `cd apps/agent-service && uv run pytest`

## 4. Quality & Lint Verification

- [x] 4.1 Run workspace-wide lint and test verification across all affected projects; verify clean exit with `nx run-many -t lint test -p shared-mfe-context,dashboard-shell,agent-service`
- [x] 4.2 Add Playwright E2E test verifying chat drawer opening and successful microfrontend mount via Native Federation; verify with `nx e2e dashboard-shell-e2e`
