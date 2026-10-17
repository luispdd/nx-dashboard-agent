## Purpose

Provides a deterministic OpenAI-compatible LLM stand-in so end-to-end tests can exercise streaming chat and tool calling without a real model.

## ADDED Requirements

### Requirement: OpenAI-compatible streaming endpoint
The stub SHALL serve the chat completions API, including streamed responses, at a configurable port under a `/v1` base path.

#### Scenario: Streamed completion
- **WHEN** the agent requests a streaming chat completion
- **THEN** the stub SHALL return server-sent chunks ending with a terminal `[DONE]` marker

### Requirement: Scripted tool calling
The stub SHALL deterministically emit a tool call for recognised prompts and then a final text answer after receiving the tool result.

#### Scenario: Prompt triggers tool call
- **WHEN** the prompt matches a scripted scenario that requires a tool
- **THEN** the stub SHALL respond with a tool call whose name and arguments are valid for the agent's tool catalogue

#### Scenario: Tool result yields answer
- **WHEN** the conversation includes the tool result message
- **THEN** the stub SHALL stream a final answer without further tool calls

### Requirement: Unrecognised prompts
The stub SHALL answer unrecognised prompts with a fixed text reply rather than failing.

#### Scenario: Unknown prompt
- **WHEN** a prompt matches no scripted scenario
- **THEN** the stub SHALL stream a generic text reply and terminate normally

### Requirement: No secrets or real model dependency
The stub SHALL start without credentials, network access or GPU.

#### Scenario: Offline start
- **WHEN** the stub starts on a clean CI runner
- **THEN** it SHALL accept requests within a few seconds
