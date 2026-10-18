"""Unit test verifying that detect_anomalies via core_data.py achieves 100% parity with baseline."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from mcp import types
from mcp.server.lowlevel import Server

from agent_service.analysis.anomalies import (
    TelemetryPoint,
    detect_all_anomalies,
)
from agent_service.clients.mcp_client import McpClient
from agent_service.tools.core_data import (
    handle_detect_anomalies_mcp,
    validate_core_contract,
)
from agent_service.tools.schemas import DetectAnomaliesInput


def generate_synthetic_telemetry(
    base_time: datetime,
) -> tuple[dict[str, list[TelemetryPoint]], dict[str, list[TelemetryPoint]]]:
    devices = ["esp32c6", "esp32s3", "esp32node1"]
    temp_series: dict[str, list[TelemetryPoint]] = {d: [] for d in devices}
    hum_series: dict[str, list[TelemetryPoint]] = {d: [] for d in devices}

    # 6 days with 5-minute interval = 1728 points per device (exceeds 500 point cap)
    total_steps = (6 * 24 * 60) // 5
    flatline_temp = 22.5

    for step in range(total_steps):
        mins = step * 5
        current_time = base_time + timedelta(minutes=mins)
        ts_iso = current_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        for dev in devices:
            # Injected Gap on esp32c6: 5760 to 5940 mins
            if dev == "esp32c6" and 5760 <= mins < 5940:
                continue

            # Base values
            t_val = 20.0 + (step % 12) * 0.1
            h_val = 50.0 + (step % 10) * 0.2

            # Injected Peer deviation on esp32c6: 1440 to 1800 mins (+8.5)
            if dev == "esp32c6" and 1440 <= mins < 1800:
                t_val += 8.5

            # Injected Spike on esp32s3 at exactly 2880 mins
            if dev == "esp32s3" and mins == 2880:
                h_val += 40.0

            # Injected Flatline on esp32node1: 4320 to 5040 mins
            if dev == "esp32node1" and 4320 <= mins < 5040:
                t_val = flatline_temp

            temp_series[dev].append(TelemetryPoint(ts=ts_iso, value=round(t_val, 2)))
            hum_series[dev].append(TelemetryPoint(ts=ts_iso, value=round(h_val, 2)))

    return temp_series, hum_series


@pytest.mark.asyncio
async def test_anomaly_detection_mcp_windowed_parity():
    base_time = datetime(2026, 10, 5, 0, 0, 0, tzinfo=UTC)
    temp_series, hum_series = generate_synthetic_telemetry(base_time)
    end_time = base_time + timedelta(minutes=((6 * 24 * 60) // 5) * 5)
    from_iso = base_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    to_iso = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1. Compute baseline anomalies directly from in-memory arrays
    baseline_temp_anomalies = detect_all_anomalies(
        temp_series, metric_key="temperature"
    )
    baseline_hum_anomalies = detect_all_anomalies(hum_series, metric_key="humidity")

    assert len(baseline_temp_anomalies) > 0
    assert len(baseline_hum_anomalies) > 0

    # 2. Setup mock MCP server exposing list_metrics and get_series with 500 point cap
    server = Server("mock-telemetry-server")

    async def list_tools_handler(context, params):
        return types.ListToolsResult(
            tools=[
                types.Tool(
                    name="list_metrics",
                    description="List telemetry metrics",
                    inputSchema={"type": "object", "properties": {}},
                ),
                types.Tool(
                    name="get_series",
                    description="Get telemetry series points bounded by cap",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "metric_key": {"type": "string"},
                            "from": {"type": "string"},
                            "to": {"type": "string"},
                            "device_id": {"type": "string"},
                            "bucket": {"type": "string"},
                            "limit": {"type": "integer"},
                        },
                        "required": ["metric_key"],
                    },
                ),
            ]
        )

    async def call_tool_handler(context, params):
        args = params.arguments or {}
        tool_name = params.name

        if tool_name == "list_metrics":
            data = {
                "metrics": [
                    {"metric_key": "temperature", "unit": "°C"},
                    {"metric_key": "humidity", "unit": "%"},
                ]
            }
            return types.CallToolResult(
                content=[types.TextContent(type="text", text=json.dumps(data))]
            )

        if tool_name == "get_series":
            metric_key = args.get("metric_key")
            start = args.get("from")
            end = args.get("to")
            device_id = args.get("device_id")
            bucket = args.get("bucket", "5m")
            limit = args.get("limit", 500)

            dataset = temp_series if metric_key == "temperature" else hum_series
            series_res = []

            devices_to_query = [device_id] if device_id else list(dataset.keys())
            for dev in devices_to_query:
                points = dataset.get(dev, [])
                filtered = []
                for p in points:
                    if start and p.ts < start:
                        continue
                    if end and p.ts > end:
                        continue
                    filtered.append({"ts": p.ts, "value": p.value})
                    if len(filtered) >= limit:
                        break

                series_res.append({"device_id": dev, "points": filtered})

            data = {
                "metric": metric_key,
                "unit": "°C" if metric_key == "temperature" else "%",
                "bucket": bucket,
                "truncated": any(len(s["points"]) >= limit for s in series_res),
                "series": series_res,
            }
            return types.CallToolResult(
                content=[types.TextContent(type="text", text=json.dumps(data))]
            )

        return types.CallToolResult(
            is_error=True,
            content=[types.TextContent(type="text", text=f"Unknown tool: {tool_name}")],
        )

    server.add_request_handler(
        "tools/list", types.PaginatedRequestParams, list_tools_handler
    )
    server.add_request_handler(
        "tools/call", types.CallToolRequestParams, call_tool_handler
    )

    app = server.streamable_http_app(stateless_http=True, host="127.0.0.1")

    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://127.0.0.1:8000",
        ) as http_client,
    ):
        mcp_client = McpClient(
            url="http://127.0.0.1:8000/mcp",
            client=http_client,
        )

        # Verify core contract validation passes
        discovered = await mcp_client.list_tools()
        assert validate_core_contract(discovered.tools) is True

        # Run temperature anomaly detection through windowed MCP client
        temp_input = DetectAnomaliesInput(
            metric_key="temperature",
            from_ts=from_iso,
            to_ts=to_iso,
        )
        mcp_temp_res = await handle_detect_anomalies_mcp(temp_input, mcp_client)

        # Run humidity anomaly detection through windowed MCP client
        hum_input = DetectAnomaliesInput(
            metric_key="humidity",
            from_ts=from_iso,
            to_ts=to_iso,
        )
        mcp_hum_res = await handle_detect_anomalies_mcp(hum_input, mcp_client)

    # 3. Assert exact anomaly count parity
    assert mcp_temp_res["anomalies_count"] == len(baseline_temp_anomalies)
    assert mcp_hum_res["anomalies_count"] == len(baseline_hum_anomalies)

    # 4. Assert exact anomaly content parity
    baseline_temp_tuples = [
        (a.device_id, a.type, a.severity, a.window.from_ts, a.window.to_ts)
        for a in baseline_temp_anomalies
    ]
    mcp_temp_tuples = [
        (
            a["device_id"],
            a["type"],
            a["severity"],
            a["window"]["from_ts"],
            a["window"]["to_ts"],
        )
        for a in mcp_temp_res["anomalies"]
    ]
    assert sorted(mcp_temp_tuples) == sorted(baseline_temp_tuples)

    baseline_hum_tuples = [
        (a.device_id, a.type, a.severity, a.window.from_ts, a.window.to_ts)
        for a in baseline_hum_anomalies
    ]
    mcp_hum_tuples = [
        (
            a["device_id"],
            a["type"],
            a["severity"],
            a["window"]["from_ts"],
            a["window"]["to_ts"],
        )
        for a in mcp_hum_res["anomalies"]
    ]
    assert sorted(mcp_hum_tuples) == sorted(baseline_hum_tuples)
