import argparse
import json
import logging
import os
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ETLSummary:
    source_path: str
    target_path: str
    readings_processed: int
    measurements_inserted: int
    catalog_entries: int
    devices_count: int


def find_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for parent in [current, *current.parents]:
        if (parent / "nx.json").is_file() or (parent / ".git").is_dir():
            return parent
    return Path.cwd()


def resolve_default_paths() -> tuple[Path, Path]:
    repo_root = find_repo_root()
    source = repo_root / "data" / "migrations" / "source.db"
    derived = repo_root / "data" / "derived" / "measurements.db"
    return source, derived


def validate_and_normalize_timestamp(ts: str) -> str:
    """Validates source timestamp and normalizes to ISO-8601 UTC ending with 'Z'.

    Accepts 'YYYY-MM-DDTHH:MM:SS' or 'YYYY-MM-DDTHH:MM:SSZ'.
    Fails on malformed strings.
    """
    if not ts or not isinstance(ts, str):
        raise ValueError(f"Invalid timestamp value: {ts!r}")

    cleaned = ts.strip()
    if cleaned.endswith("Z"):
        base = cleaned[:-1]
    else:
        base = cleaned

    try:
        dt = datetime.fromisoformat(base)
    except ValueError as err:
        raise ValueError(f"Malformed ISO-8601 timestamp string: {ts!r}") from err

    # Ensure UTC representation ending with Z
    dt_utc = dt.replace(tzinfo=UTC)
    return dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def map_sampling(is_fine_tuned: Any) -> str:
    """Maps source is_fine_tuned flag (0 or 1) to 'scheduled' or 'on_demand'."""
    if is_fine_tuned in (1, True, "1", "true"):
        return "on_demand"
    return "scheduled"


UNIT_NORMALIZATIONS: dict[str, str] = {
    "%RH": "%",
    "Cel": "°C",
}

METRIC_KEY_NORMALIZATIONS: dict[str, str] = {
    "temp": "temperature",
    "hum": "humidity",
}


def build_catalog_and_validate_units(source_conn: sqlite3.Connection) -> dict[str, str]:
    """Builds metrics_catalog and asserts each metric_key has a uniform unit across all devices."""
    rows = source_conn.execute(
        "SELECT device_id, metric_key, unit FROM sensor_capabilities ORDER BY metric_key"
    ).fetchall()

    catalog: dict[str, str] = {}
    for dev_id, metric_key, unit in rows:
        if not metric_key or not unit:
            continue
        m_key = METRIC_KEY_NORMALIZATIONS.get(metric_key.strip(), metric_key.strip())
        norm_unit = UNIT_NORMALIZATIONS.get(unit.strip(), unit.strip())
        if m_key in catalog and catalog[m_key] != norm_unit:
            raise ValueError(
                f"Conflicting unit for metric '{m_key}': device '{dev_id}' reports '{norm_unit}' "
                f"while another device reports '{catalog[m_key]}'."
            )
        catalog[m_key] = norm_unit

    return catalog


def create_derived_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS metrics_catalog (
            metric_key TEXT PRIMARY KEY,
            unit TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS measurements (
            ts TEXT NOT NULL,
            device_id TEXT NOT NULL,
            metric_key TEXT NOT NULL,
            value REAL,
            sampling TEXT NOT NULL CHECK (sampling IN ('scheduled', 'on_demand')),
            PRIMARY KEY (ts, device_id, metric_key),
            FOREIGN KEY (metric_key) REFERENCES metrics_catalog(metric_key)
        );
        """
    )
    conn.commit()


def run_etl(source_db_path: Path | str, target_db_path: Path | str) -> ETLSummary:
    """Executes the ETL pipeline from source SQLite database to derived database.

    Safely reads source in read-only mode, stages the derived database in a temporary
    file, and swaps it atomically via os.replace.
    """
    source_p = Path(source_db_path).resolve()
    target_p = Path(target_db_path).resolve()

    if not source_p.is_file():
        raise FileNotFoundError(f"Source database not found at {source_p}")

    target_p.parent.mkdir(parents=True, exist_ok=True)
    temp_target_p = target_p.with_name(f"{target_p.name}.tmp.{os.getpid()}")

    if temp_target_p.exists():
        temp_target_p.unlink()

    # Open source in read-only mode
    source_uri = f"file:{source_p}?mode=ro"
    source_conn = sqlite3.connect(source_uri, uri=True)

    dest_conn = sqlite3.connect(str(temp_target_p))
    try:
        # 1. Validate units and construct catalog
        catalog = build_catalog_and_validate_units(source_conn)
        create_derived_schema(dest_conn)

        dest_conn.executemany(
            "INSERT INTO metrics_catalog (metric_key, unit) VALUES (?, ?)",
            list(catalog.items()),
        )
        dest_conn.commit()

        # 2. Extract, transform and flatten readings
        readings_cursor = source_conn.execute(
            "SELECT timestamp, device_id, metrics, is_fine_tuned FROM readings ORDER BY timestamp"
        )

        measurements_batch: list[tuple[str, str, str, float | None, str]] = []
        readings_count = 0
        devices_seen: set[str] = set()

        for raw_ts, dev_id, metrics_raw, is_ft in readings_cursor:
            readings_count += 1
            devices_seen.add(dev_id)
            ts_norm = validate_and_normalize_timestamp(raw_ts)
            sampling = map_sampling(is_ft)

            try:
                metrics_dict = (
                    json.loads(metrics_raw)
                    if isinstance(metrics_raw, str)
                    else metrics_raw
                )
            except Exception as err:
                raise ValueError(
                    f"Malformed JSON in reading id at {raw_ts}: {metrics_raw}"
                ) from err

            for m_key, val in metrics_dict.items():
                norm_m_key = METRIC_KEY_NORMALIZATIONS.get(m_key.strip(), m_key.strip())
                if norm_m_key not in catalog:
                    raise ValueError(
                        f"Reading at {raw_ts} for device '{dev_id}' contains undeclared metric '{m_key}'"
                    )

                float_val = float(val) if val is not None else None
                measurements_batch.append(
                    (ts_norm, dev_id, norm_m_key, float_val, sampling)
                )

                if len(measurements_batch) >= 5000:
                    dest_conn.executemany(
                        """
                        INSERT OR REPLACE INTO measurements (ts, device_id, metric_key, value, sampling)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        measurements_batch,
                    )
                    dest_conn.commit()
                    measurements_batch.clear()

        if measurements_batch:
            dest_conn.executemany(
                """
                INSERT OR REPLACE INTO measurements (ts, device_id, metric_key, value, sampling)
                VALUES (?, ?, ?, ?, ?)
                """,
                measurements_batch,
            )
            dest_conn.commit()
            measurements_batch.clear()

        # 3. Create composite index for time series queries
        dest_conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_measurements_series ON measurements (device_id, metric_key, ts)"
        )
        dest_conn.commit()

        measurements_count = dest_conn.execute(
            "SELECT count(*) FROM measurements"
        ).fetchone()[0]

    finally:
        source_conn.close()
        dest_conn.close()

    # 4. Atomic file swap
    os.replace(temp_target_p, target_p)

    return ETLSummary(
        source_path=str(source_p),
        target_path=str(target_p),
        readings_processed=readings_count,
        measurements_inserted=measurements_count,
        catalog_entries=len(catalog),
        devices_count=len(devices_seen),
    )


def main() -> None:
    default_src, default_dst = resolve_default_paths()
    parser = argparse.ArgumentParser(
        description="ETL migration from source database to derived database"
    )
    parser.add_argument(
        "--source",
        "-s",
        type=str,
        default=str(default_src),
        help=f"Path to raw source database (default: {default_src})",
    )
    parser.add_argument(
        "--target",
        "-t",
        type=str,
        default=str(default_dst),
        help=f"Path to derived output database (default: {default_dst})",
    )

    args = parser.parse_args()
    print("Starting ETL migration...")
    print(f"  Source: {args.source}")
    print(f"  Target: {args.target}")

    summary = run_etl(args.source, args.target)

    print("ETL Migration Complete!")
    print(f"  Readings processed:    {summary.readings_processed}")
    print(f"  Measurements inserted: {summary.measurements_inserted}")
    print(f"  Catalog entries:       {summary.catalog_entries}")
    print(f"  Devices represented:   {summary.devices_count}")
    print(f"  Derived Database:      {summary.target_path}")


if __name__ == "__main__":
    main()
