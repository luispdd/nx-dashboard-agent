# Testing strategy

How the repository's tests are layered, what each layer covers (and must not cover), and how the end-to-end suite deals with the LLM.

## Layers

| Layer | Tooling | Covers | Must not cover |
| --- | --- | --- | --- |
| **Unit** | Vitest (NestJS, Angular via `vitest-angular`, React), `pytest` (agent service) | Pure logic, services, repositories, components in isolation, tool schemas, anomaly maths, prompt building | Cross-service wiring, real network, real LLM |
| **Contract** | OpenAPI export + generated clients (`openapi-contract.spec.ts`, `shared-contracts`) | The NestJS API shape consumed by the shell and the agent service | Business logic behind the endpoints |
| **End-to-end** | Single Playwright suite in `e2e/` against the running stack | A handful of user-visible flows: services up, chat mounts and streams, shell renders populated views | Exhaustive branches (use unit tests), exact data values |
| **Eval** | `nx run agent-service:eval` against the active LLM | Model behaviour: tool selection, answer quality | UI behaviour |

Add a test at the **lowest layer that can catch the bug**. A new E2E test is justified only for a user flow that spans the shell, chat remote, agent service and API.

## E2E rules

- No mocks of the dashboard API or database: both services run for real.
- Assertions are **data-invariant**: assert structure and populated state, never record counts or exact measurement values.
- `workers: 1` always, because parallel requests to a local LLM inflate streaming latency.

## The LLM boundary and the stub

The LLM is an external, nondeterministic dependency selected by `LLM_BASE_URL`. Stubbing it does not break the "no backend mocks" rule: the agent service, the NestJS API and the database all still run for real. Only the model is replaced.

The stub lives in `e2e/fixtures/llm-stub/` and serves an OpenAI-compatible `/v1` API (`/chat/completions` streaming and non-streaming, `/models`, `/health`):

- Keyword-scripted scenarios emit a tool call (e.g. a prompt mentioning "metrics" calls `list_metrics`); once the conversation contains the tool result it streams a fixed final answer.
- Unrecognised prompts get a fixed text reply.
- It needs no credentials, network or GPU. Port: `E2E_LLM_STUB_PORT` (default `8890`).
- Its own test (`nx test e2e`) validates the stream format and checks every scripted tool call against the agent's real tool schemas (read through `uv run`), so schema drift fails that test instead of passing silently.

### Modes

`E2E_LLM_MODE` selects the mode:

| Mode | Behaviour |
| --- | --- |
| `stub` (default) | Playwright starts the stub and a fresh agent service pointed at it (`RUNTIME_CONFIG_PATH` is set to a missing file so `data/runtime-config.json` cannot override it). An agent service already running on port 8000 must be stopped first. |
| `real` | Uses the configured `LLM_BASE_URL` / runtime config and may reuse an already running agent service. Requires a local or cloud LLM. Tests that depend on scripted behaviour are skipped. |

```bash
bun run e2e                        # stub mode
E2E_LLM_MODE=real bun run e2e      # real LLM
```

## Coverage audit

| Area | Unit | Contract | E2E | Notes |
| --- | --- | --- | --- | --- |
| dashboard-api (ETL, repository, stats, series, filters) | Yes (13 specs) | Yes (OpenAPI spec test) | Yes (01) | Covered |
| agent-service (tools, orchestrator, anomalies, chat endpoint, config) | Yes (13 pytest files) | Via OpenAPI client tests | Yes (04) | Covered; model behaviour is in evals |
| dashboard-shell (trends, distribution, settings, header, services) | Yes (12 specs) | Generated clients | Yes (03, 04) | Covered |
| chat-mfe stream hook | Yes (`use-chat-stream.spec.ts`) | n/a | Yes (02) | Covered |
| chat-mfe components (tool step accordion, message list, input, header, markdown, error boundary) | Yes (6 specs) | n/a | Yes (02, 04) | Covered |
| Tool-call display in chat (full flow) | n/a | n/a | **Was missing** (needed a real model) | Gap closed by the stub-only E2E test in 02 |
| shared-mfe-context | Yes | n/a | Indirect | Covered |

Accepted: no additional unit tests are needed after the audit; the only gap (an E2E tool-call flow) is closed by the stub.
