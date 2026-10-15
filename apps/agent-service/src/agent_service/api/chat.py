import json
import logging
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from agent_service.agent.orchestrator import AgentOrchestrator
from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.tools.registry import get_tool_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    timezone: str = Field(default="UTC")


@router.post("")
async def chat_stream(request: Request, body: ChatRequest) -> EventSourceResponse:
    """Streams multi-step conversational agent interaction over Server-Sent Events (SSE)."""
    # Grab application state clients or instantiate defaults
    custom_llm = getattr(request.app.state, "llm_client", None)
    dashboard_client = getattr(request.app.state, "dashboard_client", None) or DashboardApiClient()
    tool_registry = getattr(request.app.state, "tool_registry", None) or get_tool_registry()

    orchestrator = AgentOrchestrator(
        llm_client=custom_llm,
        dashboard_client=dashboard_client,
        tool_registry=tool_registry,
    )

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        messages_dicts = [m.model_dump() for m in body.messages]
        try:
            async for event in orchestrator.run(
                messages=messages_dicts,
                user_timezone=body.timezone,
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

    return EventSourceResponse(event_generator())
