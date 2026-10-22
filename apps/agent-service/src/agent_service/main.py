import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agent_service.api.chat import router as chat_router
from agent_service.config import Settings, get_settings
from agent_service.logging_config import setup_logging
from agent_service.session_manager import SessionManager, get_session_manager

logger = logging.getLogger(__name__)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "http://localhost:4204",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:4204",
]


class HealthResponse(BaseModel):
    status: str = "ok"
    provider: str
    model: str
    active_sessions: int


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    logger.info("Starting agent-service application...")
    yield
    logger.info("Shutting down agent-service application...")
    session_mgr = getattr(app.state, "session_manager", None)
    if session_mgr:
        session_mgr.clear()
    dash_client = getattr(app.state, "dashboard_client", None)
    if dash_client and hasattr(dash_client, "close"):
        await dash_client.close()
    mcp_client = getattr(app.state, "mcp_client", None)
    if mcp_client and hasattr(mcp_client, "close"):
        await mcp_client.close()


def create_app(
    custom_settings: Settings | None = None,
    session_manager: SessionManager | None = None,
    llm_client: Any | None = None,
    mcp_client: Any | None = None,
    tool_registry: Any | None = None,
    dashboard_client: Any | None = None,
) -> FastAPI:
    cfg = custom_settings or get_settings()

    app = FastAPI(
        title="Agent Service",
        description="FastAPI agent service for IoT dashboard data and chat analysis",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.session_manager = session_manager or get_session_manager()
    app.state.settings = cfg
    app.state.llm_client = llm_client
    app.state.mcp_client = mcp_client
    app.state.dashboard_client = dashboard_client
    app.state.tool_registry = tool_registry

    @app.middleware("http")
    async def host_origin_guard(request: Request, call_next: Any) -> Any:
        current_cfg: Settings = request.app.state.settings or cfg

        # 1. Host header validation
        host_header = request.headers.get("host")
        if host_header:
            allowed_hosts_lower = [
                h.lower() for h in current_cfg.effective_allowed_hosts
            ]
            host_clean = host_header.strip().lower()
            host_name_only = host_clean.split(":")[0]
            if (
                host_clean not in allowed_hosts_lower
                and host_name_only not in allowed_hosts_lower
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Host '{host_header}' is not allowed"},
                )

        # 2. Origin header validation
        origin_header = request.headers.get("origin")
        if origin_header:
            allowed_origins_lower = [
                o.lower() for o in current_cfg.effective_allowed_origins
            ]
            if origin_header.strip().lower() not in allowed_origins_lower:
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Origin '{origin_header}' is not allowed"},
                )

        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.effective_allowed_origins,
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

    cfg = get_settings()
    if not cfg.is_loopback_only:
        logger.warning(
            "⚠️ Security Warning: agent-service is binding to non-loopback address '%s'. This service is exposed to the network.",
            cfg.agent_host,
        )

    uvicorn.run("agent_service.main:app", host=cfg.agent_host, port=cfg.agent_port, reload=True)


if __name__ == "__main__":
    main()
