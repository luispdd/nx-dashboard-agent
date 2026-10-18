from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from agent_service.tools.registry import (
    build_default_tool_registry,
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
        GetStatsInput.model_validate(
            {
                "metric_key": "temperature",
                "device_id": "esp32c6",
                "unexpected_field": "disallowed",
            }
        )


def test_default_tool_registry_local_tools() -> None:
    registry = build_default_tool_registry()
    tool = registry.get_tool("detect_anomalies")
    assert tool is not None
    assert tool.name == "detect_anomalies"
    schema = tool.to_openai_schema()
    assert schema["function"]["name"] == "detect_anomalies"
    assert schema["function"]["parameters"]["additionalProperties"] is False
