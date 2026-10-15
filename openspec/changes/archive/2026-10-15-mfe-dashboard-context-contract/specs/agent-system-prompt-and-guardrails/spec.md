## ADDED Requirements

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
