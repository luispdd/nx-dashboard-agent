import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_service.api.chat import router as chat_router
from agent_service.config import Settings, get_settings
from agent_service.session_manager import SessionManager, get_session_manager

logger = logging.getLogger(__name__)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://localhost:4204",
]


class HealthResponse(BaseModel):
    status: str = "ok"
    provider: str
    model: str
    active_sessions: int


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting agent-service application...")
    yield
    logger.info("Shutting down agent-service application...")
    session_mgr = getattr(app.state, "session_manager", None)
    if session_mgr:
        session_mgr.clear()
    dash_client = getattr(app.state, "dashboard_client", None)
    if dash_client and hasattr(dash_client, "close"):
        await dash_client.close()


def create_app(
    custom_settings: Settings | None = None,
    session_manager: SessionManager | None = None,
    llm_client: Any | None = None,
    dashboard_client: Any | None = None,
    tool_registry: Any | None = None,
) -> FastAPI:
    app = FastAPI(
        title="Agent Service",
        description="FastAPI agent service for IoT dashboard data and chat analysis",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.session_manager = session_manager or get_session_manager()
    app.state.settings = custom_settings
    app.state.llm_client = llm_client
    app.state.dashboard_client = dashboard_client
    app.state.tool_registry = tool_registry

    app.add_middleware(
        CORSMiddleware,
        allow_origins=DEFAULT_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat_router)

    @app.get("/health", response_model=HealthResponse)
    async def health_check(request: Request) -> dict[str, Any]:
        cfg: Settings = request.app.state.settings or get_settings()
        sm: SessionManager = request.app.state.session_manager or get_session_manager()

        provider_name = cfg.llm_base_url or "default"
        return {
            "status": "ok",
            "provider": provider_name,
            "model": cfg.llm_model or "unsloth/Qwen3.5-4B-GGUF",
            "active_sessions": sm.active_session_count(),
        }

    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("agent_service.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
