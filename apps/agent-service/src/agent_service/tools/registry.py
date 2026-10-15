import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError

from agent_service.analysis.anomalies import TelemetryPoint, detect_all_anomalies
from agent_service.clients.dashboard_api import DashboardApiClient, DashboardApiError
from agent_service.tools.schemas import (
    CompareDevicesInput,
    DetectAnomaliesInput,
    GetSeriesInput,
    GetStatsInput,
    ListDevicesInput,
    ListMetricsInput,
    resolve_time_range,
)

logger = logging.getLogger(__name__)

ToolHandler = Callable[[Any, DashboardApiClient], Awaitable[Any]]


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_model: type[BaseModel]
    handler: ToolHandler

    def to_openai_schema(self) -> dict[str, Any]:
        schema = self.input_model.model_json_schema()
        # Clean schema title and extra properties for OpenAI spec
        parameters = {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", []),
        }
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": parameters,
            },
        }


# --- Handlers ---


async def handle_list_metrics(
    params: ListMetricsInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    metrics = await client.get_metrics()
    return {"metrics": metrics}


async def handle_list_devices(
    params: ListDevicesInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    devices = await client.get_devices()
    return {"devices": devices}


async def handle_get_stats(
    params: GetStatsInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    from_ts, to_ts = resolve_time_range(params.from_ts, params.to_ts, params.range_preset)
    stats_data = await client.get_stats(
        metric=params.metric_key,
        devices=[params.device_id] if params.device_id else None,
        from_ts=from_ts,
        to_ts=to_ts,
        include_on_demand=params.include_on_demand,
    )
    return stats_data


async def handle_get_series(
    params: GetSeriesInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    from_ts, to_ts = resolve_time_range(params.from_ts, params.to_ts, params.range_preset)
    series_data = await client.get_series(
        metric=params.metric_key,
        devices=params.device_id,
        from_ts=from_ts,
        to_ts=to_ts,
        bucket=params.bucket,
        limit=params.limit,
        include_on_demand=params.include_on_demand,
    )
    return series_data


async def handle_compare_devices(
    params: CompareDevicesInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    from_ts, to_ts = resolve_time_range(params.from_ts, params.to_ts, params.range_preset)
    # Query stats for all devices
    raw_stats = await client.get_stats(
        metric=params.metric_key,
        devices=None,
        from_ts=from_ts,
        to_ts=to_ts,
        include_on_demand=params.include_on_demand,
    )

    stats_list = raw_stats.get("stats", [])
    device_summaries = []
    for item in stats_list:
        device_summaries.append({
            "device_id": item.get("device_id"),
            "mean": item.get("mean"),
            "std": item.get("std"),
            "min": item.get("min"),
            "max": item.get("max"),
            "count": item.get("count"),
        })

    return {
        "metric": raw_stats.get("metric", params.metric_key),
        "unit": raw_stats.get("unit", ""),
        "window": {"from": from_ts, "to": to_ts},
        "devices_count": len(device_summaries),
        "devices": device_summaries,
    }


async def handle_detect_anomalies(
    params: DetectAnomaliesInput,
    client: DashboardApiClient,
) -> dict[str, Any]:
    from_ts, to_ts = resolve_time_range(params.from_ts, params.to_ts, params.range_preset)
    # Fetch series points for all devices or specific device
    series_resp = await client.get_series(
        metric=params.metric_key,
        devices=params.device_id,
        from_ts=from_ts,
        to_ts=to_ts,
        bucket="5m",
        limit=200,
    )

    series_by_device: dict[str, list[TelemetryPoint]] = {}
    for device_entry in series_resp.get("series", []):
        dev_id = device_entry["device_id"]
        pts = [
            TelemetryPoint(ts=p["ts"], value=float(p["value"]))
            for p in device_entry.get("points", [])
        ]
        series_by_device[dev_id] = pts

    findings = detect_all_anomalies(series_by_device, metric_key=params.metric_key)

    return {
        "metric": params.metric_key,
        "window": {"from": from_ts, "to": to_ts},
        "anomalies_count": len(findings),
        "anomalies": [f.model_dump() for f in findings],
    }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def get_openai_tools(self) -> list[dict[str, Any]]:
        return [tool.to_openai_schema() for tool in self._tools.values()]

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any] | str,
        client: DashboardApiClient,
    ) -> dict[str, Any]:
        tool = self.get_tool(name)
        if not tool:
            return {
                "error": f"Unknown tool '{name}'. Available tools: {list(self._tools.keys())}",
                "status": "error",
            }

        # Parse string arguments if received as JSON string from LLM
        parsed_args: dict[str, Any]
        if isinstance(arguments, str):
            try:
                parsed_args = json.loads(arguments) if arguments.strip() else {}
            except json.JSONDecodeError as err:
                return {
                    "error": f"Invalid JSON arguments: {err}",
                    "status": "error",
                }
        else:
            parsed_args = arguments

        try:
            validated_input = tool.input_model.model_validate(parsed_args)
        except ValidationError as err:
            return {
                "error": f"Parameter validation error for tool '{name}': {err}",
                "status": "error",
            }

        try:
            result = await tool.handler(validated_input, client)
            return {
                "status": "success",
                "result": result,
            }
        except DashboardApiError as err:
            return {
                "error": f"Dashboard API query failed: {err.message}",
                "status_code": err.status_code,
                "status": "error",
            }
        except Exception as err:
            logger.exception("Unexpected error executing tool %s", name)
            return {
                "error": f"Internal tool execution error: {err}",
                "status": "error",
            }


def build_default_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="list_metrics",
            description="Retrieve catalogue of all available telemetry metrics and their physical units.",
            input_model=ListMetricsInput,
            handler=handle_list_metrics,
        )
    )
    registry.register(
        ToolDefinition(
            name="list_devices",
            description="Retrieve list of all active registered IoT device board identifiers (e.g. 'esp32c6').",
            input_model=ListDevicesInput,
            handler=handle_list_devices,
        )
    )
    registry.register(
        ToolDefinition(
            name="get_stats",
            description="Retrieve statistical summaries (min, max, mean, std, count) for a metric and optional device over a time window.",
            input_model=GetStatsInput,
            handler=handle_get_stats,
        )
    )
    registry.register(
        ToolDefinition(
            name="get_series",
            description="Retrieve downsampled time-series data points for a specific device and metric.",
            input_model=GetSeriesInput,
            handler=handle_get_series,
        )
    )
    registry.register(
        ToolDefinition(
            name="compare_devices",
            description="Retrieve comparative statistical summaries across all devices for a given metric and time window.",
            input_model=CompareDevicesInput,
            handler=handle_compare_devices,
        )
    )
    registry.register(
        ToolDefinition(
            name="detect_anomalies",
            description="Execute deterministic statistical anomaly detection (peer deviations, spikes, flatlines, gaps) for a metric.",
            input_model=DetectAnomaliesInput,
            handler=handle_detect_anomalies,
        )
    )
    return registry


_default_registry: ToolRegistry | None = None


def get_tool_registry() -> ToolRegistry:
    global _default_registry
    if _default_registry is None:
        _default_registry = build_default_tool_registry()
    return _default_registry
