import logging
from typing import Any, Self

import httpx

from agent_service.config import settings
from agent_service.context import get_current_run_id

logger = logging.getLogger(__name__)


class DashboardApiError(Exception):
    def __init__(self, message: str, status_code: int | None = None, response_data: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_data = response_data


def _format_http_error(err: httpx.HTTPError, action: str) -> str:
    if hasattr(err, "response") and err.response is not None:
        try:
            data = err.response.json()
            if isinstance(data, dict) and "message" in data:
                return f"Dashboard API error {action} ({err.response.status_code}): {data['message']}"
        except Exception:  # noqa: BLE001
            if err.response.text:
                return f"Dashboard API error {action} ({err.response.status_code}): {err.response.text}"
    return f"Dashboard API error {action}: {err}"


class DashboardApiClient:
    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 8.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = (base_url or settings.dashboard_api_url).rstrip("/")
        self.timeout = timeout
        self._custom_client = client
        self._internal_client: httpx.AsyncClient | None = None

    def _get_headers(self, custom_headers: dict[str, str] | None = None) -> dict[str, str]:
        headers = dict(custom_headers or {})
        run_id = get_current_run_id()
        if run_id:
            headers["x-request-id"] = run_id
        return headers

    @property
    def client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        if self._internal_client is None or self._internal_client.is_closed:
            self._internal_client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
            )
        return self._internal_client

    async def close(self) -> None:
        if self._internal_client and not self._internal_client.is_closed:
            await self._internal_client.aclose()
            self._internal_client = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        await self.close()

    async def get_metrics(self) -> list[dict[str, str]]:
        """Retrieves metric catalogue with units from GET /api/metrics."""
        try:
            resp = await self.client.get("/api/metrics", headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return []
        except httpx.HTTPError as err:
            logger.warning("Failed to fetch metrics: %s", err)
            status = err.response.status_code if hasattr(err, "response") and err.response else None
            raise DashboardApiError(_format_http_error(err, "fetching metrics"), status_code=status) from err

    async def get_devices(self) -> list[str]:
        """Retrieves list of active device identifiers from GET /api/devices."""
        try:
            resp = await self.client.get("/api/devices", headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return [str(d) for d in data]
            return []
        except httpx.HTTPError as err:
            logger.warning("Failed to fetch devices: %s", err)
            status = err.response.status_code if hasattr(err, "response") and err.response else None
            raise DashboardApiError(_format_http_error(err, "fetching devices"), status_code=status) from err

    async def get_stats(
        self,
        metric: str,
        devices: list[str] | str | None = None,
        from_ts: str | None = None,
        to_ts: str | None = None,
        include_on_demand: bool = False,
    ) -> dict[str, Any]:
        """Queries GET /api/stats for statistical summaries."""
        params: dict[str, Any] = {"metric": metric}
        if devices:
            params["devices"] = ",".join(devices) if isinstance(devices, list) else devices
        if from_ts:
            params["from"] = from_ts
        if to_ts:
            params["to"] = to_ts
        if include_on_demand:
            params["include_on_demand"] = "true"

        try:
            resp = await self.client.get("/api/stats", params=params, headers=self._get_headers())
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as err:
            logger.warning("Failed to fetch stats with params %s: %s", params, err)
            status = err.response.status_code if hasattr(err, "response") and err.response else None
            raise DashboardApiError(_format_http_error(err, "fetching stats"), status_code=status) from err

    async def get_series(
        self,
        metric: str,
        devices: list[str] | str | None = None,
        from_ts: str | None = None,
        to_ts: str | None = None,
        bucket: str = "5m",
        limit: int | None = None,
        include_on_demand: bool = False,
    ) -> dict[str, Any]:
        """Queries GET /api/series for downsampled time-series points."""
        params: dict[str, Any] = {"metric": metric, "bucket": bucket}
        if devices:
            params["devices"] = ",".join(devices) if isinstance(devices, list) else devices
        if from_ts:
            params["from"] = from_ts
        if to_ts:
            params["to"] = to_ts
        if limit is not None:
            params["limit"] = limit
        if include_on_demand:
            params["include_on_demand"] = "true"

        try:
            resp = await self.client.get("/api/series", params=params, headers=self._get_headers())
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as err:
            logger.warning("Failed to fetch series with params %s: %s", params, err)
            status = err.response.status_code if hasattr(err, "response") and err.response else None
            raise DashboardApiError(_format_http_error(err, "fetching series"), status_code=status) from err
