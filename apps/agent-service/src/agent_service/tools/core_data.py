"""Core telemetry contract validation and windowed series fetching for anomaly detection."""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from mcp.types import Tool

from agent_service.analysis.anomalies import TelemetryPoint, detect_all_anomalies
from agent_service.clients.mcp_client import McpClient, McpClientError
from agent_service.config import find_repo_root
from agent_service.tools.schemas import DetectAnomaliesInput, resolve_time_range

logger = logging.getLogger(__name__)

CONTRACT_PATH = find_repo_root() / "docs" / "contracts" / "mcp-core-contract.json"
DEFAULT_WINDOW_HOURS = 40.0


def validate_core_contract(tools: list[Tool] | list[dict[str, Any]]) -> bool:
    """Validates that discovered tools conform to the MCP core telemetry contract.

    Specifically checks for list_metrics and get_series with required parameter definitions.
    Returns True if valid, or False with a warning log if missing or invalid.
    """
    tools_by_name: dict[str, Any] = {}
    for t in tools:
        name = t.name if hasattr(t, "name") else t.get("name")
        if name:
            tools_by_name[name] = t

    # Check existence of core tools
    if "list_metrics" not in tools_by_name:
        logger.warning(
            "Core MCP contract validation failed: 'list_metrics' tool not found in discovered tools."
        )
        return False

    if "get_series" not in tools_by_name:
        logger.warning(
            "Core MCP contract validation failed: 'get_series' tool not found in discovered tools."
        )
        return False

    get_series_tool = tools_by_name["get_series"]
    input_schema = (
        getattr(get_series_tool, "input_schema", {})
        if hasattr(get_series_tool, "input_schema")
        else (
            get_series_tool.get("input_schema")
            or get_series_tool.get("inputSchema")
            or {}
        )
    )

    properties = (
        input_schema.get("properties", {}) if isinstance(input_schema, dict) else {}
    )
    required = (
        input_schema.get("required", []) if isinstance(input_schema, dict) else []
    )

    if "metric_key" not in properties or "metric_key" not in required:
        logger.warning(
            "Core MCP contract validation failed: 'get_series' schema missing required 'metric_key'."
        )
        return False

    # Check contract file if present
    if CONTRACT_PATH.is_file():
        try:
            with open(CONTRACT_PATH, encoding="utf-8") as f:
                contract = json.load(f)
            expected_tools = contract.get("tools", {})
            for tool_name in ("list_metrics", "get_series"):
                if tool_name not in expected_tools:
                    logger.warning(
                        "Core contract definition in %s missing expected tool '%s'.",
                        CONTRACT_PATH,
                        tool_name,
                    )
        except Exception as err:  # noqa: BLE001
            logger.warning(
                "Failed to parse core contract file %s: %s", CONTRACT_PATH, err
            )

    return True


async def fetch_windowed_series(
    client: McpClient,
    metric_key: str,
    from_ts: str | None = None,
    to_ts: str | None = None,
    device_id: str | None = None,
    bucket: str = "5m",
    max_chunk_hours: float = DEFAULT_WINDOW_HOURS,
) -> dict[str, list[TelemetryPoint]]:
    """Fetches full-resolution series data across a time range using windowed requests under the point cap.

    Prevents automatic server-side bucket promotion by bounding each chunk to <= max_chunk_hours
    (default 40h = 480 points at 5m bucket, below the 500 cap).
    If from_ts or to_ts are not provided, executes a single bounded call.
    """
    if not from_ts or not to_ts:
        arguments: dict[str, Any] = {
            "metric_key": metric_key,
            "bucket": bucket,
            "limit": 500,
        }
        if from_ts:
            arguments["from"] = from_ts
        if to_ts:
            arguments["to"] = to_ts
        if device_id:
            arguments["device_id"] = device_id

        res = await client.call_tool("get_series", arguments)
        if res.is_error:
            logger.warning(
                "MCP get_series error without full time range: %s",
                res.text,
            )
            return {}

        payload = res.to_payload()
        if not isinstance(payload, dict):
            return {}

        result_unbounded: dict[str, list[TelemetryPoint]] = {}
        for entry in payload.get("series", []):
            dev = entry.get("device_id")
            if not dev:
                continue
            pts = [
                TelemetryPoint(ts=pt["ts"], value=float(pt["value"]))
                for pt in entry.get("points", [])
                if pt.get("value") is not None and pt.get("ts")
            ]
            result_unbounded[dev] = pts
        return result_unbounded

    clean_from = from_ts.replace("Z", "+00:00")
    clean_to = to_ts.replace("Z", "+00:00")
    start_dt = datetime.fromisoformat(clean_from).astimezone(UTC)
    end_dt = datetime.fromisoformat(clean_to).astimezone(UTC)

    if start_dt > end_dt:
        return {}

    chunk_delta = timedelta(hours=max_chunk_hours)
    current_start = start_dt
    raw_points_by_device: dict[str, dict[str, float]] = {}

    while current_start < end_dt:
        current_end = min(current_start + chunk_delta, end_dt)
        chunk_from = current_start.strftime("%Y-%m-%dT%H:%M:%SZ")
        chunk_to = current_end.strftime("%Y-%m-%dT%H:%M:%SZ")

        arguments: dict[str, Any] = {
            "metric_key": metric_key,
            "from": chunk_from,
            "to": chunk_to,
            "bucket": bucket,
            "limit": 500,
        }
        if device_id:
            arguments["device_id"] = device_id

        res = await client.call_tool("get_series", arguments)
        if res.is_error:
            logger.warning(
                "MCP get_series error during windowed fetch [%s, %s]: %s",
                chunk_from,
                chunk_to,
                res.text,
            )
            break

        payload = res.to_payload()
        if not isinstance(payload, dict):
            break

        series_list = payload.get("series", [])
        for entry in series_list:
            dev = entry.get("device_id")
            if not dev:
                continue
            if dev not in raw_points_by_device:
                raw_points_by_device[dev] = {}

            for pt in entry.get("points", []):
                val = pt.get("value")
                ts = pt.get("ts")
                if val is not None and ts:
                    raw_points_by_device[dev][ts] = float(val)

        current_start = current_end

    result: dict[str, list[TelemetryPoint]] = {}
    for dev, pts_dict in raw_points_by_device.items():
        sorted_points = [
            TelemetryPoint(ts=ts, value=val)
            for ts, val in sorted(pts_dict.items(), key=lambda item: item[0])
        ]
        result[dev] = sorted_points

    return result


async def handle_detect_anomalies_mcp(
    params: DetectAnomaliesInput,
    client: McpClient,
) -> dict[str, Any]:
    """Anomaly detection handler executing against MCP server using windowed series fetching."""
    from_ts, to_ts = resolve_time_range(
        params.from_ts, params.to_ts, params.range_preset
    )

    try:
        series_by_device = await fetch_windowed_series(
            client=client,
            metric_key=params.metric_key,
            from_ts=from_ts,
            to_ts=to_ts,
            device_id=params.device_id,
            bucket="5m",
        )
    except McpClientError as err:
        logger.warning("Failed to fetch series for anomaly detection via MCP: %s", err)
        return {
            "metric": params.metric_key,
            "window": {"from": from_ts, "to": to_ts},
            "anomalies_count": 0,
            "anomalies": [],
            "error": f"Failed to retrieve telemetry series: {err}",
        }

    findings = detect_all_anomalies(series_by_device, metric_key=params.metric_key)

    return {
        "metric": params.metric_key,
        "window": {"from": from_ts, "to": to_ts},
        "anomalies_count": len(findings),
        "anomalies": [f.model_dump() for f in findings],
    }
