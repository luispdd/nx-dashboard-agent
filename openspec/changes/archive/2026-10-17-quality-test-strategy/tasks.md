## 1. Strategy and audit

- [x] 1.1 Write `docs/testing-strategy.md` describing unit, contract and E2E layers, the LLM-stub boundary rationale and the stub/real modes; verify it is linked from the README or docs index
- [x] 1.2 Audit existing unit and E2E coverage per layer and area, recording a table in the strategy doc; verify every identified gap has a follow-up task below or an explicit "accepted" note

## 2. Stub LLM server

- [x] 2.1 Implement the stub under `e2e/fixtures/llm-stub/` serving streaming `/v1/chat/completions` with `[DONE]`; verify with a Vitest test that parses the stream
- [x] 2.2 Implement scripted tool-call scenarios and validate arguments against the agent tool schemas; verify tests cover tool-call then final-answer flow
- [x] 2.3 Implement the fallback reply for unrecognised prompts; verify with a test
- [x] 2.4 Verify the stub starts with no credentials and the configured port, e.g. via `curl` in a test

## 3. E2E integration

- [x] 3.1 Add `E2E_LLM_MODE` (`stub` default, `real`) to `e2e/playwright.config.ts`, starting the stub through `webServer` and pointing the agent at it; verify `bun run e2e` passes in stub mode with no local LLM running
- [x] 3.2 Keep `workers: 1` for real mode and document it; verify real mode still runs against a local LLM when available
- [x] 3.3 Adjust chat E2E specs to assert on stub-deterministic behaviour (tool step shown, streamed answer) while remaining data-invariant; verify they pass repeatedly (3 consecutive runs)

## 4. Gap filling and verification

- [x] 4.1 Add the targeted tests identified by the audit; verify each passes under `nx affected -t test`
- [x] 4.2 Run `openspec validate --all` and the full `nx affected -t lint test build` and confirm they pass
