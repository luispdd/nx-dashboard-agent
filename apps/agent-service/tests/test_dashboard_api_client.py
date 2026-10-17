import httpx
import pytest

from agent_service.clients.dashboard_api import DashboardApiClient, DashboardApiError


@pytest.mark.asyncio
async def test_get_metrics_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/metrics"
        data = [
            {"metric": "temperature", "unit": "°C"},
            {"metric": "humidity", "unit": "%"},
        ]
        return httpx.Response(200, json=data)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        client = DashboardApiClient(client=raw_client)
        metrics = await client.get_metrics()
        assert len(metrics) == 2
        assert metrics[0]["metric"] == "temperature"


@pytest.mark.asyncio
async def test_get_devices_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/devices"
        return httpx.Response(200, json=["esp32c6", "esp32s3", "esp32node1"])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        client = DashboardApiClient(client=raw_client)
        devices = await client.get_devices()
        assert devices == ["esp32c6", "esp32s3", "esp32node1"]


@pytest.mark.asyncio
async def test_get_stats_parameters() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/stats"
        assert request.url.params["metric"] == "temperature"
        assert request.url.params["devices"] == "esp32c6,esp32s3"
        assert request.url.params["from"] == "2026-10-14T00:00:00Z"
        assert request.url.params["to"] == "2026-10-14T23:59:59Z"
        assert request.url.params["include_on_demand"] == "true"

        data = {
            "metric": "temperature",
            "unit": "°C",
            "stats": [
                {
                    "device_id": "esp32c6",
                    "min": 18.2,
                    "max": 24.5,
                    "mean": 21.4,
                    "std": 1.8,
                    "count": 288,
                    "missing_ratio": 0.0,
                }
            ],
        }
        return httpx.Response(200, json=data)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        client = DashboardApiClient(client=raw_client)
        res = await client.get_stats(
            metric="temperature",
            devices=["esp32c6", "esp32s3"],
            from_ts="2026-10-14T00:00:00Z",
            to_ts="2026-10-14T23:59:59Z",
            include_on_demand=True,
        )
        assert res["metric"] == "temperature"
        assert len(res["stats"]) == 1
        assert res["stats"][0]["mean"] == 21.4


@pytest.mark.asyncio
async def test_get_series_parameters() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/series"
        assert request.url.params["metric"] == "humidity"
        assert request.url.params["bucket"] == "1h"
        assert request.url.params["limit"] == "50"

        data = {
            "metric": "humidity",
            "unit": "%",
            "bucket": "1h",
            "series": [
                {
                    "device_id": "esp32s3",
                    "points": [{"ts": "2026-10-14T00:00:00Z", "value": 55.2}],
                }
            ],
        }
        return httpx.Response(200, json=data)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        client = DashboardApiClient(client=raw_client)
        res = await client.get_series(
            metric="humidity",
            devices="esp32s3",
            bucket="1h",
            limit=50,
        )
        assert res["bucket"] == "1h"
        assert len(res["series"]) == 1


@pytest.mark.asyncio
async def test_api_error_handling() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "Metric not found"})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://test"
    ) as raw_client:
        client = DashboardApiClient(client=raw_client)
        with pytest.raises(DashboardApiError) as exc_info:
            await client.get_stats(metric="unknown_metric")
        assert exc_info.value.status_code == 404
