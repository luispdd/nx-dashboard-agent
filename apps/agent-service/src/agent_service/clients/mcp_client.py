"""MCP client module connecting to Streamable HTTP endpoints."""

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Self

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import CallToolResult, Tool

from agent_service.config import settings
from agent_service.context import get_current_run_id

logger = logging.getLogger(__name__)


class McpClientError(Exception):
    """Base exception for MCP client errors."""


class McpConnectionError(McpClientError):
    """Raised when connection to an MCP server fails."""


class McpTimeoutError(McpClientError):
    """Raised when an MCP operation times out."""


@dataclass
class DiscoveredToolsResult:
    tools: list[Tool]
    instructions: str | None = None


@dataclass
class McpToolResult:
    content: list[Any] = field(default_factory=list)
    is_error: bool = False
    structured_content: dict[str, Any] | None = None

    @property
    def text(self) -> str:
        parts: list[str] = []
        for item in self.content:
            if hasattr(item, "text"):
                parts.append(str(item.text))
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "\n".join(parts)

    def to_payload(self) -> Any:
        """Returns structured content if present, or parsed JSON if text is valid JSON, or raw text."""
        if self.structured_content is not None:
            return self.structured_content
        t = self.text.strip()
        if (t.startswith("{") and t.endswith("}")) or (
            t.startswith("[") and t.endswith("]")
        ):
            try:
                return json.loads(t)
            except json.JSONDecodeError:
                pass
        return t


def _find_exception(
    err: BaseException,
    target_type: type[BaseException] | tuple[type[BaseException], ...],
) -> BaseException | None:
    if isinstance(err, target_type):
        return err
    if isinstance(err, BaseExceptionGroup):
        for sub in err.exceptions:
            found = _find_exception(sub, target_type)
            if found:
                return found
    return None


class McpClient:
    """Client for connecting to a Model Context Protocol (MCP) server via Streamable HTTP."""

    def __init__(
        self,
        url: str | None = None,
        auth_token: str | None = None,
        timeout: float | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.url = url or (
            settings.mcp_server_urls.split(",")[0].strip()
            if settings.mcp_server_urls
            else "http://localhost:3000/api/mcp"
        )
        self.auth_token = (
            auth_token if auth_token is not None else settings.mcp_auth_token
        )
        self.timeout = (
            timeout if timeout is not None else settings.mcp_call_timeout_seconds
        )
        self._custom_client = client
        self._active_session: ClientSession | None = None
        self._server_instructions: str | None = None
        self._exit_stack: contextlib.AsyncExitStack | None = None

    def _get_headers(
        self, custom_headers: dict[str, str] | None = None
    ) -> dict[str, str]:
        headers = dict(custom_headers or {})
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        run_id = get_current_run_id()
        if run_id:
            headers["x-request-id"] = run_id
        return headers

    @asynccontextmanager
    async def connect(self) -> AsyncIterator[ClientSession]:
        """Establish a connection and session to the MCP server."""
        headers = self._get_headers()
        http_client = self._custom_client or httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
        )
        should_close_http = self._custom_client is None

        try:
            try:
                async with (
                    streamable_http_client(self.url, http_client=http_client) as (
                        read_stream,
                        write_stream,
                    ),
                    ClientSession(
                        read_stream,
                        write_stream,
                        read_timeout_seconds=self.timeout,
                    ) as session,
                ):
                    init_res = await session.initialize()
                    if init_res.instructions:
                        self._server_instructions = init_res.instructions
                    self._active_session = session
                    try:
                        yield session
                    finally:
                        self._active_session = None
            except TimeoutError as err:
                raise McpTimeoutError(
                    f"Connection or operation timed out after {self.timeout}s: {err}"
                ) from err
            except httpx.TimeoutException as err:
                raise McpTimeoutError(
                    f"HTTP request timed out after {self.timeout}s: {err}"
                ) from err
            except (httpx.ConnectError, httpx.NetworkError, ConnectionError) as err:
                raise McpConnectionError(
                    f"Failed to connect to MCP server at {self.url}: {err}"
                ) from err
            except Exception as err:
                timeout_err = _find_exception(
                    err, (TimeoutError, httpx.TimeoutException, McpTimeoutError)
                )
                if timeout_err:
                    raise McpTimeoutError(
                        f"Operation timed out: {timeout_err}"
                    ) from err
                mcp_client_err = _find_exception(err, McpClientError)
                if mcp_client_err:
                    raise mcp_client_err
                if "timed out" in str(err).lower():
                    raise McpTimeoutError(f"Operation timed out: {err}") from err
                raise McpConnectionError(
                    f"MCP server communication error at {self.url}: {err}"
                ) from err
        finally:
            if should_close_http:
                await http_client.aclose()

    async def __aenter__(self) -> Self:
        self._exit_stack = contextlib.AsyncExitStack()
        await self._exit_stack.__aenter__()
        await self._exit_stack.enter_async_context(self.connect())
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        if self._exit_stack is not None:
            await self._exit_stack.__aexit__(exc_type, exc_val, exc_tb)
            self._exit_stack = None

    async def list_tools(self) -> DiscoveredToolsResult:
        """Discovers tools and returns the tool definitions along with server instructions."""
        if self._active_session is not None:
            try:
                async with asyncio.timeout(self.timeout):
                    res = await self._active_session.list_tools()
                    return DiscoveredToolsResult(
                        tools=list(res.tools),
                        instructions=self._server_instructions,
                    )
            except TimeoutError as err:
                raise McpTimeoutError(
                    f"Listing tools timed out after {self.timeout}s"
                ) from err
            except Exception as err:
                raise McpClientError(
                    f"Failed to list tools from MCP server at {self.url}: {err}"
                ) from err

        async with self.connect() as session:
            try:
                async with asyncio.timeout(self.timeout):
                    res = await session.list_tools()
                    return DiscoveredToolsResult(
                        tools=list(res.tools),
                        instructions=self._server_instructions,
                    )
            except TimeoutError as err:
                raise McpTimeoutError(
                    f"Listing tools timed out after {self.timeout}s"
                ) from err
            except Exception as err:
                raise McpClientError(
                    f"Failed to list tools from MCP server at {self.url}: {err}"
                ) from err

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any] | None = None,
    ) -> McpToolResult:
        """Executes a tool on the MCP server and returns the result."""
        args = arguments or {}

        if self._active_session is not None:
            try:
                async with asyncio.timeout(self.timeout):
                    res: CallToolResult = await self._active_session.call_tool(
                        name=name, arguments=args
                    )
                    return McpToolResult(
                        content=list(res.content),
                        is_error=bool(res.is_error),
                        structured_content=res.structured_content,
                    )
            except TimeoutError as err:
                raise McpTimeoutError(
                    f"Tool call '{name}' timed out after {self.timeout}s"
                ) from err
            except Exception as err:
                raise McpClientError(
                    f"Tool call '{name}' failed at {self.url}: {err}"
                ) from err

        async with self.connect() as session:
            try:
                async with asyncio.timeout(self.timeout):
                    res: CallToolResult = await session.call_tool(
                        name=name, arguments=args
                    )
                    return McpToolResult(
                        content=list(res.content),
                        is_error=bool(res.is_error),
                        structured_content=res.structured_content,
                    )
            except TimeoutError as err:
                raise McpTimeoutError(
                    f"Tool call '{name}' timed out after {self.timeout}s"
                ) from err
            except Exception as err:
                raise McpClientError(
                    f"Tool call '{name}' failed at {self.url}: {err}"
                ) from err
