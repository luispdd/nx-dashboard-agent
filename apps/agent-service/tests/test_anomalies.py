from datetime import UTC, datetime, timedelta

from agent_service.analysis.anomalies import (
    TelemetryPoint,
    calculate_mad,
    calculate_median,
    calculate_variance,
    detect_all_anomalies,
    detect_flatlines,
    detect_gaps,
    detect_peer_deviation,
    detect_spikes,
)


def test_statistical_helpers() -> None:
    data = [10.0, 11.0, 12.0, 13.0, 14.0]
    assert calculate_median(data) == 12.0
    assert calculate_variance(data) == 2.5
    # Absolute deviations from 12.0: [2.0, 1.0, 0.0, 1.0, 2.0] -> median is 1.0
    assert calculate_mad(data) == 1.0

    assert calculate_median([]) == 0.0
    assert calculate_mad([]) == 0.0
    assert calculate_variance([5.0]) == 0.0


def test_detect_peer_deviation() -> None:
    base_time = datetime(2026, 10, 6, 0, 0, 0, tzinfo=UTC)
    series: dict[str, list[TelemetryPoint]] = {
        "esp32c6": [],
        "esp32s3": [],
        "esp32node1": [],
    }

    # Generate 10 points: esp32s3 and esp32node1 read ~20°C, esp32c6 reads ~28.5°C (+8.5°C deviation)
    for i in range(10):
        ts = (base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        series["esp32s3"].append(TelemetryPoint(ts=ts, value=20.0))
        series["esp32node1"].append(TelemetryPoint(ts=ts, value=20.2))
        series["esp32c6"].append(TelemetryPoint(ts=ts, value=28.5))

    findings = detect_peer_deviation(series, metric_key="temperature", threshold=3.0)
    assert len(findings) == 1
    f = findings[0]
    assert f.device_id == "esp32c6"
    assert f.type == "peer_deviation"
    assert f.severity == "high"
    assert f.evidence["consecutive_points"] == 10
    assert f.evidence["delta_mean"] >= 8.0
    assert "+8." in f.summary


def test_detect_spike() -> None:
    base_time = datetime(2026, 10, 7, 0, 0, 0, tzinfo=UTC)
    points: list[TelemetryPoint] = []

    # Normal baseline readings around 50%
    for i in range(20):
        ts = (base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        val = 50.0 + (i % 3) * 0.5
        points.append(TelemetryPoint(ts=ts, value=val))

    # Inject sharp transient spike at index 10
    points[10].value = 95.0

    series = {"esp32s3": points}
    findings = detect_spikes(series, metric_key="humidity", z_threshold=3.5)
    assert len(findings) == 1
    f = findings[0]
    assert f.device_id == "esp32s3"
    assert f.type == "spike"
    assert f.window.from_ts == points[10].ts
    assert f.evidence["observed"] == 95.0


def test_detect_flatline() -> None:
    base_time = datetime(2026, 10, 8, 0, 0, 0, tzinfo=UTC)
    points: list[TelemetryPoint] = []

    # 15 readings stuck at exact same value 21.3°C
    for i in range(15):
        ts = (base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        points.append(TelemetryPoint(ts=ts, value=21.3))

    series = {"esp32node1": points}
    findings = detect_flatlines(series, metric_key="temperature", min_points=12)
    assert len(findings) == 1
    f = findings[0]
    assert f.device_id == "esp32node1"
    assert f.type == "flatline"
    assert f.evidence["stuck_value"] == 21.3
    assert f.evidence["consecutive_points"] == 15


def test_detect_gap() -> None:
    base_time = datetime(2026, 10, 9, 0, 0, 0, tzinfo=UTC)
    points: list[TelemetryPoint] = []

    # Readings 0 to 5 (5m interval)
    for i in range(5):
        ts = (base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        points.append(TelemetryPoint(ts=ts, value=20.0))

    # 3-hour gap (180 minutes) before next reading
    after_gap = base_time + timedelta(minutes=25 + 180)
    points.append(TelemetryPoint(ts=after_gap.strftime("%Y-%m-%dT%H:%M:%SZ"), value=20.5))

    series = {"esp32c6": points}
    findings = detect_gaps(series, metric_key="temperature", max_allowed_gap_seconds=900)
    assert len(findings) == 1
    f = findings[0]
    assert f.device_id == "esp32c6"
    assert f.type == "gap"
    assert f.evidence["gap_minutes"] >= 180.0


def test_detect_all_anomalies_aggregation() -> None:
    base_time = datetime(2026, 10, 5, 0, 0, 0, tzinfo=UTC)
    series: dict[str, list[TelemetryPoint]] = {
        "esp32c6": [
            TelemetryPoint(ts=(base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ"), value=28.0)
            for i in range(10)
        ],
        "esp32s3": [
            TelemetryPoint(ts=(base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ"), value=20.0)
            for i in range(10)
        ],
        "esp32node1": [
            TelemetryPoint(ts=(base_time + timedelta(minutes=5 * i)).strftime("%Y-%m-%dT%H:%M:%SZ"), value=20.2)
            for i in range(10)
        ],
    }

    findings = detect_all_anomalies(series, metric_key="temperature", peer_threshold=3.0)
    assert any(f.type == "peer_deviation" for f in findings)


def test_detect_injected_synthetic_anomalies(tmp_path) -> None:
    import json
    import sqlite3

    from agent_service.data.generate_seed import (
        AnomalySpec,
        GeneratorConfig,
        generate_synthetic_database,
    )

    db_path = tmp_path / "test_source.db"
    anomalies = [
        AnomalySpec(
            anomaly_type="peer_deviation",
            device_id="esp32c6",
            metric_key="temperature",
            start_offset_minutes=1440,
            duration_minutes=360,
            magnitude=8.5,
        ),
        AnomalySpec(
            anomaly_type="spike",
            device_id="esp32s3",
            metric_key="humidity",
            start_offset_minutes=2880,
            duration_minutes=5,
            magnitude=40.0,
        ),
        AnomalySpec(
            anomaly_type="flatline",
            device_id="esp32node1",
            metric_key="temperature",
            start_offset_minutes=4320,
            duration_minutes=720,
        ),
        AnomalySpec(
            anomaly_type="gap",
            device_id="esp32c6",
            metric_key="temperature",
            start_offset_minutes=5760,
            duration_minutes=180,
        ),
    ]
    cfg = GeneratorConfig(duration_days=6, interval_minutes=5, anomalies=anomalies)
    generate_synthetic_database(db_path, config=cfg, seed=42)

    conn = sqlite3.connect(db_path)
    try:
        # Load temperature series by device
        cur = conn.cursor()
        cur.execute("SELECT timestamp, device_id, metrics FROM readings WHERE is_fine_tuned = 0 ORDER BY timestamp ASC")
        rows = cur.fetchall()

        temp_series: dict[str, list[TelemetryPoint]] = {"esp32c6": [], "esp32s3": [], "esp32node1": []}
        hum_series: dict[str, list[TelemetryPoint]] = {"esp32c6": [], "esp32s3": [], "esp32node1": []}

        for ts_raw, dev, metrics_raw in rows:
            m = json.loads(metrics_raw)
            ts_iso = f"{ts_raw}Z"
            if dev in temp_series and "temperature" in m:
                temp_series[dev].append(TelemetryPoint(ts=ts_iso, value=m["temperature"]))
            if dev in hum_series and "humidity" in m:
                hum_series[dev].append(TelemetryPoint(ts=ts_iso, value=m["humidity"]))

        # 1. Peer deviation test
        peer_anoms = detect_peer_deviation(temp_series, metric_key="temperature", threshold=3.0)
        assert any(a.device_id == "esp32c6" and a.type == "peer_deviation" for a in peer_anoms)

        # 2. Spike test
        spike_anoms = detect_spikes(hum_series, metric_key="humidity", z_threshold=3.5)
        assert any(a.device_id == "esp32s3" and a.type == "spike" for a in spike_anoms)

        # 3. Flatline test
        flatline_anoms = detect_flatlines(temp_series, metric_key="temperature", min_points=12)
        assert any(a.device_id == "esp32node1" and a.type == "flatline" for a in flatline_anoms)

        # 4. Gap test
        gap_anoms = detect_gaps(temp_series, metric_key="temperature", max_allowed_gap_seconds=900)
        assert any(a.device_id == "esp32c6" and a.type == "gap" for a in gap_anoms)
    finally:
        conn.close()
