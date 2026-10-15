## Purpose

Orchestrates sequential multi-step tool calls, injects calendar grounding into the system prompt, enforces step and output guardrails, and streams execution events over Server-Sent Events (SSE).

## ADDED Requirements

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
