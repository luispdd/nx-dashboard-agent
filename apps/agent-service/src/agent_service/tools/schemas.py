import re
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ISO_UTC_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")


def validate_iso_utc_timestamp(val: str | None) -> str | None:
    if val is None:
        return None
    val = val.strip()
    if not ISO_UTC_REGEX.match(val):
        raise ValueError(
            f"Timestamp '{val}' must be in ISO-8601 UTC format ending with Z (e.g. 2026-10-14T00:00:00Z)"
        )
    return val


def resolve_time_range(
    from_ts: str | None = None,
    to_ts: str | None = None,
    range_preset: str | None = None,
    now_utc: datetime | None = None,
) -> tuple[str | None, str | None]:
    """Resolves range presets (last_24h, last_7d, last_30d) into ISO UTC timestamps."""
    if range_preset:
        now = now_utc or datetime.now(UTC)
        to_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        if range_preset == "last_24h":
            from_str = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            return from_str, to_str
        if range_preset == "last_7d":
            from_str = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
            return from_str, to_str
        if range_preset == "last_30d":
            from_str = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
            return from_str, to_str

    return from_ts, to_ts


class ListMetricsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ListDevicesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GetStatsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: str = Field(
        description="Metric key identifier (e.g. 'temperature', 'humidity', 'pressure')",
    )
    device_id: str | None = Field(
        default=None,
        description="Optional device ID string (e.g. 'esp32c6'). If omitted, retrieves stats for all devices.",
    )
    from_ts: str | None = Field(
        default=None,
        description="Start timestamp in ISO-8601 UTC ending with Z (e.g. '2026-10-14T00:00:00Z')",
    )
    to_ts: str | None = Field(
        default=None,
        description="End timestamp in ISO-8601 UTC ending with Z (e.g. '2026-10-14T23:59:59Z')",
    )
    range_preset: Literal["last_24h", "last_7d", "last_30d"] | None = Field(
        default=None,
        description="Optional relative range preset. Handled by the service.",
    )
    include_on_demand: bool = Field(
        default=False,
        description="Include manually triggered on-demand readings in aggregate (default false)",
    )

    @field_validator("from_ts", "to_ts")
    @classmethod
    def check_iso_utc(cls, v: str | None) -> str | None:
        return validate_iso_utc_timestamp(v)


class GetSeriesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: str = Field(description="Metric key identifier, e.g. 'temperature'")
    device_id: str = Field(description="Target device ID, e.g. 'esp32c6'")
    from_ts: str | None = Field(
        default=None,
        description="Start timestamp in ISO-8601 UTC with Z suffix",
    )
    to_ts: str | None = Field(
        default=None,
        description="End timestamp in ISO-8601 UTC with Z suffix",
    )
    range_preset: Literal["last_24h", "last_7d", "last_30d"] | None = Field(
        default=None,
        description="Optional range preset",
    )
    bucket: Literal["5m", "15m", "1h", "6h", "1d"] = Field(
        default="5m",
        description="Downsampling bucket interval",
    )
    limit: int = Field(
        default=100,
        ge=1,
        le=200,
        description="Maximum number of points to return (default: 100, max: 200)",
    )
    include_on_demand: bool = Field(
        default=False,
        description="Include on-demand readings",
    )

    @field_validator("from_ts", "to_ts")
    @classmethod
    def check_iso_utc(cls, v: str | None) -> str | None:
        return validate_iso_utc_timestamp(v)


class CompareDevicesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: str = Field(
        description="Metric key to compare across devices (e.g. 'temperature')"
    )
    from_ts: str | None = Field(
        default=None,
        description="Start timestamp in ISO-8601 UTC ending with Z",
    )
    to_ts: str | None = Field(
        default=None,
        description="End timestamp in ISO-8601 UTC ending with Z",
    )
    range_preset: Literal["last_24h", "last_7d", "last_30d"] | None = Field(
        default=None,
        description="Optional relative range preset",
    )
    include_on_demand: bool = Field(
        default=False,
        description="Include on-demand manual readings in comparison",
    )

    @field_validator("from_ts", "to_ts")
    @classmethod
    def check_iso_utc(cls, v: str | None) -> str | None:
        return validate_iso_utc_timestamp(v)


class DetectAnomaliesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: str = Field(
        description="Metric key to analyze for anomalies (e.g. 'temperature', 'humidity')",
    )
    from_ts: str | None = Field(
        default=None,
        description="Start timestamp in ISO-8601 UTC ending with Z",
    )
    to_ts: str | None = Field(
        default=None,
        description="End timestamp in ISO-8601 UTC ending with Z",
    )
    range_preset: Literal["last_24h", "last_7d", "last_30d"] | None = Field(
        default=None,
        description="Optional relative range preset",
    )
    device_id: str | None = Field(
        default=None,
        description="Optional specific device to focus anomaly scan on",
    )

    @field_validator("from_ts", "to_ts")
    @classmethod
    def check_iso_utc(cls, v: str | None) -> str | None:
        return validate_iso_utc_timestamp(v)
