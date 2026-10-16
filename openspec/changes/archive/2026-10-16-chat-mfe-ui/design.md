# Technical Design: chat-mfe-ui

## Context

Milestone M6 Slice 1 (`mfe-dashboard-context-contract`) established the contract and communication bridge:
- `libs/shared-mfe-context` exports `DashboardContext` and `MountOptions` with an `onContextChange` registration callback.
- `apps/dashboard-shell`'s `ChatWrapperComponent` mounts the remote entry into a DOM container, forwarding live Angular signal changes via `effect()`.
- `apps/agent-service` runs on `http://localhost:8000`, exposing `POST /api/chat` which streams multi-step SSE events (`token`, `tool_call`, `tool_result`, `done`, `error`) and grounds responses on active context.

Currently, `apps/chat-mfe` contains only boilerplate (`NxWelcome`). This design details the full React assistant implementation for Milestone M6 Slice 2.

## Goals / Non-Goals

**Goals:**
- Implement `useChatStream` hook to manage conversation turns, parse SSE streams, execute sequential tool steps, and provide `AbortController` cancellation.
- Replace `NxWelcome` with a modern, modular React assistant UI matching the host's dark theme palette (`#0B0D12`, `#131722`, `#171B28`, `#2DD4BF`).
- Build a zero-dependency markdown formatting component for assistant responses.
- Display collapsible tool call execution step accordions with live running spinner and argument/result inspection.
- Provide a header with an active container context pill badge and a "Clear Conversation" button.
- Provide an auto-expanding input form with dynamic Send / Stop Generation controls.
- Decouple API communication so only `chat-mfe` accesses `agent-service`, using `import.meta.env.VITE_AGENT_API_URL`.
- Provide `createDefaultContainerContext()` in `libs/shared-mfe-context` for standalone or alternative container mounting.
- Persist `<app-chat-wrapper>` in the shell DOM across drawer toggles using CSS translates and `inert`, preserving message history and active generations.
- Provide a connection retry mechanism in `ChatWrapperComponent` to gracefully handle startup errors.
- Provide comprehensive Vitest unit test coverage for the hook, components, and shell wrapper.

**Non-Goals:**
- Anomaly telemetry chart highlight annotations on ApexCharts (deferred to Slice 4).
- Persistent database storage of chat history across browser reloads.

## Component Hierarchy & Architecture

```
App (Container & Context Subscription)
 └── ChatContainer
      ├── ChatHeader
      │    ├── ContextPillBadge (metric, device, time range, sync dot)
      │    └── ClearConversationButton
      ├── MessageList (auto-scroll aware)
      │    ├── MessageBubble (User)
      │    └── MessageBubble (Assistant)
      │         ├── ToolStepAccordion (running / completed / failed)
      │         │    └── ToolJsonViewer (arguments & output)
      │         ├── MarkdownContent (zero-dep renderer)
      │         └── StreamingCursor
      └── ChatInput
           ├── AutoExpandingTextarea
           ├── SendButton (idle state)
           └── AbortButton (streaming state)
```

## Decisions

### Decision 1: Zero-Dependency Markdown Formatter (`MarkdownContent`)
- **Choice**: Implement a lightweight, bespoke formatting component parsing assistant message text into React nodes (paragraphs, bold `**text**`, italic `*text*`, inline code `` `code` ``, fenced code blocks ` ``` `, bullet lists `- `, and summary tables).
- **Rationale**:
  - Adheres strictly to the workspace rule: *"Ask before adding a new dependency, and prefer what is already in the workspace."*
  - Zero added bundle weight (~1-2KB vs 20-50KB for external markdown packages).
  - Eliminates DOMPurify requirements and XSS attack vectors since output is constructed using safe React element trees rather than raw `dangerouslySetInnerHTML`.
- **Alternatives considered**:
  - `marked` / `react-markdown`: Rejected per user preference (Option B) to avoid external npm dependencies.

### Decision 2: `fetch` + `ReadableStream` SSE Protocol Parser (`useChatStream`)
- **Choice**: Use the standard browser `fetch` API with `response.body.getReader()` and `TextDecoder` to stream `POST /api/chat` requests:
  ```typescript
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: conversationHistory,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      context: activeContext,
    }),
    signal: abortController.signal,
  });
  ```
  A lightweight line-buffered parser decodes events:
  - `token`: Appends content to the current assistant message.
  - `tool_call`: Pushes a new `ToolStep` with `status: 'running'`.
  - `tool_result`: Matches `call_id` and attaches result, setting `status: 'completed'`.
  - `error`: Attaches error message and sets `status: 'error'`.
  - `done`: Completes turn and sets `isStreaming: false`.
- **Rationale**:
  - `EventSource` Web API only supports `GET` requests without custom body payloads.
  - Native `ReadableStream` provides zero-dependency streaming with immediate chunk processing and native `AbortController` cancellation.
- **Alternatives considered**:
  - `@microsoft/fetch-event-source`: Functional, but adds an external dependency when native browser streams achieve the same result with ~40 lines of code.

### Decision 3: Decoupled API Communication via Environment Variables
- **Choice**: Only `chat-mfe` communicates with `agent-service`. The API base URL is resolved as:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8000';
  ```
  An `apps/chat-mfe/.env.example` file documents `VITE_AGENT_API_URL=http://localhost:8000`.
- **Rationale**:
  - Decouples `dashboard-shell` completely from `agent-service`.
  - Allows easy configuration across local dev (`localhost:8000`), Docker containerization (`http://agent-service:8000`), or custom endpoints.

### Decision 4: Generic Container Context Decoupling
- **Choice**:
  - `libs/shared-mfe-context` exports `createDefaultContainerContext()` providing generic container defaults (`selectedMetric: 'temperature'`, `selectedDevices: ['esp32c6']`, `timeRange: { preset: '1d' }`), aliasing `createDefaultDashboardContext()`.
  - In `remote-entry.tsx`, `mount(container, options)` accepts `options?: MountOptions` and passes it to `<App mountOptions={options} />`.
  - When `options` is omitted (standalone execution), `App` falls back to `createDefaultContainerContext()`.
- **Rationale**: Ensures `chat-mfe` is not locked to this specific dashboard and can be embedded in alternative hosts or run standalone.

### Decision 5: Dark Theme Palette & Styling Alignment
- **Choice**: Configure Tailwind CSS in `apps/chat-mfe` to match the shell's dark aesthetic:
  - Background: `#0B0D12` (app), `#131722` (cards/bubbles), `#181E2C` (hover), `#171B28` (rails).
  - Borders: `rgba(255, 255, 255, 0.08)`.
  - Accent: `#2DD4BF` (teal) and `#2DD4BF20` (accent glow).
  - Text: `#F3F4F6` (primary), `#9CA3AF` (secondary), `#6B7280` (muted).
- **Rationale**: Consistent visual continuity when embedded inside the shell drawer.

## Risks / Trade-offs

- **[Risk]** Fast token streaming causes excessive re-renders and auto-scroll snapping when the user attempts to scroll up.
  - **Mitigation**: Implement a scroll position detector: auto-scroll activates only if the user is within 60px of the bottom of the message container. Scrolling up disables auto-scroll until the user returns to the bottom.
- **[Risk]** Large tool output payloads (e.g. series telemetry arrays) overflow the UI.
  - **Mitigation**: `ToolStepAccordion` collapses results by default, showing only a concise summary badge; expanding displays scroll-bounded JSON.
- **[Risk]** Network disconnection or backend crash leaves assistant in an indefinite streaming state.
  - **Mitigation**: Stream reader wraps fetch and chunk processing in `try...catch/finally`, ensuring `isStreaming` resets to `false` and an inline error alert is rendered if the stream terminates prematurely.
