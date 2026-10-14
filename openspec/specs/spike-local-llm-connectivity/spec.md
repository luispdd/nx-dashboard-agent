# spike-local-llm-connectivity Specification

## Purpose

Validates local LLM server access, authentication, streaming, and tool calling from the FastAPI agent service against an OpenAI-compatible endpoint.

## Requirements

### Requirement: Local LLM service connectivity and authentication
The FastAPI agent service SHALL connect to a local Unsloth LLM server and resolve its authentication method via configurable environment variables.

#### Scenario: Verifying LLM endpoint health and access
- **WHEN** the agent service initiates a connectivity probe to the configured `LLM_BASE_URL`
- **THEN** the service SHALL authenticate and confirm the model `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL` is reachable

#### Scenario: Switching LLM provider via configuration
- **WHEN** `LLM_BASE_URL`, `LLM_MODEL`, or `LLM_API_KEY` environment variables are changed
- **THEN** the client SHALL connect to the updated provider without requiring code modifications

### Requirement: Streaming chat completion and tool calling verification
The agent service SHALL verify that the configured local model responds to streaming chat prompts and supports structured tool calls.

#### Scenario: Executing streaming inference test
- **WHEN** a test chat completion request is sent with streaming enabled
- **THEN** the model SHALL stream response tokens successfully to completion

#### Scenario: Evaluating tool call parsing capability
- **WHEN** a prompt requesting a registered tool invocation is provided to the model
- **THEN** the model output SHALL contain properly structured tool call arguments
