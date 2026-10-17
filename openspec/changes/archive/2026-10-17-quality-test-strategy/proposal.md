## Why

Tests exist per project and in four E2E specs, but there is no documented strategy, no check that the layers are balanced, and E2E chat flows depend on a real local LLM, which makes them unrunnable in CI and slow and nondeterministic locally.

## What Changes

- Document the test strategy per layer (unit, contract, E2E) and what each must and must not cover.
- Add a deterministic stub OpenAI-compatible LLM server (streaming chat completions with tool calls) usable by E2E locally and in CI.
- Make the E2E suite selectable: stub-LLM mode (default in CI) and real-LLM mode (opt-in locally).
- Audit current unit and E2E coverage against the strategy and fill the gaps with a small number of high-value tests.
- Keep the E2E suite invariant to dynamic data, as already required by project rules.

## Capabilities

### New Capabilities
- `test-strategy`: Required test layers, E2E selection of LLM mode and coverage expectations.
- `llm-stub-server`: Deterministic OpenAI-compatible stub for tests.

### Modified Capabilities

## Impact

- New stub server under the E2E workspace (`e2e/`), Playwright config and env switch.
- New or adjusted tests in affected projects; strategy doc under `docs/`.
- Does not change production code paths; the agent still talks to any OpenAI-compatible endpoint via configuration.
