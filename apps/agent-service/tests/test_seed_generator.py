import json
import sqlite3
from pathlib import Path

from agent_service.data.seed_generator import (
    AnomalySpec,
    GeneratorConfig,
    generate_synthetic_database,
)


def test_seed_generator_schema_and_counts(tmp_path: Path) -> None:
    db_path = tmp_path / "source.db"
    cfg = GeneratorConfig(duration_days=1, interval_minutes=15)
    counts = generate_synthetic_database(db_path, config=cfg)

    assert counts["nodes"] == 3
    assert counts["sensor_capabilities"] == 9  # 3 devices * 3 metrics
    assert counts["readings"] > 0

    conn = sqlite3.connect(str(db_path))
    # Check tables exist
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    ]
    assert "nodes" in tables
    assert "sensor_capabilities" in tables
    assert "readings" in tables
    assert "sync_state" in tables

    # Check timestamp format in readings: YYYY-MM-DDTHH:MM:SS without Z
    row = conn.execute(
        "SELECT timestamp, metrics, is_fine_tuned FROM readings LIMIT 1"
    ).fetchone()
    ts, metrics_json, is_ft = row
    assert "T" in ts
    assert not ts.endswith("Z")
    assert len(ts) == 19  # e.g. 2026-10-05T00:00:00

    metrics = json.loads(metrics_json)
    assert "temperature" in metrics
    assert "humidity" in metrics
    assert "pressure" in metrics
    assert is_ft in (0, 1)

    conn.close()


def test_anomaly_injection_peer_deviation_and_flatline(tmp_path: Path) -> None:
    db_path = tmp_path / "source_anomaly.db"
    cfg = GeneratorConfig(
        devices=["esp32c6", "esp32s3"],
        duration_days=1,
        interval_minutes=10,
        anomalies=[
            AnomalySpec(
                anomaly_type="peer_deviation",
                device_id="esp32c6",
                metric_key="temperature",
                start_offset_minutes=60,
                duration_minutes=120,
                magnitude=15.0,
            ),
            AnomalySpec(
                anomaly_type="flatline",
                device_id="esp32s3",
                metric_key="humidity",
                start_offset_minutes=60,
                duration_minutes=60,
            ),
            AnomalySpec(
                anomaly_type="gap",
                device_id="esp32c6",
                metric_key="temperature",
                start_offset_minutes=240,
                duration_minutes=60,
            ),
        ],
    )
    generate_synthetic_database(db_path, config=cfg)

    conn = sqlite3.connect(str(db_path))

    # 1. Verify peer deviation: esp32c6 temperature should be > 30 during anomaly
    dev_readings = conn.execute(
        """
        SELECT timestamp, metrics FROM readings
        WHERE device_id = 'esp32c6' AND is_fine_tuned = 0
        ORDER BY timestamp
        """
    ).fetchall()

    anomaly_temp_values = []
    for ts, m_json in dev_readings:
        m = json.loads(m_json)
        # Offset 60 to 180 min -> from 01:00:00 to 03:00:00
        if "T01:" in ts or "T02:" in ts:
            anomaly_temp_values.append(m["temperature"])

    assert len(anomaly_temp_values) > 0
    # Base temp around 15-25 + magnitude 15 -> expected > 28
    assert all(val > 28.0 for val in anomaly_temp_values)

    # 2. Verify flatline: esp32s3 humidity in window 01:00:00 to 02:00:00 should be identical
    flat_readings = conn.execute(
        """
        SELECT timestamp, metrics FROM readings
        WHERE device_id = 'esp32s3' AND is_fine_tuned = 0 AND timestamp LIKE '%T01:%'
        ORDER BY timestamp
        """
    ).fetchall()
    flat_hum_values = [json.loads(m)["humidity"] for _, m in flat_readings]
    assert len(flat_hum_values) >= 5
    assert len(set(flat_hum_values)) == 1

    conn.close()
