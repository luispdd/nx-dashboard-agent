import json
import logging
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from sse_starlette.sse import EventSourceResponse

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.config import get_settings
from agent_service.context import (
    generate_run_id,
    reset_current_run_id,
    set_current_run_id,
)
from agent_service.rate_limiter import RateLimiter, get_rate_limiter
from agent_service.tools.registry import get_tool_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class TimeRangeContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    preset: str | None = None
    from_ts: str | None = Field(default=None, alias="from")
    to_ts: str | None = Field(default=None, alias="to")
    points: int | None = None


class DashboardContextModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    selected_metric: str | None = Field(default=None, alias="selectedMetric")
    selected_devices: list[str] = Field(default_factory=list, alias="selectedDevices")
    unit: str | None = None
    time_range: TimeRangeContext | None = Field(default=None, alias="timeRange")


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    timezone: str = Field(default="UTC")
    context: DashboardContextModel | None = None


@router.post("")
async def chat_stream(request: Request, body: ChatRequest) -> Response:
    """Streams multi-step conversational agent interaction over Server-Sent Events (SSE)."""
    cfg = getattr(request.app.state, "settings", None) or get_settings()
    client_ip = request.client.host if request.client else "127.0.0.1"

    # 1. Message size check
    max_chars = cfg.chat_max_message_chars
    for msg in body.messages:
        if len(msg.content) > max_chars:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": (
                        f"Message length ({len(msg.content)} chars) exceeds "
                        f"maximum allowed limit of {max_chars} chars."
                    )
                },
            )

    # 2. Rate limit check
    limiter: RateLimiter = getattr(
        request.app.state, "rate_limiter", None
    ) or get_rate_limiter(
        rate_limit_per_minute=cfg.chat_rate_limit_per_minute,
        max_concurrent_streams=cfg.chat_max_concurrent_streams,
    )

    is_allowed, retry_after = await limiter.check_rate_limit(client_ip)
    if not is_allowed:
        return JSONResponse(
            status_code=429,
            content={
                "detail": f"Rate limit exceeded. Try again in {retry_after} seconds."
            },
            headers={"Retry-After": str(retry_after)},
        )

    # 3. Concurrent stream check
    if await limiter.active_stream_count(client_ip) >= cfg.chat_max_concurrent_streams:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many concurrent streams. Please wait for active stream to complete."
            },
            headers={"Retry-After": "5"},
        )

    # Grab application state clients or instantiate defaults
    custom_llm = getattr(request.app.state, "llm_client", None)
    mcp_client = getattr(request.app.state, "mcp_client", None)
    tool_registry = getattr(
        request.app.state, "tool_registry", None
    ) or get_tool_registry(mcp_client=mcp_client)

    run_id = generate_run_id()

    orchestrator = AgentOrchestrator(
        llm_client=custom_llm,
        mcp_client=mcp_client,
        tool_registry=tool_registry,
    )

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        async with limiter.track_concurrency(client_ip) as acquired:
            if not acquired:
                yield {
                    "event": "error",
                    "data": json.dumps({"message": "Concurrent stream limit reached."}),
                }
                yield {"event": "done", "data": json.dumps({})}
                return

            token_run_id = set_current_run_id(run_id)
            messages_dicts = [m.model_dump() for m in body.messages]
            try:
                async for event in orchestrator.run(
                    messages=messages_dicts,
                    user_timezone=body.timezone,
                    context=body.context,
                    run_id=run_id,
                ):
                    yield {
                        "event": event["event"],
                        "data": json.dumps(event.get("data", {})),
                    }
            except Exception as err:
                logger.exception("Unhandled error in chat streaming endpoint")
                yield {
                    "event": "error",
                    "data": json.dumps({"message": f"Server streaming error: {err}"}),
                }
                yield {
                    "event": "done",
                    "data": json.dumps({}),
                }
            finally:
                reset_current_run_id(token_run_id)

    return EventSourceResponse(event_generator())
