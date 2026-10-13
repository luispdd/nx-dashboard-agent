# ADR-017: Local LLM (Unsloth) Connectivity & Tool Calling Verification

## Status
Accepted (Validated via Spike 3)

## Context
Milestone M0 requires validating that the Python agent service can communicate reliably with a locally running LLM instance (Unsloth on port 8888 serving Qwen 3.5 4B GGUF) via an OpenAI-compatible API. The agent architecture requires three core LLM capabilities:
1. Configurable connection parameters (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) so that development, local inference, and remote deployment do not require code changes.
2. Token-based authentication support (Bearer token) and resilient endpoint resolution.
3. Streaming chat completions for interactive UI chat responses.
4. Structured tool calling (function calling) where the model accurately invokes narrow, typed tools (e.g. `get_device_status` with `device_id: "esp32c6"`) instead of generating raw unstructured text.

## Decision
1. **Configuration Management**:
   - `apps/agent-service/src/agent_service/config.py` uses `pydantic-settings` to manage environment variables (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) with fallback defaults for local development.
   - Endpoint routing: In Unsloth Studio, OpenAI-compatible endpoints reside at `/v1` (e.g. `/v1/chat/completions`, `/v1/models`), while `/api` is reserved for internal studio management. A URL normalization helper (`normalize_base_url`) in `llm_client.py` automatically normalizes any `/api` path or root URL to `/v1`, ensuring robustness regardless of trailing slash or subpath configuration.
   - Credentials policy: No API keys or access tokens are committed to source control or disk files. The client reads `LLM_API_KEY` directly from the environment or process context.

2. **OpenAI Client & Probing Suite**:
   - Implemented `get_llm_client()` wrapping `AsyncOpenAI`.
   - Developed reusable diagnostic probes in `agent_service.llm_client`:
     - `probe_model_reachability`: Queries `/v1/models` to confirm endpoint availability and authentication.
     - `probe_streaming_chat`: Streams tokens chunk-by-chunk to verify SSE stream parsing.
     - `probe_tool_calling`: Submits a tool definition with JSON schema parameters (`device_id: string`) and asserts structured tool call responses.
   - Created standalone diagnostic runner: `python -m agent_service.verify_llm`.

3. **Hermetic Unit Testing**:
   - Unit tests in `tests/test_llm_client.py` use mock responses and streaming generators to verify URL normalization, configuration loading, reachability parsing, streaming chunk collection, and tool call extraction hermetically in CI without requiring a running Unsloth server.

## Verification & Outcomes
1. **Authentication & Models Endpoint**:
   - Unsloth Studio rejects unauthenticated requests with HTTP 401. Supplying the Bearer token via `LLM_API_KEY` successfully authenticates against `/v1/models`, returning active models including `unsloth/Qwen3.5-4B-GGUF`.

2. **Streaming Chat Completion**:
   - `probe_streaming_chat()` validated that Unsloth streams tokens smoothly via HTTP SSE (`status: success`, 9 tokens collected).

3. **Tool Calling Verification**:
   - Tool calling was verified against `unsloth/Qwen3.5-4B-GGUF` using tool schema `get_device_status(device_id: string)`.
   - The model properly generated a structured function call targeting `get_device_status` with arguments `{"device_id":"esp32c6"}` without extraneous conversational text or formatting corruption.

4. **Hermetic CI Performance**:
   - Unit tests run in under 300ms (`bunx nx test agent-service` - 6 passed).
   - Ruff linting passes with zero warnings (`bunx nx lint agent-service`).

- **Outcome**: **Works**. The local Unsloth instance fully supports OpenAI-compatible streaming and tool calling for Qwen 3.5 4B GGUF.
