# Technical Design: agent-service-skeleton

## Context

The agent service repository layout is defined in `.agents/skills/fastapi-python-conventions.SKILL.md` and uses `uv` for package and environment management. While foundational utilities (`config.py`, `llm_client.py`, `security.py`) were created during the M0/M1 spikes, the HTTP service entrypoint is not implemented (`src/agent_service/main.py` is missing and `project.json` references an unconfigured app). See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a clean FastAPI application factory with lifespan lifecycle management.
- Configure CORS for cross-origin access from the Angular dashboard shell (`:4200`) and React chat MFE (`:4204`).
- Provide an unauthenticated `GET /health` endpoint that exposes provider readiness and model info without leaking secrets.
- Implement an in-memory `SessionManager` to manage ephemeral chat sessions, hold in-progress task handles, and evict expired sessions via TTL.
- Ensure `nx serve agent-service` and `nx test agent-service` execute cleanly and hermetically.

**Non-Goals:**
- Implementing the chat SSE streaming endpoint (`POST /api/chat`) — handled in `agent-chat-streaming-contract`.
- Dynamic provider configuration switching endpoints — handled in `agent-llm-provider-config`.
- Persistent database storage — chat sessions and event buffers are strictly ephemeral and in-memory.

## Decisions

### Decision 1: Application Factory Pattern (`create_app`)
- **Choice**: Implement `create_app() -> FastAPI` in `src/agent_service/main.py` and expose module-level `app = create_app()` for ASGI runners.
- **Rationale**: Isolates test instances, ensures clean dependency injection overrides during testing, and cleanly attaches lifespan hooks.
- **Alternative considered**: Single global `app = FastAPI()` at module scope. Rejected due to state leakage across unit tests.

### Decision 2: In-Memory Ephemeral `SessionManager`
- **Choice**: Implement `SessionManager` in `src/agent_service/session_manager.py` maintaining an in-memory dictionary of session records with:
  - `session_id`: Unique identifier (UUID string).
  - `created_at` & `last_accessed_at`: Aware UTC timestamps.
  - `active_task`: Optional `asyncio.Task` reference for ongoing generation.
  - `event_buffer`: List of buffered events for client reconnection catchup.
  - Methods: `get_or_create_session()`, `get_session()`, `touch()`, `evict_expired(ttl_seconds)`.
- **Rationale**: Meets the user requirement that temporary disconnects do not cancel generation, buffered data is recoverable on reconnect, and the service remains strictly decoupled from any database.
- **Alternative considered**: Storing sessions in SQLite or Redis. Rejected per project decision (two backend services only, no Redis, no DB-per-service).

### Decision 3: Health Endpoint Schema & Secret Masking
- **Choice**: `GET /health` returns:
  ```json
  {
    "status": "ok",
    "provider": "unsloth",
    "model": "unsloth/Qwen3.5-4B-GGUF",
    "active_sessions": 0
  }
  ```
  API keys and auth headers are explicitly omitted from the response model.
- **Rationale**: Allows container orchestration and UI health indicators to verify service readiness without exposing security credentials.

### Decision 4: Project Target Execution in `project.json`
- **Choice**: Update `apps/agent-service/project.json` serve target command to:
  `uv run uvicorn agent_service.main:app --host 0.0.0.0 --port 8000 --reload`
- **Rationale**: Aligns with Python module resolution rules under `uv` and ensures hot reload works in development.

## Risks / Trade-offs

- **[Risk]** In-memory session accumulator causes memory exhaustion over extended uptime.
  - **Mitigation**: Implement a sliding TTL (default 3600 seconds) and run periodic or on-access eviction to prune stale sessions.
- **[Risk]** Ambient `.env` pollution in automated tests.
  - **Mitigation**: Follow `AGENTS.md` guidelines using pytest fixtures with `monkeypatch.delenv` to isolate test runs from developer environment files.
