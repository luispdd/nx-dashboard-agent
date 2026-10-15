# agent-system-prompt-and-guardrails Specification

## Purpose

Orchestrates sequential multi-step tool calls, injects calendar grounding into the system prompt, enforces step and output guardrails, and streams execution events over Server-Sent Events (SSE).

## Requirements

### Requirement: Calendar-Aware System Prompt Injection
The agent orchestrator SHALL dynamically generate a system prompt injecting the current UTC timestamp, the day of the week (e.g. `"Today is Thursday, October 15, 2026 (UTC)"`), the viewer's local timezone, and strict factual grounding instructions.

#### Scenario: Inject current calendar context
- **WHEN** a user initiates a chat request
- **THEN** the system prompt provides the current date, weekday, and UTC time so the model can resolve relative dates such as "yesterday" or "last Tuesday" to explicit ISO-8601 UTC timestamps

#### Scenario: Enforce factual grounding rule
- **WHEN** the agent constructs the system instructions
- **THEN** the instructions explicitly mandate that all numerical quantities, units, and device comparisons must strictly derive from tool results, prohibiting hallucinated historical data

### Requirement: Sequential Multi-Step Tool Execution Loop
The agent orchestrator SHALL execute tool calls sequentially in an iterative loop, feeding each tool result back into the message history until the model completes its final synthesis or reaches the step limit.

#### Scenario: Execute multiple sequential tool queries
- **WHEN** the model requests a tool call to query statistics for "yesterday", and upon receiving results requests a second tool call for "last Tuesday"
- **THEN** the orchestrator executes each call in sequence, appends the tool results to conversation history, and allows the model to produce a final comparative synthesis

### Requirement: Step Limit and Timeout Guardrails
The agent orchestrator SHALL enforce a hard limit of at most 5 tool execution steps per user query and per-call execution timeouts to prevent infinite loops and runaway inference costs.

#### Scenario: Abort runaway tool execution
- **WHEN** a model exceeds 5 consecutive tool execution steps without providing a final response
- **THEN** the orchestrator terminates further tool execution and returns a descriptive error or forces a partial summary of findings collected so far

### Requirement: Streaming SSE Protocol
The chat endpoint SHALL stream conversation progress over Server-Sent Events using typed events: `tool_call`, `tool_result`, `token`, `done`, and `error`.

#### Scenario: Stream tool progress to client
- **WHEN** the model triggers a tool call during execution
- **THEN** the server immediately emits an SSE `tool_call` event with tool name and arguments, followed by a `tool_result` event upon execution completion

#### Scenario: Stream final narrative tokens
- **WHEN** the model generates the final natural language answer
- **THEN** content tokens are streamed incrementally via `token` SSE events, and the stream terminates with a `done` event

### Requirement: Active Dashboard Context Grounding
The agent orchestrator and prompt builder SHALL inject active dashboard telemetry filters (selected metric, selected devices, display unit, and active time window) into the system prompt when context is provided in the chat request, instructing the model to ground ambiguous user inquiries in the currently viewed data.

#### Scenario: Grounding queries in active dashboard context
- **WHEN** a user chat request includes `context` specifying metric `temperature`, device `esp32c6`, and a 24-hour time range
- **THEN** the orchestrator injects an "Active Dashboard Context" section into the system prompt detailing these filters and instructing the model to default to them when the user refers to "this metric", "current data", or "device X"

#### Scenario: Fallback behavior when context is omitted
- **WHEN** a chat request omits the `context` parameter or supplies an empty context object
- **THEN** the system prompt omits the active context section and relies solely on calendar grounding and explicit tool discovery

### Requirement: Context-Enriched Chat Request Validation
The `POST /api/chat` streaming endpoint SHALL validate incoming requests containing an optional structured `context` object adhering to the dashboard context model alongside the conversation message history and timezone.

#### Scenario: Validating request with full context
- **WHEN** a client posts a chat request containing `messages`, `timezone`, and a structured `context` with `selected_metric`, `selected_devices`, and `time_range`
- **THEN** the request validation succeeds and passes the parsed context model to the streaming orchestrator

#### Scenario: Backward-compatible request without context
- **WHEN** a client posts a chat request containing only `messages` and `timezone`
- **THEN** the request validation succeeds with `context` defaulting to `None`, preserving compatibility with uncontextualized callers

