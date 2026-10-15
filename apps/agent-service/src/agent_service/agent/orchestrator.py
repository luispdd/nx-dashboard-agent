import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from agent_service.agent.prompt import build_system_prompt
from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.config import settings
from agent_service.llm_client import get_llm_client
from agent_service.tools.registry import ToolRegistry, get_tool_registry

logger = logging.getLogger(__name__)

DEFAULT_MAX_STEPS = 5


class AgentOrchestrator:
    def __init__(
        self,
        llm_client: AsyncOpenAI | None = None,
        dashboard_client: DashboardApiClient | None = None,
        tool_registry: ToolRegistry | None = None,
        max_steps: int = DEFAULT_MAX_STEPS,
        model: str | None = None,
    ) -> None:
        self.llm_client = llm_client or get_llm_client()
        self.dashboard_client = dashboard_client or DashboardApiClient()
        self.tool_registry = tool_registry or get_tool_registry()
        self.max_steps = max_steps
        self.model = model or settings.llm_model

    async def run(
        self,
        messages: list[dict[str, Any]],
        user_timezone: str = "UTC",
        context: Any | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Executes a multi-turn sequential tool calling loop yielding SSE event dictionaries."""
        # Initialize conversation history with system prompt
        history: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": build_system_prompt(user_timezone=user_timezone, context=context),
            }
        ]
        history.extend(messages)

        tools = self.tool_registry.get_openai_tools()

        for step in range(self.max_steps):
            accumulated_content = []
            tool_calls_map: dict[int, dict[str, str]] = {}

            try:
                stream = await self.llm_client.chat.completions.create(
                    model=self.model,
                    messages=history,  # type: ignore[arg-type]
                    tools=tools,  # type: ignore[arg-type]
                    tool_choice="auto",
                    stream=True,
                )

                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta

                    # Stream text content
                    if delta.content:
                        accumulated_content.append(delta.content)
                        yield {
                            "event": "token",
                            "data": {"content": delta.content},
                        }

                    # Accumulate streamed tool calls
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_map:
                                tool_calls_map[idx] = {"id": "", "name": "", "arguments": ""}
                            if tc.id:
                                tool_calls_map[idx]["id"] += tc.id
                            if tc.function and tc.function.name:
                                tool_calls_map[idx]["name"] += tc.function.name
                            if tc.function and tc.function.arguments:
                                tool_calls_map[idx]["arguments"] += tc.function.arguments

            except Exception as err:
                logger.exception("LLM generation error in orchestrator")
                yield {
                    "event": "error",
                    "data": {"message": f"LLM inference error: {err}"},
                }
                yield {"event": "done", "data": {}}
                return

            full_text = "".join(accumulated_content)

            # If the model requested tool calls, execute them sequentially
            if tool_calls_map:
                formatted_tool_calls = []
                for _, tc_info in sorted(tool_calls_map.items()):
                    formatted_tool_calls.append({
                        "id": tc_info["id"] or f"call_{step}",
                        "type": "function",
                        "function": {
                            "name": tc_info["name"],
                            "arguments": tc_info["arguments"],
                        },
                    })

                history.append({
                    "role": "assistant",
                    "content": full_text or None,
                    "tool_calls": formatted_tool_calls,
                })

                # Execute each tool call sequentially
                for tc in formatted_tool_calls:
                    call_id = tc["id"]
                    tool_name = tc["function"]["name"]
                    raw_args = tc["function"]["arguments"]

                    parsed_args: dict[str, Any]
                    try:
                        parsed_args = json.loads(raw_args) if raw_args else {}
                    except json.JSONDecodeError:
                        parsed_args = {"_raw": raw_args}

                    # Emit tool_call event to client
                    yield {
                        "event": "tool_call",
                        "data": {
                            "tool": tool_name,
                            "call_id": call_id,
                            "args": parsed_args,
                        },
                    }

                    # Execute tool against Dashboard API / anomaly engine
                    tool_output = await self.tool_registry.execute(
                        name=tool_name,
                        arguments=parsed_args,
                        client=self.dashboard_client,
                    )

                    # Emit tool_result event to client
                    yield {
                        "event": "tool_result",
                        "data": {
                            "tool": tool_name,
                            "call_id": call_id,
                            "result": tool_output,
                        },
                    }

                    # Append tool result to history for next model turn
                    history.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": json.dumps(tool_output),
                    })

                # Loop to next step so LLM receives the tool results
                continue

            # No tool calls: final answer was synthesized
            yield {"event": "done", "data": {}}
            return

        # Max steps exceeded guardrail
        logger.warning("Max tool steps (%d) reached without model completion.", self.max_steps)
        yield {
            "event": "error",
            "data": {
                "message": f"Execution halted: Maximum tool calling steps ({self.max_steps}) exceeded."
            },
        }
        yield {"event": "done", "data": {}}
