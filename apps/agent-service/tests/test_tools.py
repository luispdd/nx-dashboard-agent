from datetime import UTC, datetime

import httpx
import pytest
from pydantic import ValidationError

from agent_service.clients.dashboard_api import DashboardApiClient
from agent_service.tools.registry import (
    build_default_tool_registry,
    get_tool_registry,
)
from agent_service.tools.schemas import (
    GetStatsInput,
    resolve_time_range,
    validate_iso_utc_timestamp,
)


def test_timestamp_validation_and_resolution() -> None:
    # Valid ISO UTC
    valid_ts = "2026-10-14T08:30:00Z"
    assert validate_iso_utc_timestamp(valid_ts) == valid_ts

    # Missing Z suffix
    with pytest.raises(ValueError, match="must be in ISO-8601 UTC format"):
        validate_iso_utc_timestamp("2026-10-14T08:30:00")

    # Range presets
    fixed_now = datetime(2026, 10, 15, 12, 0, 0, tzinfo=UTC)
    from_24h, to_24h = resolve_time_range(range_preset="last_24h", now_utc=fixed_now)
    assert from_24h == "2026-10-14T12:00:00Z"
    assert to_24h == "2026-10-15T12:00:00Z"

    from_7d, _ = resolve_time_range(range_preset="last_7d", now_utc=fixed_now)
    assert from_7d == "2026-10-08T12:00:00Z"


def test_schema_forbid_extra_fields() -> None:
    # Disallows unexpected fields
    with pytest.raises(ValidationError):
        GetStatsInput.model_validate({
            "metric_key": "temperature",
            "device_id": "esp32c6",
            "unexpected_field": "disallowed",
        })


def test_openai_tool_schemas() -> None:
    registry = get_tool_registry()
    schemas = registry.get_openai_tools()
    assert len(schemas) == 6
    tool_names = [s["function"]["name"] for s in schemas]
    assert "list_metrics" in tool_names
    assert "list_devices" in tool_names
    assert "get_stats" in tool_names
    assert "get_series" in tool_names
    assert "compare_devices" in tool_names
    assert "detect_anomalies" in tool_names


@pytest.mark.asyncio
async def test_tool_execution_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/metrics":
            return httpx.Response(200, json=[{"metric": "temperature", "unit": "°C"}])
        if path == "/api/devices":
            return httpx.Response(200, json=["esp32c6", "esp32s3"])
        if path == "/api/stats":
            return httpx.Response(
                200,
                json={
                    "metric": "temperature",
                    "unit": "°C",
                    "stats": [
                        {
                            "device_id": "esp32c6",
                            "min": 18.0,
                            "max": 24.0,
                            "mean": 21.0,
                            "std": 1.5,
                            "count": 288,
                            "missing_ratio": 0.0,
                        }
                    ],
                },
            )
        if path == "/api/series":
            return httpx.Response(
                200,
                json={
                    "metric": "temperature",
                    "unit": "°C",
                    "bucket": "5m",
                    "series": [
                        {
                            "device_id": "esp32c6",
                            "points": [{"ts": "2026-10-14T00:00:00Z", "value": 21.0}],
                        }
                    ],
                },
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test") as raw_client:
        client = DashboardApiClient(client=raw_client)
        registry = build_default_tool_registry()

        # 1. list_metrics
        res = await registry.execute("list_metrics", {}, client)
        assert res["status"] == "success"
        assert res["result"]["metrics"][0]["metric"] == "temperature"

        # 2. list_devices
        res = await registry.execute("list_devices", {}, client)
        assert res["status"] == "success"
        assert "esp32c6" in res["result"]["devices"]

        # 3. get_stats
        res = await registry.execute(
            "get_stats",
            {
                "metric_key": "temperature",
                "device_id": "esp32c6",
                "from_ts": "2026-10-14T00:00:00Z",
                "to_ts": "2026-10-14T23:59:59Z",
            },
            client,
        )
        assert res["status"] == "success"
        assert res["result"]["stats"][0]["mean"] == 21.0

        # 4. compare_devices
        res = await registry.execute(
            "compare_devices",
            {
                "metric_key": "temperature",
                "from_ts": "2026-10-14T00:00:00Z",
                "to_ts": "2026-10-14T23:59:59Z",
            },
            client,
        )
        assert res["status"] == "success"
        assert res["result"]["metric"] == "temperature"
        assert len(res["result"]["devices"]) == 1

        # 5. get_series
        res = await registry.execute(
            "get_series",
            {
                "metric_key": "temperature",
                "device_id": "esp32c6",
                "bucket": "5m",
                "limit": 10,
            },
            client,
        )
        assert res["status"] == "success"
        assert len(res["result"]["series"]) == 1

        # 6. detect_anomalies
        res = await registry.execute(
            "detect_anomalies",
            {
                "metric_key": "temperature",
                "from_ts": "2026-10-14T00:00:00Z",
                "to_ts": "2026-10-14T23:59:59Z",
            },
            client,
        )
        assert res["status"] == "success"
        assert "anomalies" in res["result"]


@pytest.mark.asyncio
async def test_tool_execution_errors() -> None:
    client = DashboardApiClient(base_url="http://invalid")
    registry = build_default_tool_registry()

    # Unknown tool
    res = await registry.execute("non_existent_tool", {}, client)
    assert res["status"] == "error"
    assert "Unknown tool" in res["error"]

    # Parameter validation error
    res = await registry.execute("get_stats", {"unexpected": "foo"}, client)
    assert res["status"] == "error"
    assert "Parameter validation error" in res["error"]

    # Invalid JSON string argument
    res = await registry.execute("get_stats", "{invalid_json", client)
    assert res["status"] == "error"
    assert "Invalid JSON arguments" in res["error"]
