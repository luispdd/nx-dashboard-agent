## 1. In-Memory Session Manager

- [x] 1.1 Implement `SessionManager` in `apps/agent-service/src/agent_service/session_manager.py` supporting session tracking, active task references, and TTL eviction. Verify with unit tests in `tests/test_session_manager.py`.
- [x] 1.2 Add session manager dependency provider (`get_session_manager`) for FastAPI dependency injection and verify singleton lifecycle behavior in unit tests.

## 2. FastAPI Application Factory & Lifespan

- [x] 2.1 Create the application factory `create_app()` and ASGI entrypoint in `apps/agent-service/src/agent_service/main.py` with lifespan context manager and CORS middleware for `http://localhost:4200` and `http://localhost:4204`. Verify instantiation and CORS headers with `httpx.AsyncClient`.
- [x] 2.2 Implement the `GET /health` diagnostic endpoint in `agent_service.main` returning service status, active provider, model name, and active session count while strictly omitting sensitive credentials. Verify with unit tests in `tests/test_health.py`.

## 3. Tooling & Verification

- [x] 3.1 Update the `serve` target in `apps/agent-service/project.json` to `uv run uvicorn agent_service.main:app --host 0.0.0.0 --port 8000 --reload` and verify module importability with uvicorn.
- [x] 3.2 Execute complete test and lint suites (`uv run pytest` and `uv run ruff check .`) to verify clean, hermetic test execution with zero warnings.
