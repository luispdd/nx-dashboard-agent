import json
import math
import random
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path


@dataclass
class AnomalySpec:
    anomaly_type: str  # "peer_deviation", "spike", "flatline", "gap"
    device_id: str
    metric_key: str
    start_offset_minutes: int
    duration_minutes: int
    magnitude: float = 0.0


@dataclass
class GeneratorConfig:
    devices: list[str] = field(
        default_factory=lambda: ["esp32c6", "esp32s3", "esp32node1"]
    )
    metric_capabilities: dict[str, str] = field(
        default_factory=lambda: {
            "temperature": "°C",
            "humidity": "%",
            "pressure": "hPa",
        }
    )
    duration_days: int = 3
    interval_minutes: int = 5
    on_demand_rate: float = 0.03  # 3% chance of an on-demand reading
    anomalies: list[AnomalySpec] = field(default_factory=list)
    start_time: datetime = field(
        default_factory=lambda: datetime(2026, 10, 5, 0, 0, 0, tzinfo=UTC)
    )
    is_demo: bool = True


def create_source_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS source_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nodes (
            device_id TEXT PRIMARY KEY,
            ip_address TEXT,
            capabilities TEXT,
            last_seen TEXT
        );

        CREATE TABLE IF NOT EXISTS sensor_capabilities (
            device_id TEXT,
            metric_key TEXT,
            unit TEXT,
            PRIMARY KEY (device_id, metric_key)
        );

        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL,
            metrics TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            is_fine_tuned INTEGER DEFAULT 0,
            UNIQUE(timestamp, device_id)
        );

        CREATE TABLE IF NOT EXISTS sync_state (
            logger_id TEXT PRIMARY KEY,
            last_cursor INTEGER,
            last_synced_at TEXT
        );
        """
    )
    conn.commit()


def generate_synthetic_database(
    target_path: Path | str,
    config: GeneratorConfig | None = None,
    seed: int = 42,
) -> dict[str, int]:
    """Generates a synthetic SQLite source database.

    Returns a summary dictionary of row counts.
    """
    cfg = config or GeneratorConfig()
    rng = random.Random(seed)
    target = Path(target_path)
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists():
        target.unlink()

    conn = sqlite3.connect(str(target))
    try:
        create_source_schema(conn)
        conn.execute(
            "INSERT INTO source_metadata (key, value) VALUES (?, ?)",
            ("is_demo", "true" if cfg.is_demo else "false"),
        )

        # 1. Populate nodes & capabilities
        for dev_id in cfg.devices:
            conn.execute(
                "INSERT INTO nodes (device_id, ip_address, capabilities, last_seen) VALUES (?, ?, ?, ?)",
                (
                    dev_id,
                    f"192.168.1.{rng.randint(10, 200)}",
                    json.dumps(list(cfg.metric_capabilities.keys())),
                    cfg.start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                ),
            )
            for m_key, unit in cfg.metric_capabilities.items():
                conn.execute(
                    "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES (?, ?, ?)",
                    (dev_id, m_key, unit),
                )

        conn.commit()

        # 2. Generate time series readings
        total_intervals = int((cfg.duration_days * 24 * 60) / cfg.interval_minutes)
        readings_rows: list[tuple[str, str, str, str, int]] = []

        # Keep state for flatline anomaly
        flatline_values: dict[tuple[str, str], float] = {}

        for step in range(total_intervals):
            current_time = cfg.start_time + timedelta(
                minutes=step * cfg.interval_minutes
            )
            # Timestamp format in source: YYYY-MM-DDTHH:MM:SS (UTC+0 without Z suffix)
            ts_str = current_time.strftime("%Y-%m-%dT%H:%M:%S")
            minutes_from_start = step * cfg.interval_minutes
            time_of_day_seconds = current_time.hour * 3600 + current_time.minute * 60

            # Base diurnal cycle: sinusoidal daily variation
            diurnal_rad = 2 * math.pi * (time_of_day_seconds / 86400.0)
            base_temp = 20.0 + 5.0 * math.sin(
                diurnal_rad - math.pi / 2
            )  # Peak in afternoon
            base_humidity = 55.0 - 15.0 * math.sin(
                diurnal_rad - math.pi / 2
            )  # Inverted with temp
            base_pressure = 1013.25 + 2.0 * math.cos(diurnal_rad)

            for dev_id in cfg.devices:
                # Check for gap anomaly
                is_gap = any(
                    a.anomaly_type == "gap"
                    and a.device_id == dev_id
                    and a.start_offset_minutes
                    <= minutes_from_start
                    < (a.start_offset_minutes + a.duration_minutes)
                    for a in cfg.anomalies
                )
                if is_gap:
                    continue

                # Device slight natural offset
                dev_hash = sum(ord(c) for c in dev_id) % 5
                dev_offset = (dev_hash - 2) * 0.4

                temp_val = round(base_temp + dev_offset + rng.gauss(0, 0.3), 2)
                hum_val = round(base_humidity - dev_offset + rng.gauss(0, 0.5), 2)
                press_val = round(base_pressure + rng.gauss(0, 0.2), 2)

                # Check and apply anomalies
                for anom in cfg.anomalies:
                    if (
                        anom.device_id == dev_id
                        and anom.start_offset_minutes
                        <= minutes_from_start
                        < (anom.start_offset_minutes + anom.duration_minutes)
                    ):
                        if anom.anomaly_type == "peer_deviation":
                            if anom.metric_key == "temperature":
                                temp_val = round(temp_val + anom.magnitude, 2)
                            elif anom.metric_key == "humidity":
                                hum_val = round(hum_val + anom.magnitude, 2)
                        elif anom.anomaly_type == "spike":
                            # Spike occurs at the exact start minute
                            if minutes_from_start == anom.start_offset_minutes:
                                if anom.metric_key == "temperature":
                                    temp_val = round(temp_val + anom.magnitude, 2)
                                elif anom.metric_key == "humidity":
                                    hum_val = round(hum_val + anom.magnitude, 2)
                        elif anom.anomaly_type == "flatline":
                            key = (anom.device_id, anom.metric_key)
                            if key not in flatline_values:
                                flatline_values[key] = (
                                    temp_val
                                    if anom.metric_key == "temperature"
                                    else hum_val
                                )
                            if anom.metric_key == "temperature":
                                temp_val = flatline_values[key]
                            elif anom.metric_key == "humidity":
                                hum_val = flatline_values[key]

                metrics_dict = {
                    "temperature": temp_val,
                    "humidity": hum_val,
                    "pressure": press_val,
                }
                ingested_at = (
                    current_time + timedelta(seconds=rng.randint(1, 15))
                ).strftime("%Y-%m-%dT%H:%M:%S")

                readings_rows.append(
                    (ts_str, dev_id, json.dumps(metrics_dict), ingested_at, 0)
                )

                # Occasional on-demand reading shortly after
                if rng.random() < cfg.on_demand_rate:
                    on_demand_time = current_time + timedelta(
                        seconds=rng.randint(30, 90)
                    )
                    od_ts_str = on_demand_time.strftime("%Y-%m-%dT%H:%M:%S")
                    od_metrics = {
                        "temperature": round(temp_val + rng.gauss(0, 0.1), 2),
                        "humidity": round(hum_val + rng.gauss(0, 0.2), 2),
                        "pressure": press_val,
                    }
                    readings_rows.append(
                        (
                            od_ts_str,
                            dev_id,
                            json.dumps(od_metrics),
                            od_ts_str,
                            1,
                        )
                    )

        conn.executemany(
            """
            INSERT OR IGNORE INTO readings (timestamp, device_id, metrics, ingested_at, is_fine_tuned)
            VALUES (?, ?, ?, ?, ?)
            """,
            readings_rows,
        )

        # 3. Populate sync_state
        conn.execute(
            "INSERT INTO sync_state (logger_id, last_cursor, last_synced_at) VALUES (?, ?, ?)",
            (
                "main_syncer",
                len(readings_rows),
                cfg.start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            ),
        )
        conn.commit()

        counts = {
            "nodes": conn.execute("SELECT count(*) FROM nodes").fetchone()[0],
            "sensor_capabilities": conn.execute(
                "SELECT count(*) FROM sensor_capabilities"
            ).fetchone()[0],
            "readings": conn.execute("SELECT count(*) FROM readings").fetchone()[0],
        }
        return counts
    finally:
        conn.close()
