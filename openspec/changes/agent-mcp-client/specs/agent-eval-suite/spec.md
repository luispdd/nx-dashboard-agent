## MODIFIED Requirements

### Requirement: Single-Command Evaluation Runner
The evaluation suite SHALL be executable via a single CLI command, supporting evaluation across the MCP tool discovery backend and producing structured pass/fail scorecards without regression.

#### Scenario: Run evaluations against configured model
- **WHEN** the developer executes the evaluation suite command
- **THEN** the harness runs the benchmark test cases against the active LLM endpoint and outputs a scorecard detailing tool selection accuracy, factual precision, and execution times

#### Scenario: Verify parity between REST and MCP backends
- **WHEN** evaluations are executed against the MCP backend
- **THEN** the overall tool selection accuracy and factual precision SHALL match or exceed the baseline REST performance within statistical noise
