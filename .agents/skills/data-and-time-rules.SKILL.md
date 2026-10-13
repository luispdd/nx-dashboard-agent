---
name: data-and-time-rules
description: Use when touching the ETL, SQLite queries, the measurements schema, timestamps, timezones, sampling (regular vs on-demand readings), metric keys or units. Prevents the subtle data bugs specific to this project.
---

# Data and time rules

## Source database (read-only input, produced by another project)

```
nodes               device_id, ip_address, capabilities (JSON), last_seen
sensor_capabilities device_id + metric_key (PK), unit
readings            id, timestamp, device_id, metrics (JSON), ingested_at, is_fine_tuned
                    UNIQUE(timestamp, device_id)
sync_state          logger_id, last_cursor, last_synced_at
```

- Never write to it. Open it read-only (for example `mode=ro`) or take a consistent snapshot (SQLite backup API or `VACUUM INTO`); never copy the raw file while it may be written.
- Only `readings` and `sensor_capabilities` matter. Ignore `nodes` and `sync_state` content (`ip_address`, `last_seen`, `capabilities`, cursors) in app logic and contracts.
- Each `device_id` is an ESP32 node. Metric keys are the same across all devices. `readings.metrics` never contains keys absent from `sensor_capabilities`; if it does, the ETL fails loudly.

## Derived database

```sql
measurements (ts TEXT, device_id TEXT, metric_key TEXT, value REAL,
              sampling TEXT CHECK (sampling IN ('scheduled','on_demand')),
              PRIMARY KEY (ts, device_id, metric_key));
CREATE INDEX idx_measurements_series ON measurements (device_id, metric_key, ts);
metrics_catalog (metric_key TEXT PRIMARY KEY, unit TEXT NOT NULL);
```

- Rebuilt by the ETL from a snapshot, then swapped in atomically. Application code opens it read-only.
- `device_id` is confirmed as `TEXT` / string (board identifier, e.g., `'esp32c6'`).
- The ETL must validate: keys in the catalogue, one unit per metric key across devices, no duplicates, null/NaN handling, and report row counts. Any validation failure stops the run.

## Timestamps (most common source of bugs)

- Source format: `2026-10-05T08:36:23`. It is **UTC but has no zone suffix**.
- Normalize in the ETL to `2026-10-05T08:36:23Z`. Every API, tool and contract uses UTC ISO-8601 with `Z`.
- JavaScript: `new Date("2026-10-05T08:36:23")` is interpreted as **local time**. Never parse zone-less strings; only parse strings with `Z`.
- Python: `datetime.fromisoformat` on a zone-less string gives a naive datetime. Always attach `timezone.utc` or use timezone-aware values; never mix naive and aware.
- Convert to the viewer's timezone **only in the UI**. Never store local times.
- "Daily" buckets follow the user's local day; handle DST (23 and 25 hour days). Hourly and smaller buckets are UTC-aligned.
- Timestamps are **not on a clean 5-minute grid** (for example `08:36:23`). Bucket with floor/ceil on intervals; detect gaps with a tolerance (for example, no regular reading for more than 1.5 to 2 intervals), never exact equality.
- Relative ranges ("yesterday", "last 7 days") are resolved by the service from the current time and the user's timezone, not by the LLM.

## Sampling

- Regular readings occur every 5 minutes. `is_fine_tuned = true` means an **extra reading triggered manually by the user**, possibly at a much shorter interval. It is not an ML fine-tuning flag and not an anomaly signal.
- Expose it as `sampling: "scheduled" | "on_demand"`. Do not leak the name `is_fine_tuned` beyond the ETL.
- Aggregates and anomaly detection use `scheduled` readings by default (`include_on_demand=false`). On-demand readings oversample short periods and would bias averages.
- Charts may show on-demand readings as an optional overlay.

## Units and metrics

- Units come from the catalogue; never hardcode them in UI or tools.
- Always return units alongside values in API and tool responses.
- Cross-device comparison only for the same `metric_key`.

## Queries

- Parameterized queries only. Never build SQL by string concatenation, including metric keys or device ids (validate against the catalogue/allowlist).
- Missing data is `null` or absent, never `0`. Do not interpolate across gaps in charts or statistics unless explicitly requested.
- Bound result sizes: always downsample (bucket averages) or limit rows on large ranges.

## Checklist

- [ ] Timestamps normalized to UTC with `Z`, no zone-less parsing
- [ ] Sampling handled (regular by default), `is_fine_tuned` not leaked
- [ ] Units from the catalogue, present in responses
- [ ] Parameterized and read-only access, bounded output
- [ ] Gaps handled with tolerance, no fake zeros
