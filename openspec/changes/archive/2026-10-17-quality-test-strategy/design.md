## Context

Current E2E specs live in `e2e/specs/` (01-api-services, 02-chat-mfe, 03-dashboard-shell, 04-fullstack-agent-integration) and chat tests assume a real local LLM. Project rules require no backend mocks in E2E, `workers: 1` against local LLMs, and data-invariant assertions. See proposal.md.

## Goals / Non-Goals

**Goals:**
- A stub LLM that makes the chat E2E flows deterministic and fast.
- A written strategy and a small, targeted coverage audit.

**Non-Goals:**
- Replacing real-LLM validation: the eval suite and opt-in real mode remain.
- Mocking the dashboard-api or database: only the LLM boundary is stubbed.

## Decisions

- **Stub location and runtime**: a small Node script under `e2e/fixtures/llm-stub/` (the workspace already runs Node/Bun tooling). Alternative: Python stub in `agent-service`. Rejected: it would ship test code in a production service.
- **Boundary rationale**: the LLM is an external, nondeterministic dependency configured by `LLM_BASE_URL`; stubbing it does not violate the "no backend mocks" rule because both services still run for real. Record this in the strategy doc and an ADR (via `docs-showcase`).
- **Scripted scenarios**: keyword-triggered (e.g. prompt mentions "metrics" -> `list_metrics` tool call, then a summary reply). Arguments validated against the agent's tool schemas so schema drift breaks the stub test, not silently passes.
- **Streaming format**: standard `chat.completion.chunk` SSE with `tool_calls` deltas and `[DONE]`, mirroring what the agent's LLM client consumes.
- **Mode switch**: env `E2E_LLM_MODE=stub|real` (default `stub`). Playwright config starts the stub in `webServer` for stub mode, forces `workers: 1` in real mode.
- **Stub self-test**: a Vitest test for the stub's request/response behaviour.
- **Coverage audit**: produce a table (layer x area) in the strategy doc and add only tests for identified gaps.

## Risks / Trade-offs

- [Stub drifts from real provider behaviour] -> keep it minimal, rely on evals for model behaviour, validate tool arguments against schemas.
- [Over-testing through E2E] -> strategy keeps E2E to a handful of flows.
- [Port collisions] -> stub port configurable via env, default distinct from existing ports (4200, 4204, 3000, 8888).
