# Proposal: chat-mfe-ui

## Why

Milestone M6 Slice 2 requires replacing the placeholder `NxWelcome` component in `apps/chat-mfe` with a fully functional, streaming conversational AI assistant. Currently, the remote microfrontend mounts inside the shell container but does not allow users to chat, view live tool steps, inspect active dashboard context, or cancel ongoing generations. Building this UI completes the assistant experience in the React remote before shell-level drawer animations and E2E persistence are tackled in Slice 3.

## What Changes

- **Streaming Chat Hook (`useChatStream`)**:
  - React hook consuming FastAPI `/api/chat` SSE events (`token`, `tool_call`, `tool_result`, `done`, `error`) via modern `fetch` and `ReadableStream`.
  - Supports stream cancellation via `AbortController`.
  - Manages message history, tool execution states, streaming indicators, and error tracking.
- **Zero-Dependency Markdown & Message Bubbles**:
  - Bespoke, lightweight React formatting component to render assistant messages (handling paragraphs, line breaks, bold/italic, inline code spans, code blocks, bullet lists, and summary tables) with zero added npm dependencies.
  - User and assistant message bubbles with timestamps, status indicators, and distinct styling.
  - Auto-scroll mechanism with user-scroll awareness (does not fight manual scroll-up).
- **Collapsible Tool Call Accordions**:
  - Renders intermediate agent tool executions (`tool_call` / `tool_result`) as collapsible step accordions.
  - Displays tool name, running spinner, completed status badge, input arguments, and formatted tool output preview.
- **Header with Active Context Pill & Clear Action**:
  - Context pill badge displaying active metric, selected devices, and time window with a live synchronization dot.
  - "Clear Conversation" button resetting chat history and state.
- **Input Controls**:
  - Auto-expanding `textarea` supporting `Enter` to submit and `Shift+Enter` for line breaks.
  - Context-aware action buttons: "Send" when idle, "Stop" during active streaming.
- **Decoupled API Configuration & Standalone Support**:
  - Agent service base URL configurable via `import.meta.env.VITE_AGENT_API_URL` (defaulting to `http://localhost:8000`). Only `chat-mfe` communicates with `agent-service`.
  - `libs/shared-mfe-context` extended with `createDefaultContainerContext()` to decouple the remote from a specific dashboard.
  - Fallback to default container context when mounted standalone without host options.
- **Shell Drawer DOM Persistence & Connection Resilience**:
  - `<app-chat-wrapper>` persisted in the Angular shell DOM across drawer open/close toggles, using CSS translate transitions (`translate-x-0` / `translate-x-full`) with `inert` and `aria-hidden` attributes rather than unmounting the React root.
  - Chat data is preserved across drawer toggles, clearing only when the user explicitly clicks the "Clear" button.
  - Connection retry mechanism and UI in `ChatWrapperComponent` to reconnect if the remote microfrontend encounters startup errors.

## Capabilities

### New Capabilities
- `chat-mfe-assistant-ui`: Implements the interactive React chat assistant interface in `apps/chat-mfe`, including SSE token streaming, tool call execution accordions, zero-dependency markdown formatting, context pill badge, generation cancellation, conversation reset, and state preservation across drawer toggles.

### Modified Capabilities
- `mfe-dashboard-context-contract`: Extends default context initialization with `createDefaultContainerContext()` alongside `createDefaultDashboardContext()` to support generic container hosts.

## Impact

- **Affected Packages**:
  - `apps/chat-mfe`: Complete UI implementation (`App`, `ChatContainer`, `ChatHeader`, `MessageList`, `MessageBubble`, `ToolStepAccordion`, `ChatInput`, `MarkdownContent`, `useChatStream`), Tailwind styling, and `.env.example`.
  - `apps/dashboard-shell`: Drawer DOM persistence in `app.html` with CSS translates and `inert`, plus retry handling in `chat-wrapper.component.ts`.
  - `libs/shared-mfe-context`: `createDefaultContainerContext()` export.
- **APIs**: Consumes `POST /api/chat` on the FastAPI `agent-service`.
- **Dependencies**: Zero new npm packages. Uses existing React 19, Angular 22, `@testing-library/react`, Vitest, and Tailwind CSS.
