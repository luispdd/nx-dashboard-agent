import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError

from agent_service.clients.mcp_client import McpClient, McpClientError
from agent_service.config import settings
from agent_service.context import get_current_run_id, get_current_step
from agent_service.tools.core_data import (
    handle_detect_anomalies_mcp,
    validate_core_contract,
)
from agent_service.tools.mcp_adapter import mcp_tool_to_openai_function
from agent_service.tools.schemas import DetectAnomaliesInput

logger = logging.getLogger(__name__)

ToolHandler = Callable[[Any, Any], Awaitable[Any]]


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_model: type[BaseModel]
    handler: ToolHandler | None = None

    def to_openai_schema(self) -> dict[str, Any]:
        schema = self.input_model.model_json_schema()
        parameters = {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", []),
            "additionalProperties": False,
        }
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": parameters,
            },
        }


class ToolRegistry:
    def __init__(
        self,
        mcp_client: McpClient | None = None,
        ttl_seconds: int | None = None,
        max_result_chars: int | None = None,
        backend: str = "mcp",
    ) -> None:
        self.backend = backend
        self.mcp_client = mcp_client or McpClient()
        self.ttl_seconds = (
            ttl_seconds
            if ttl_seconds is not None
            else settings.mcp_tool_list_ttl_seconds
        )
        self.max_result_chars = (
            max_result_chars
            if max_result_chars is not None
            else settings.tool_result_max_chars
        )

        self._local_tools: dict[str, ToolDefinition] = {}

        # MCP cache state
        self._cached_tools: list[Any] = []
        self._cached_openai_tools: list[dict[str, Any]] = []
        self._server_instructions: str | None = None
        self._last_refresh_time: float = 0.0
        self._detect_anomalies_enabled: bool = True

    def register_local_tool(self, tool: ToolDefinition) -> None:
        self._local_tools[tool.name] = tool

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._local_tools.get(name)

    def get_server_instructions(self) -> str | None:
        return self._server_instructions

    async def ensure_tools(self) -> list[dict[str, Any]]:
        """Ensures tool definitions are populated and fresh according to TTL."""
        now = time.time()
        if (
            self._cached_openai_tools
            and (now - self._last_refresh_time) < self.ttl_seconds
        ):
            return self._cached_openai_tools

        try:
            discovered = await self.mcp_client.list_tools()
            tools = discovered.tools
            self._server_instructions = discovered.instructions

            # Collision check: local analysis tools must not be shadowed by MCP tools
            for t in tools:
                t_name = t.name if hasattr(t, "name") else t.get("name")
                if t_name in self._local_tools:
                    raise ValueError(
                        f"Tool name collision detected: tool '{t_name}' exists as a local tool and was also discovered on MCP server at {self.mcp_client.url}"
                    )

            # Core contract validation for anomaly detection
            contract_valid = validate_core_contract(tools)
            self._detect_anomalies_enabled = contract_valid
            if not contract_valid:
                logger.warning(
                    "Core telemetry contract validation failed; 'detect_anomalies' is disabled."
                )

            # Build OpenAI tool schemas
            openai_tools = [mcp_tool_to_openai_function(t) for t in tools]
            if (
                self._detect_anomalies_enabled
                and "detect_anomalies" in self._local_tools
            ):
                openai_tools.append(
                    self._local_tools["detect_anomalies"].to_openai_schema()
                )

            self._cached_tools = tools
            self._cached_openai_tools = openai_tools
            self._last_refresh_time = now
            return self._cached_openai_tools

        except Exception as err:
            if self._cached_openai_tools:
                logger.warning(
                    "Failed to refresh MCP tools from %s (%s); reusing cached tools",
                    self.mcp_client.url,
                    err,
                )
                return self._cached_openai_tools
            logger.error(
                "Failed to discover MCP tools from %s and no cache exists: %s",
                self.mcp_client.url,
                err,
            )
            raise

    def get_openai_tools(self) -> list[dict[str, Any]]:
        if self._cached_openai_tools:
            return self._cached_openai_tools
        return [t.to_openai_schema() for t in self._local_tools.values()]

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any] | str,
        client: Any = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()

        def _finish(
            status: str, payload: dict[str, Any], raw_args: Any = None
        ) -> dict[str, Any]:
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)

            # Check result truncation limit
            try:
                raw_json = json.dumps(payload)
                if len(raw_json) > self.max_result_chars:
                    notice = (
                        f"\n[Result truncated to {self.max_result_chars} characters]"
                    )
                    truncated_text = (
                        raw_json[: self.max_result_chars - len(notice)] + notice
                    )
                    payload = {
                        "status": status,
                        "result": truncated_text,
                        "truncated": True,
                    }
                    result_bytes = len(truncated_text.encode("utf-8"))
                else:
                    result_bytes = len(raw_json.encode("utf-8"))
            except Exception:  # noqa: BLE001
                result_bytes = 0

            log_extra: dict[str, Any] = {
                "event": "tool_call",
                "tool": name,
                "duration_ms": duration_ms,
                "duration": duration_ms,
                "status": status,
                "result_size": result_bytes,
            }
            run_id = get_current_run_id()
            if run_id:
                log_extra["run_id"] = run_id
            step = get_current_step()
            if step is not None:
                log_extra["step"] = step

            if settings.log_payloads:
                log_extra["arguments"] = raw_args
                log_extra["payload"] = payload

            logger.info(
                "Tool %s executed in %.2fms (status=%s, size=%d bytes)",
                name,
                duration_ms,
                status,
                result_bytes,
                extra=log_extra,
            )
            return payload

        # Parse string arguments if received as JSON string from LLM
        parsed_args: dict[str, Any]
        if isinstance(arguments, str):
            try:
                parsed_args = json.loads(arguments) if arguments.strip() else {}
            except json.JSONDecodeError as err:
                return _finish(
                    "error",
                    {
                        "error": f"Invalid JSON arguments: {err}",
                        "status": "error",
                    },
                    raw_args=arguments,
                )
        else:
            parsed_args = arguments

        # 1. Local anomaly detection tool wired via MCP core contract
        if name == "detect_anomalies":
            if not self._detect_anomalies_enabled:
                return _finish(
                    "error",
                    {
                        "error": "detect_anomalies is disabled because the connected MCP server does not conform to the core telemetry contract.",
                        "status": "error",
                    },
                    raw_args=parsed_args,
                )
            try:
                validated_input = DetectAnomaliesInput.model_validate(parsed_args)
            except ValidationError as err:
                return _finish(
                    "error",
                    {
                        "error": f"Parameter validation error for tool '{name}': {err}",
                        "status": "error",
                    },
                    raw_args=parsed_args,
                )
            result = await handle_detect_anomalies_mcp(validated_input, self.mcp_client)
            return _finish(
                "ok",
                {
                    "status": "success",
                    "result": result,
                },
                raw_args=parsed_args,
            )

        # 2. Dynamic routing to MCP server
        try:
            mcp_res = await self.mcp_client.call_tool(name, parsed_args)
            if mcp_res.is_error:
                return _finish(
                    "error",
                    {
                        "error": mcp_res.text or "MCP tool execution error",
                        "status": "error",
                        "is_error": True,
                    },
                    raw_args=parsed_args,
                )
            return _finish(
                "ok",
                {
                    "status": "success",
                    "result": mcp_res.to_payload(),
                },
                raw_args=parsed_args,
            )
        except McpClientError as err:
            return _finish(
                "error",
                {
                    "error": f"MCP tool execution failed: {err}",
                    "status": "error",
                },
                raw_args=parsed_args,
            )
        except Exception as err:
            logger.exception("Unexpected error executing MCP tool %s", name)
            return _finish(
                "error",
                {
                    "error": f"Internal tool execution error: {err}",
                    "status": "error",
                },
                raw_args=parsed_args,
            )


def build_default_tool_registry(
    mcp_client: McpClient | None = None,
) -> ToolRegistry:
    registry = ToolRegistry(mcp_client=mcp_client)

    # Local analysis tools
    registry.register_local_tool(
        ToolDefinition(
            name="detect_anomalies",
            description="Execute deterministic statistical anomaly detection (peer deviations, spikes, flatlines, gaps) for a metric.",
            input_model=DetectAnomaliesInput,
        )
    )

    return registry


_default_registry: ToolRegistry | None = None


def get_tool_registry(
    mcp_client: McpClient | None = None,
) -> ToolRegistry:
    global _default_registry
    if _default_registry is None or (
        mcp_client is not None and _default_registry.mcp_client != mcp_client
    ):
        _default_registry = build_default_tool_registry(mcp_client=mcp_client)
    return _default_registry
