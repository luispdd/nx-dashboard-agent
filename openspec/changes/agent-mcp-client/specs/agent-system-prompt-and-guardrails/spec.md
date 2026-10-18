## MODIFIED Requirements

### Requirement: Calendar-Aware System Prompt Injection
The agent orchestrator SHALL dynamically generate a system prompt injecting the current UTC timestamp, the day of the week, the viewer's local timezone, strict factual grounding instructions, and dynamic server instructions from connected MCP servers, while containing NO hardcoded data-tool names in the static prompt.

#### Scenario: Inject current calendar context
- **WHEN** a user initiates a chat request
- **THEN** the system prompt provides the current date, weekday, and UTC time so the model can resolve relative dates such as "yesterday" or "last Tuesday" to explicit ISO-8601 UTC timestamps

#### Scenario: Enforce factual grounding rule
- **WHEN** the agent constructs the system instructions
- **THEN** the instructions explicitly mandate that all numerical quantities, units, and device comparisons must strictly derive from tool results, prohibiting hallucinated historical data

#### Scenario: No hardcoded data tool names in prompt
- **WHEN** the system prompt is assembled
- **THEN** no specific data-tool name (such as `get_stats` or `get_series`) SHALL appear in the prompt's static text, leaving tool capabilities to be communicated via tool schemas

#### Scenario: Server instructions injection
- **WHEN** a connected MCP server provides server `instructions` in its initialize result
- **THEN** the system prompt SHALL include those instructions under a dedicated data source instructions heading
