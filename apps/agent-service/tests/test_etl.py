import json
import sqlite3
from pathlib import Path

import pytest

from agent_service.data.etl import (
    build_catalog_and_validate_units,
    map_sampling,
    run_etl,
    validate_and_normalize_timestamp,
)
from agent_service.data.seed_generator import (
    GeneratorConfig,
    create_source_schema,
    generate_synthetic_database,
)


def test_validate_and_normalize_timestamp() -> None:
    # Source naive UTC ISO-8601 string normalized to ISO-8601 UTC with Z
    assert (
        validate_and_normalize_timestamp("2026-10-05T08:36:23")
        == "2026-10-05T08:36:23Z"
    )
    # Already with Z
    assert (
        validate_and_normalize_timestamp("2026-10-05T08:36:23Z")
        == "2026-10-05T08:36:23Z"
    )

    # Malformed strings should raise ValueError
    with pytest.raises(ValueError, match="Malformed ISO-8601 timestamp string"):
        validate_and_normalize_timestamp("invalid-date-string")

    with pytest.raises(ValueError, match="Invalid timestamp value"):
        validate_and_normalize_timestamp("")


def test_map_sampling() -> None:
    assert map_sampling(0) == "scheduled"
    assert map_sampling(False) == "scheduled"
    assert map_sampling(1) == "on_demand"
    assert map_sampling(True) == "on_demand"
    assert map_sampling("1") == "on_demand"


def test_build_catalog_and_detect_conflicting_units(tmp_path: Path) -> None:
    db_path = tmp_path / "test_units.db"
    conn = sqlite3.connect(str(db_path))
    create_source_schema(conn)

    # Device 1 has temperature in °C
    conn.execute(
        "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES ('esp1', 'temperature', '°C')"
    )
    # Device 2 has temperature in °F -> Conflict!
    conn.execute(
        "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES ('esp2', 'temperature', '°F')"
    )
    conn.commit()

    with pytest.raises(ValueError, match="Conflicting unit for metric 'temperature'"):
        build_catalog_and_validate_units(conn)

    conn.close()


def test_run_etl_end_to_end(tmp_path: Path) -> None:
    source_db = tmp_path / "source.db"
    derived_db = tmp_path / "derived" / "measurements.db"

    # 1. Generate small synthetic source
    cfg = GeneratorConfig(duration_days=1, interval_minutes=30)
    seed_counts = generate_synthetic_database(source_db, config=cfg)

    # 2. Run ETL
    summary = run_etl(source_db, derived_db)

    assert summary.readings_processed == seed_counts["readings"]
    assert summary.measurements_inserted > 0
    assert summary.catalog_entries == 3
    assert summary.devices_count == 3
    assert derived_db.is_file()

    # 3. Verify derived DB content and structure
    conn = sqlite3.connect(str(derived_db))

    # Verify catalog
    catalog = dict(conn.execute("SELECT metric_key, unit FROM metrics_catalog").fetchall())
    assert catalog["temperature"] == "°C"
    assert catalog["humidity"] == "%"
    assert catalog["pressure"] == "hPa"

    # Verify measurement row
    row = conn.execute(
        "SELECT ts, device_id, metric_key, value, sampling FROM measurements LIMIT 1"
    ).fetchone()
    ts, dev_id, metric_key, val, sampling = row
    assert ts.endswith("Z")
    assert dev_id in ("esp32c6", "esp32s3", "esp32node1")
    assert metric_key in ("temperature", "humidity", "pressure")
    assert isinstance(val, float)
    assert sampling in ("scheduled", "on_demand")

    # Verify index exists
    indexes = [
        r[1]
        for r in conn.execute(
            "PRAGMA index_list('measurements')"
        ).fetchall()
    ]
    assert "idx_measurements_series" in indexes

    conn.close()


def test_run_etl_rejects_undeclared_metrics(tmp_path: Path) -> None:
    source_db = tmp_path / "undeclared.db"
    derived_db = tmp_path / "derived.db"

    conn = sqlite3.connect(str(source_db))
    create_source_schema(conn)
    conn.execute(
        "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES ('esp1', 'temp', '°C')"
    )
    # Reading contains 'light_level' not declared in sensor_capabilities
    conn.execute(
        "INSERT INTO readings (timestamp, device_id, metrics, ingested_at, is_fine_tuned) VALUES (?, ?, ?, ?, ?)",
        ("2026-10-05T08:00:00", "esp1", json.dumps({"temp": 22.0, "light_level": 450}), "2026-10-05T08:00:05", 0),
    )
    conn.commit()
    conn.close()

    with pytest.raises(ValueError, match="contains undeclared metric 'light_level'"):
        run_etl(source_db, derived_db)
