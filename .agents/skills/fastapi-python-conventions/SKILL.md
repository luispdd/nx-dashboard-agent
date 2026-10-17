---
name: fastapi-python-conventions
description: Use when writing or changing any Python code in this repo (FastAPI agent service, anomaly detection, ETL scripts, seed generator, evals), including project setup with uv, typing, settings, async code and SSE streaming.
---

# FastAPI and Python conventions

## Tooling (uv only)

- Manage everything with `uv`: `uv sync`, `uv add <pkg>`, `uv add --dev <pkg>`, `uv run <cmd>`, `uv lock`. Commit `pyproject.toml` and `uv.lock`.
- Do not use `pip`, `poetry` or manually created virtualenvs.
- Pin the Python version in `pyproject.toml` (and `.python-version` if used).
- Nx targets for Python projects are thin wrappers around `uv run ...`.
- Ask before adding a dependency; prefer the standard library and what is already installed.

## Project layout

```
apps/agent-service/
  pyproject.toml
  src/agent_service/
    main.py            # app factory, routers, lifespan
    config.py          # pydantic-settings
    api/               # routers, request/response models
    agent/             # orchestration, system prompt, step limits
    tools/             # tool definitions + implementations
    analysis/          # anomaly detection (pure functions)
    clients/           # NestJS API client (generated), LLM client
  tests/
```

Keep pure logic (analysis, time handling) free of framework imports so it is easy to test.

## Typing and style

- Fully type-annotated code; run a type checker (the one configured in the project, such as pyright or mypy) in strict or near-strict mode.
- Lint and format with `ruff` (`uv run ruff check .`, `uv run ruff format .`).
- **Pydantic v2** models for all request/response, tool input/output and finding records. Forbid extra fields on external inputs.
- Settings via `pydantic-settings` read from environment variables; commit only `.env.example`. No secrets in code or logs.
- Prefer small pure functions, dataclasses or Pydantic models over loosely structured dicts.

## FastAPI

- App factory and dependency injection through `Depends`; no global mutable state.
- **Async** handlers for I/O. Do not block the event loop; run CPU-heavy analysis in a worker thread or process pool if it becomes noticeable.
- Use `lifespan` for startup/shutdown (for example building the metric enum from the catalogue at startup, creating and closing HTTP clients).
- Consistent error responses via exception handlers; never leak stack traces.
- OpenAPI is the contract for the chat endpoint; the TypeScript client for the chat remote is generated from it.
- Health endpoint for Docker health checks.

## Streaming (SSE)

- Stream the chat with Server-Sent Events following the protocol: `token`, `tool_call`, `tool_result`, `done`, `error`.
- Always terminate with `done` or `error`, including on exceptions and client disconnects (clean up the upstream LLM request).
- Apply timeouts to upstream LLM calls and tool calls; enforce the maximum number of tool-call steps.

## LLM client

- Use an OpenAI-compatible client with `base_url`, model and API key from settings (`pydantic-settings` reading `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`).
- Local provider: Unsloth hosted at `http://127.0.0.1:8888/api` with model `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`.
- Verify connectivity and tool calling with streaming against the local Unsloth instance in M0 Spike 3. Hosted and local providers must remain interchangeable strictly through environment configuration.

## Time and data

- Always timezone-aware datetimes in UTC. Never use naive datetimes. Parse the source's zone-less timestamps only in the ETL, attaching UTC explicitly. See `data-and-time-rules`.
- `device_id` is a string (e.g., `'esp32c6'`).
- Use pandas/numpy/scipy only where they pay off in analysis; keep functions pure and deterministic.

## Tests

- `uv run pytest` (or `bunx nx test agent-service`) with deterministic fixtures from the seeded synthetic dataset; no network and no real LLM in unit tests (use a fake LLM client). Evals are separate. See `testing-strategy` and `agent-tool-design`.

## Checklist

- [ ] uv only; lockfile committed
- [ ] Typed, ruff clean, type checker clean
- [ ] Pydantic models at every boundary; settings from env (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`)
- [ ] Async I/O, timeouts, SSE ends with `done` or `error`
- [ ] Aware UTC datetimes only; `device_id` typed as string
- [ ] Tests pass (`uv run pytest` / `bunx nx test agent-service`)
