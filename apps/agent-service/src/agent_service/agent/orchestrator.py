import json
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from agent_service.agent.prompt import build_system_prompt
from agent_service.clients.mcp_client import McpClient
from agent_service.config import settings
from agent_service.context import (
    generate_run_id,
    get_current_run_id,
    reset_current_run_id,
    reset_current_step,
    set_current_run_id,
    set_current_step,
)
from agent_service.llm_client import get_llm_client
from agent_service.tools.registry import ToolRegistry, get_tool_registry

logger = logging.getLogger(__name__)

DEFAULT_MAX_STEPS = 5


class AgentOrchestrator:
    def __init__(
        self,
        llm_client: AsyncOpenAI | None = None,
        mcp_client: McpClient | None = None,
        tool_registry: ToolRegistry | None = None,
        max_steps: int = DEFAULT_MAX_STEPS,
        model: str | None = None,
    ) -> None:
        self.llm_client = llm_client or get_llm_client()
        self.mcp_client = mcp_client or McpClient()
        self.tool_registry = tool_registry or get_tool_registry(
            mcp_client=self.mcp_client
        )
        self.max_steps = max_steps
        self.model = model or settings.llm_model

    async def run(
        self,
        messages: list[dict[str, Any]],
        user_timezone: str = "UTC",
        context: Any | None = None,
        run_id: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Executes a multi-turn sequential tool calling loop yielding SSE event dictionaries."""
        effective_run_id = run_id or get_current_run_id() or generate_run_id()
        token_run_id = set_current_run_id(effective_run_id)

        start_time = time.perf_counter()
        tool_calls_count = 0
        step_count = 0

        def _log_summary(status: str) -> None:
            total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            summary_extra: dict[str, Any] = {
                "event": "run_summary",
                "run_id": effective_run_id,
                "duration_ms": total_duration_ms,
                "duration": total_duration_ms,
                "step_count": step_count,
                "steps": step_count,
                "tool_call_count": tool_calls_count,
                "status": status,
            }
            logger.info(
                "Run finished in %.2fms (status=%s, steps=%d, tool_calls=%d)",
                total_duration_ms,
                status,
                step_count,
                tool_calls_count,
                extra=summary_extra,
            )

        try:
            if hasattr(self.tool_registry, "ensure_tools"):
                await self.tool_registry.ensure_tools()

            server_instructions = (
                self.tool_registry.get_server_instructions()
                if hasattr(self.tool_registry, "get_server_instructions")
                else None
            )

            # Initialize conversation history with system prompt
            history: list[dict[str, Any]] = [
                {
                    "role": "system",
                    "content": build_system_prompt(
                        user_timezone=user_timezone,
                        context=context,
                        server_instructions=server_instructions,
                    ),
                }
            ]
            history.extend(messages)

            tools = self.tool_registry.get_openai_tools()

            for step in range(self.max_steps):
                step_count = step + 1
                token_step = set_current_step(step)
                accumulated_content = []
                tool_calls_map: dict[int, dict[str, str]] = {}
                finish_reason = None
                t0_llm = time.perf_counter()

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
                        choice = chunk.choices[0]
                        if getattr(choice, "finish_reason", None):
                            finish_reason = choice.finish_reason
                        delta = choice.delta

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
                                    tool_calls_map[idx] = {
                                        "id": "",
                                        "name": "",
                                        "arguments": "",
                                    }
                                if tc.id:
                                    tool_calls_map[idx]["id"] += tc.id
                                if tc.function and tc.function.name:
                                    tool_calls_map[idx]["name"] += tc.function.name
                                if tc.function and tc.function.arguments:
                                    tool_calls_map[idx]["arguments"] += (
                                        tc.function.arguments
                                    )

                    llm_duration_ms = round((time.perf_counter() - t0_llm) * 1000, 2)
                    if not finish_reason:
                        finish_reason = "tool_calls" if tool_calls_map else "stop"

                    llm_extra: dict[str, Any] = {
                        "event": "llm_call",
                        "run_id": effective_run_id,
                        "step": step,
                        "model": self.model,
                        "duration_ms": llm_duration_ms,
                        "duration": llm_duration_ms,
                        "finish_reason": finish_reason,
                    }
                    if settings.log_payloads:
                        llm_extra["messages"] = history
                        llm_extra["response"] = "".join(accumulated_content)

                    logger.info(
                        "LLM call finished in %.2fms (model=%s, finish_reason=%s)",
                        llm_duration_ms,
                        self.model,
                        finish_reason,
                        extra=llm_extra,
                    )

                except Exception as err:
                    logger.exception("LLM generation error in orchestrator")
                    _log_summary("error")
                    yield {
                        "event": "error",
                        "data": {"message": f"LLM inference error: {err}"},
                    }
                    yield {"event": "done", "data": {}}
                    reset_current_step(token_step)
                    return

                full_text = "".join(accumulated_content)

                # If the model requested tool calls, execute them sequentially
                if tool_calls_map:
                    formatted_tool_calls = []
                    for _, tc_info in sorted(tool_calls_map.items()):
                        formatted_tool_calls.append(
                            {
                                "id": tc_info["id"] or f"call_{step}",
                                "type": "function",
                                "function": {
                                    "name": tc_info["name"],
                                    "arguments": tc_info["arguments"],
                                },
                            }
                        )

                    history.append(
                        {
                            "role": "assistant",
                            "content": full_text or None,
                            "tool_calls": formatted_tool_calls,
                        }
                    )

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

                        # Execute tool against MCP server / anomaly engine
                        tool_calls_count += 1
                        tool_output = await self.tool_registry.execute(
                            name=tool_name,
                            arguments=parsed_args,
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
                        history.append(
                            {
                                "role": "tool",
                                "tool_call_id": call_id,
                                "content": json.dumps(tool_output),
                            }
                        )

                    reset_current_step(token_step)
                    # Loop to next step so LLM receives the tool results
                    continue

                # No tool calls: final answer was synthesized
                reset_current_step(token_step)
                _log_summary("ok")
                yield {"event": "done", "data": {}}
                return

            # Max steps exceeded guardrail
            logger.warning(
                "Max tool steps (%d) reached without model completion.", self.max_steps
            )
            _log_summary("max_steps")
            yield {
                "event": "error",
                "data": {
                    "message": f"Execution halted: Maximum tool calling steps ({self.max_steps}) exceeded."
                },
            }
            yield {"event": "done", "data": {}}
        finally:
            reset_current_run_id(token_run_id)
