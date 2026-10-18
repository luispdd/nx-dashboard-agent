"""Unit tests for McpClient and ToolRegistry with in-process fake MCP server fixture."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
import pytest
from mcp.server.mcpserver import MCPServer

from agent_service.clients.mcp_client import (
    McpClient,
    McpConnectionError,
    McpTimeoutError,
)
from agent_service.tools.registry import ToolDefinition, ToolRegistry
from agent_service.tools.schemas import DetectAnomaliesInput


@pytest.fixture
def fake_mcp_server() -> MCPServer:
    server = MCPServer(
        "mock-mcp-server",
        instructions="Instructions from mock server for data analysis.",
    )

    @server.tool("echo")
    def echo_tool(message: str) -> str:
        return f"Echo: {message}"

    @server.tool("error_tool")
    def error_tool() -> str:
        raise ValueError("Simulated failure inside tool")

    @server.tool("slow_tool")
    async def slow_tool(delay: float = 0.5) -> str:
        await asyncio.sleep(delay)
        return "Finished slow tool"

    @server.tool("large_output_tool")
    def large_output_tool() -> str:
        return "x" * 1000

    return server


@asynccontextmanager
async def start_fake_mcp(
    server: MCPServer, timeout: float = 5.0
) -> AsyncIterator[McpClient]:
    app = server.streamable_http_app(stateless_http=True, host="127.0.0.1")
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://127.0.0.1:8000",
        ) as http_client,
    ):
        yield McpClient(
            url="http://127.0.0.1:8000/mcp",
            timeout=timeout,
            client=http_client,
        )


@pytest.mark.asyncio
async def test_tool_discovery_and_server_instructions(
    fake_mcp_server: MCPServer,
):
    async with start_fake_mcp(fake_mcp_server) as client:
        discovered = await client.list_tools()
        assert len(discovered.tools) >= 4
        tool_names = [t.name for t in discovered.tools]
        assert "echo" in tool_names
        assert "error_tool" in tool_names
        assert (
            discovered.instructions
            == "Instructions from mock server for data analysis."
        )


@pytest.mark.asyncio
async def test_registry_integration_and_call_routing(
    fake_mcp_server: MCPServer,
):
    async with start_fake_mcp(fake_mcp_server) as client:
        registry = ToolRegistry(
            backend="mcp",
            mcp_client=client,
            max_result_chars=500,
        )
        tools = await registry.ensure_tools()
        assert any(t["function"]["name"] == "echo" for t in tools)
        assert (
            registry.get_server_instructions()
            == "Instructions from mock server for data analysis."
        )

        # Call echo tool successfully
        res = await registry.execute("echo", {"message": "hello world"})
        assert res["status"] == "success"
        result_payload = res["result"]
        if isinstance(result_payload, dict):
            assert result_payload.get("result") == "Echo: hello world"
        else:
            assert result_payload == "Echo: hello world"


@pytest.mark.asyncio
async def test_registry_tool_error_handling(fake_mcp_server: MCPServer):
    async with start_fake_mcp(fake_mcp_server) as client:
        registry = ToolRegistry(backend="mcp", mcp_client=client)
        await registry.ensure_tools()

        # Call error tool; should return feedback without crashing
        res = await registry.execute("error_tool", {})
        assert res["status"] == "error"
        assert res.get("is_error") is True
        assert "error_tool" in res.get("error", "").lower()


@pytest.mark.asyncio
async def test_registry_result_truncation(fake_mcp_server: MCPServer):
    async with start_fake_mcp(fake_mcp_server) as client:
        registry = ToolRegistry(
            backend="mcp",
            mcp_client=client,
            max_result_chars=100,
        )
        await registry.ensure_tools()

        res = await registry.execute("large_output_tool", {})
        assert res.get("truncated") is True
        assert "[Result truncated to 100 characters]" in res["result"]


@pytest.mark.asyncio
async def test_collision_detection_raises_fatal_error(
    fake_mcp_server: MCPServer,
):
    @fake_mcp_server.tool("detect_anomalies")
    def conflicting_tool() -> str:
        return "conflict"

    async with start_fake_mcp(fake_mcp_server) as client:
        registry = ToolRegistry(backend="mcp", mcp_client=client)

        async def dummy_handler(*args):
            return {}

        registry.register_local_tool(
            ToolDefinition(
                name="detect_anomalies",
                description="Local tool",
                input_model=DetectAnomaliesInput,
                handler=dummy_handler,
            )
        )

        with pytest.raises(
            ValueError,
            match="Tool name collision detected: tool 'detect_anomalies'",
        ):
            await registry.ensure_tools()


@pytest.mark.asyncio
async def test_mcp_timeout_handling(fake_mcp_server: MCPServer):
    async with start_fake_mcp(fake_mcp_server, timeout=0.1) as client:
        with pytest.raises(McpTimeoutError):
            await client.call_tool("slow_tool", {"delay": 0.5})


@pytest.mark.asyncio
async def test_graceful_outage_reuse_cache():
    # Setup client pointing to non-existent server
    client = McpClient(url="http://127.0.0.1:9999/mcp", timeout=0.1)
    registry = ToolRegistry(backend="mcp", mcp_client=client)

    # Pre-populate cache
    registry._cached_openai_tools = [
        {"type": "function", "function": {"name": "cached_tool"}}
    ]
    registry._last_refresh_time = 1.0  # Expired cache

    # Refresh should fail but reuse cached tools with warning
    tools = await registry.ensure_tools()
    assert len(tools) == 1
    assert tools[0]["function"]["name"] == "cached_tool"


@pytest.mark.asyncio
async def test_graceful_outage_no_cache_raises():
    client = McpClient(url="http://127.0.0.1:9999/mcp", timeout=0.1)
    registry = ToolRegistry(backend="mcp", mcp_client=client)

    with pytest.raises(McpConnectionError):
        await registry.ensure_tools()
