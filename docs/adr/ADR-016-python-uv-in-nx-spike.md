# ADR-016: Python Project Orchestration in Nx via uv

## Status
Accepted (Validated via Spike 2)

## Context
The project includes a Python FastAPI service (`apps/agent-service`) responsible for agent tool execution, deterministic anomaly calculations, and LLM orchestration. We need a reliable way to manage Python dependencies, isolated virtual environments, and CI/CD targets within an Nx monorepo without global virtual environment conflicts or heavyweight third-party Nx plugins.

## Decision
We manage Python dependencies and project execution exclusively using **`uv`**, integrating into Nx via `nx:run-commands`.

1. **Nx Target Delegation**:
   - `apps/agent-service/project.json` targets (`test`, `lint`, `serve`) execute via `nx:run-commands` wrapping `uv run <tool>`.
   - `test` target executes `uv run pytest`.
   - `lint` target executes `uv run ruff check .`.
   - `serve` target executes `uv run uvicorn src.agent_service:app --reload --port 8000`.

2. **Dependency Management**:
   - `apps/agent-service/pyproject.toml` pins project dependencies (`fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `openai`, `httpx`, `sse-starlette`) and dev tools (`pytest`, `pytest-asyncio`, `ruff`).
   - `uv.lock` is version-controlled to guarantee reproducible dependency resolution across environments.

## Consequences & Verification
- `bunx nx test agent-service` executes pytest inside the project virtual environment in under 300ms.
- `bunx nx lint agent-service` runs ruff in under 150ms.
- `bunx nx affected` seamlessly includes `agent-service` when Python files change.
- **Outcome**: **Works**. Lightweight `nx:run-commands` with `uv` avoids third-party plugin fragility while delivering native monorepo caching and task orchestration.
