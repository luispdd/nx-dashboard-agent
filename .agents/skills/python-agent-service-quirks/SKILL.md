---
name: python-agent-service-quirks
description: Use when writing or testing Python code in the FastAPI agent service: package __init__ imports, FastAPI lifespan in tests, asyncio cancellation assertions, Ruff B023, pytest discovery, LLM tool schemas or OpenAI-compatible endpoint URLs.
---

# Python agent service quirks

Pitfalls specific to the Python agent service (`apps/agent-service`).

- **OpenAI-Compatible Endpoint Normalization**: Some local servers (like Unsloth Studio) mount OpenAI routes at `/v1` while `/api` is reserved for their UI. The LLM client normalizes any `/api` suffix to `/v1` automatically.
- **Pytest Auto-Discovery**: Prefix helper/probe functions in non-test or imported modules with `probe_` or `check_`, never `test_`, to avoid Pytest collecting them as failing test cases.
- **Python Package Submodule Shadowing in `__init__.py`**: Importing a callable with the same name as a submodule in `__init__.py` (e.g. `from agent_service.main import main`) shadows the module attribute, breaking Uvicorn target resolution (`uvicorn agent_service.main:app` fails with `AttributeError: 'function' object has no attribute 'app'`). Export `app` and `create_app` or alias entrypoint functions instead.
- **FastAPI Lifespan & `TestClient` in Unit Tests**: Bare `httpx.AsyncClient(transport=ASGITransport(app))` does not trigger FastAPI async lifespan context managers. Use `TestClient(app)` from `fastapi.testclient` as a context manager (`with TestClient(app):`) to execute startup and shutdown hooks deterministically in tests.
- **Async Task Cancellation Assertions**: `task.cancel()` sets `task.cancelling() > 0` immediately, but `task.cancelled()` evaluates to `True` only after the event loop runs. In tests verifying task cancellation, yield to the event loop via `await asyncio.sleep(0)` before asserting `assert task.cancelled()`.
- **Python Loop Variable Binding in Closures (Ruff B023)**: Defining inner helper functions or closures inside loops that reference the loop iteration variable triggers Ruff `B023` and causes late-binding bugs. Bind loop variables explicitly as default parameter values (e.g. `def flush(dev=dev_id):`) or pass them as direct arguments.
- **LLM Tool Pydantic Schema Strictness (`extra="forbid"`)**: For tool function parameter definitions, Pydantic schemas must specify `model_config = ConfigDict(extra="forbid")`. This emits `"additionalProperties": false` in JSON Schema, preventing small or local LLMs from hallucinating unrecognized arguments that fail validation.
