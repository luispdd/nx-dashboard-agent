---
name: testing-strategy
description: Use when writing, reviewing or planning tests, fixtures, contract checks or agent evals, or when deciding what level of test a change needs.
---

# Testing strategy

Tests prove the spec scenarios. Every OpenSpec scenario maps to at least one automated test, or to an explicit manual check noted in the change tasks.

## Tooling & Levels

| Level | Where | Tools |
|---|---|---|
| Unit / Component | Pure UI logic, components, hooks, ETL, anomaly detectors, query builders, NestJS services | **TypeScript**: **Vitest** unified across all frontend and backend apps (`@angular/build:unit-test` locked to `vitest@^4.0.8`; NestJS requires `reflect-metadata` setup).<br>**Python**: `uv run pytest` (wrapped by `bunx nx test agent-service`). |
| Contract | API shapes, tool schemas, generated clients | OpenAPI spec as source of truth; verify generated clients are in sync (`libs/shared/contracts`). |
| Integration | NestJS API against SQLite/WAL test database, agent graph nodes with mocked LLM | In-process app + temp SQLite database. |
| End-to-end | Complete user journeys (dashboard shell loading charts, chat remote communicating via Native Federation, API routes) | **Playwright** (`@nx/playwright`) across all applications; run in CI and before releases. |
| Agent evals | Prompt, tools and detectors with the real LLM | Python eval suite executing against the local Unsloth instance (`http://127.0.0.1:8888/api`, `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`). Not part of the fast unit run. |

## Toolchain Quirks & Rules

- **Vitest Non-Watch Execution**: In `nx.json`, the `@nx/vitest` plugin uses `"testMode": "run"` so non-interactive/CI test executions exit cleanly without hanging.
- **Angular Vitest Version Lock**: Angular's `@angular/build:unit-test` executor strictly requires `vitest@^4.0.8`. Never install Vitest 5+ in this workspace.
- **NestJS Reflection**: Vitest tests in NestJS require `import 'reflect-metadata';` in the test setup file.

## Fixtures

- Use the **synthetic seed generator** for all fixtures. It must be deterministic (fixed random seed) and produce: several devices (`device_id: string`, e.g. `'esp32c6'`), 5-minute cadence with jitter in seconds, gaps, some on-demand readings, and **injected anomalies** with known locations.
- Never commit real device data.
- Keep small fixtures for unit tests; use the full synthetic dataset only for integration and e2e.

## What to test, by area

- **ETL:** timestamp normalization (zone-less to `Z`), JSON flattening, `sampling` mapping, validation failures (unknown key, unit mismatch, duplicates), idempotent rebuild.
- **API:** bucketing and downsampling, gap handling (no interpolation), `include_on_demand` default, bounded response size, error format.
- **Detectors:** each finding type is detected on injected anomalies and **not** raised on clean data; check severity and window boundaries.
- **Tools:** schema validation (enum rejection), unit presence, "no data" markers, timeout behavior.
- **UI:** timezone conversion and DST edges, empty/error/loading states, filters updating charts. Test behavior, not implementation details.
- **MFE integration:** the dashboard context contract (event payload shape and handling in `libs/shared-mfe-context`).
- **Security & Hardening:** Loopback binding enforcement, Host header mismatch rejection (403), Origin allowlist checks (foreign rejected, missing allowed), in-process rate limiting (429 + Retry-After), payload length limits (413), session eviction (LRU), response security headers via `@fastify/helmet`, and markdown link sanitization (`javascript:` stripped).

## Rules

- Tests must be deterministic: no network, no real LLM, no wall-clock dependence (inject the clock). The only exception is the eval suite.
- A bug fix starts with a failing test.
- Do not weaken or delete a test to make it pass; fix the cause or ask.
- Keep tests fast; slow suites do not get run.
- Prefer a few meaningful assertions over snapshot-everything.

## Commands

```bash
nx affected -t test                # Run Vitest across affected TypeScript projects
nx test agent-service              # Run pytest via Nx/uv for Python agent
nx affected -t e2e                 # Run Playwright E2E suites
bun run security:audit             # Run dependency vulnerability checks
```

## Checklist

- [ ] Each spec scenario covered
- [ ] Unit tests run via Vitest (TS) or pytest (Python)
- [ ] Deterministic, seeded fixtures; no private data
- [ ] Clean-data negative cases included for detectors
- [ ] Contracts and generated clients verified
- [ ] Security controls (headers, origin guards, rate limits, link sanitization) verified
- [ ] Playwright E2E test added or updated for critical user flows
- [ ] Eval re-run if prompts, tools or detectors changed
