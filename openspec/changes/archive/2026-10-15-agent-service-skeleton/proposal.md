# Proposal: agent-service-skeleton

## Why

Milestone M4 of the project plan introduces the FastAPI agent service foundation (`apps/agent-service`). While runtime configuration and LLM diagnostic probes were validated in M0/M1 spikes, the application currently lacks a functioning FastAPI HTTP server (`main.py` is an unrouted stub, and `nx serve agent-service` fails). Before implementing chat streaming and provider switching, the service requires a robust application skeleton with lifespan management, CORS configuration for the frontend micro frontends, an unauthenticated health check endpoint, and an in-memory session manager foundation to track ephemeral chat requests and support reconnects without database dependencies.

## What Changes

- Create the FastAPI application factory and ASGI entrypoint in `apps/agent-service/src/agent_service/main.py`.
- Configure application lifespan context to manage startup/shutdown initialization cleanly.
- Add CORS middleware permitting cross-origin requests from the Angular dashboard shell (`http://localhost:4200`) and React chat remote (`http://localhost:4204`).
- Implement an unauthenticated health check endpoint `GET /health` returning service liveness, runtime configuration source, active provider, and configured model (with credentials masked).
- Establish an in-memory session manager module (`session_manager.py`) providing session tracking, active async task registry for disconnect resilience, and TTL-based session eviction.
- Update `apps/agent-service/project.json` serve target to point to `agent_service.main:app` and ensure clean command execution under `uv`.
- Add unit tests with `httpx.AsyncClient` validating health endpoint responses, CORS headers, lifespan events, and session manager operations.

## Capabilities

### New Capabilities
- `agent-service-skeleton`: Core FastAPI application lifecycle, CORS middleware, health check endpoint, and in-memory session manager foundation.

### Modified Capabilities
<!-- None: Existing M0-M3 capabilities remain intact. -->

## Impact

- **Affected App**: `apps/agent-service`.
- **Target Command**: `nx serve agent-service` becomes functional on port 8000.
- **Dependencies**: Uses already-installed `fastapi`, `uvicorn`, `pydantic`, `httpx`, and `pytest`. No new third-party dependencies required.
- **Security**: Strictly no API keys or secrets exposed through the health endpoint or application logs.
