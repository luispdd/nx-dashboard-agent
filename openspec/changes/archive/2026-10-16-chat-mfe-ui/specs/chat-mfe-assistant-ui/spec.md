## Purpose

Provides an interactive conversational AI assistant interface for the React chat micro frontend, rendering real-time streaming tokens, collapsible tool step accordions, zero-dependency formatted markdown, and conversation controls.

## ADDED Requirements

### Requirement: Real-Time SSE Token Streaming and Cancellation
The chat assistant UI SHALL consume multi-step Server-Sent Events (SSE) from the agent service `/api/chat` endpoint, dynamically streaming partial tokens into assistant message bubbles and allowing the user to halt active generations on demand.

#### Scenario: Streaming assistant tokens into message bubble
- **WHEN** the user submits a message and the agent service emits `token` events
- **THEN** incoming text chunks append in real time to the current assistant message with an active typing indicator until a `done` event is received

#### Scenario: Aborting in-flight generation
- **WHEN** generation is active and the user clicks the stop generation button
- **THEN** the active HTTP stream is aborted via `AbortController`, the assistant message is finalized at its current content, and input controls return to the idle state

#### Scenario: Handling server errors and stream disconnects
- **WHEN** the agent service emits an `error` event or the connection fails
- **THEN** an error alert is displayed within the message thread and streaming controls reset to idle

### Requirement: Collapsible Tool Call Execution Steps
The chat assistant UI SHALL render intermediate agent reasoning and tool executions (`tool_call` and `tool_result` events) as collapsible step accordions directly above the corresponding assistant response text.

#### Scenario: Displaying running tool invocation step
- **WHEN** the agent service emits a `tool_call` event
- **THEN** an accordion step appears showing the tool name, arguments badge, and an animated spinner indicating active execution

#### Scenario: Completed tool step inspection
- **WHEN** the agent service emits a `tool_result` event matching an active tool call ID
- **THEN** the step status updates to completed with a green checkmark, and clicking the step expands a formatted JSON preview of the input arguments and returned output

#### Scenario: Tool execution error step
- **WHEN** a tool execution fails or returns an error status
- **THEN** the step displays an error badge and expands to reveal error details

### Requirement: Message History and Zero-Dependency Markdown Rendering
The chat assistant UI SHALL render the conversation history with distinctive user and assistant bubble styling, formatting assistant text with a zero-dependency markdown renderer.

#### Scenario: Formatting assistant responses without external dependencies
- **WHEN** an assistant response contains paragraphs, bold/italic markers, inline code spans, fenced code blocks, bulleted lists, or summary tables
- **THEN** the text is parsed and rendered into styled HTML elements without loading third-party markdown packages

#### Scenario: Distinguishing user and assistant message styling
- **WHEN** messages are rendered in the message thread
- **THEN** user messages are right-aligned with accent styling and assistant messages are left-aligned with dark card styling and an assistant avatar

#### Scenario: Auto-scrolling on new tokens
- **WHEN** tokens or tool steps arrive while the user is viewing the bottom of the message thread
- **THEN** the container smoothly auto-scrolls to keep the latest content visible without snapping if the user has scrolled up to review previous messages

### Requirement: Active Container Context Pill Badge
The chat assistant header SHALL render an active context pill badge summarizing the host container's telemetry filters and indicating live synchronization.

#### Scenario: Rendering live context summary
- **WHEN** the assistant UI mounts with active container context (metric, devices, time window)
- **THEN** a pill badge displays the active metric name, device identifier(s), and time range preset alongside a green synchronization indicator

#### Scenario: Reactive updates when host context changes
- **WHEN** the host broadcasts an updated context object via `onContextChange`
- **THEN** the context pill badge updates immediately to reflect the new filter state without clearing existing messages

### Requirement: Conversation Clear and State Reset
The chat assistant UI SHALL provide a prominent "Clear Conversation" control allowing the user to wipe active message history and reset the assistant state.

#### Scenario: Resetting conversation state
- **WHEN** the user clicks the "Clear Conversation" button in the header
- **THEN** all conversation messages and tool execution history are cleared, returning the view to the initial empty state with quick starter suggestions

#### Scenario: Conversation persistence across drawer close
- **WHEN** the chat drawer is closed and reopened by the user
- **THEN** the assistant message history and tool executions SHALL remain preserved in memory, and SHALL only be reset when the user explicitly clicks the "Clear Conversation" button

### Requirement: Configurable Agent Service Endpoint
The chat assistant UI SHALL resolve the agent service API base URL from client environment configuration rather than hardcoding addresses.

#### Scenario: Resolving backend URL from environment variables
- **WHEN** `import.meta.env.VITE_AGENT_API_URL` is configured
- **THEN** API requests target the configured URL, falling back to `http://localhost:8000` when undefined
