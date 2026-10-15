"""External clients package."""

from agent_service.clients.dashboard_api import DashboardApiClient, DashboardApiError

__all__ = ["DashboardApiClient", "DashboardApiError"]
