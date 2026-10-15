import statistics
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TimeWindow(BaseModel):
    from_ts: str = Field(description="Start timestamp in ISO-8601 UTC")
    to_ts: str = Field(description="End timestamp in ISO-8601 UTC")


class AnomalyFinding(BaseModel):
    device_id: str
    metric_key: str
    type: Literal["peer_deviation", "spike", "flatline", "gap", "out_of_range"]
    severity: Literal["low", "medium", "high"]
    window: TimeWindow
    evidence: dict[str, Any]
    summary: str


class TelemetryPoint(BaseModel):
    ts: str
    value: float


def parse_utc_timestamp(ts_str: str) -> datetime:
    """Parses an ISO-8601 UTC timestamp, ensuring it has UTC timezone info."""
    clean = ts_str.strip()
    if clean.endswith("Z"):
        clean = clean[:-1] + "+00:00"
    dt = datetime.fromisoformat(clean)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def calculate_median(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


def calculate_mad(values: list[float], med: float | None = None) -> float:
    """Calculates Median Absolute Deviation (MAD)."""
    if not values:
        return 0.0
    m = med if med is not None else calculate_median(values)
    deviations = [abs(x - m) for x in values]
    return float(statistics.median(deviations))


def calculate_variance(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return float(statistics.variance(values))


def detect_peer_deviation(
    series_by_device: dict[str, list[TelemetryPoint]],
    metric_key: str,
    threshold: float = 3.0,
    min_consecutive: int = 3,
) -> list[AnomalyFinding]:
    """Identifies devices that deviate significantly from the peer median over consecutive points."""
    # Group points by timestamp across all devices
    points_by_ts: dict[str, dict[str, float]] = defaultdict(dict)
    for dev_id, points in series_by_device.items():
        for p in points:
            points_by_ts[p.ts][dev_id] = p.value

    # Compute peer medians for timestamps with at least 2 reporting devices
    deviations_by_device: dict[str, list[tuple[str, float, float, float]]] = defaultdict(list)
    # entry: (ts, dev_value, peer_median, delta)

    sorted_timestamps = sorted(points_by_ts.keys())
    for ts in sorted_timestamps:
        readings = points_by_ts[ts]
        if len(readings) < 2:
            continue
        vals = list(readings.values())
        med = calculate_median(vals)

        for dev_id, val in readings.items():
            delta = val - med
            if abs(delta) >= threshold:
                deviations_by_device[dev_id].append((ts, val, med, delta))
            else:
                # Break consecutive chain if needed
                deviations_by_device[dev_id].append((ts, val, med, 0.0))

    findings: list[AnomalyFinding] = []

    for dev_id, records in deviations_by_device.items():
        current_streak: list[tuple[str, float, float, float]] = []

        def flush_streak(streak: list[tuple[str, float, float, float]], target_dev: str) -> None:
            if len(streak) >= min_consecutive:
                start_ts = streak[0][0]
                end_ts = streak[-1][0]
                deltas = [r[3] for r in streak]
                mean_delta = round(statistics.mean(deltas), 2)
                mean_obs = round(statistics.mean([r[1] for r in streak]), 2)
                mean_peer = round(statistics.mean([r[2] for r in streak]), 2)

                severity: Literal["low", "medium", "high"] = "high" if abs(mean_delta) >= threshold * 2 else "medium"
                sign = "+" if mean_delta > 0 else ""
                summary = (
                    f"Device {target_dev} {metric_key} deviated by {sign}{mean_delta} from peer fleet median "
                    f"over {len(streak)} consecutive readings ({start_ts} to {end_ts})."
                )
                findings.append(
                    AnomalyFinding(
                        device_id=target_dev,
                        metric_key=metric_key,
                        type="peer_deviation",
                        severity=severity,
                        window=TimeWindow(from_ts=start_ts, to_ts=end_ts),
                        evidence={
                            "observed_mean": mean_obs,
                            "peer_median_mean": mean_peer,
                            "delta_mean": mean_delta,
                            "consecutive_points": len(streak),
                        },
                        summary=summary,
                    )
                )

        for rec in records:
            if abs(rec[3]) >= threshold:
                current_streak.append(rec)
            else:
                flush_streak(current_streak, dev_id)
                current_streak = []
        flush_streak(current_streak, dev_id)

    return findings


def detect_spikes(
    series_by_device: dict[str, list[TelemetryPoint]],
    metric_key: str,
    z_threshold: float = 3.5,
) -> list[AnomalyFinding]:
    """Identifies transient, large single-reading departures from a device's baseline using MAD."""
    findings: list[AnomalyFinding] = []

    for dev_id, points in series_by_device.items():
        if len(points) < 5:
            continue

        values = [p.value for p in points]
        med = calculate_median(values)
        mad = calculate_mad(values, med)

        # If baseline variance is near 0, fall back to standard deviation or minimum epsilon
        scale = mad if mad > 1e-4 else (statistics.stdev(values) if len(values) > 1 and statistics.stdev(values) > 1e-4 else 0.1)

        for p in points:
            diff = abs(p.value - med)
            score = diff / scale
            if score >= z_threshold:
                severity: Literal["low", "medium", "high"] = "high" if score >= z_threshold * 2 else "medium"
                delta = round(p.value - med, 2)
                sign = "+" if delta > 0 else ""
                summary = (
                    f"Transient spike of {p.value} ({sign}{delta} departure from baseline {round(med, 2)}) "
                    f"detected on device {dev_id} at {p.ts}."
                )
                findings.append(
                    AnomalyFinding(
                        device_id=dev_id,
                        metric_key=metric_key,
                        type="spike",
                        severity=severity,
                        window=TimeWindow(from_ts=p.ts, to_ts=p.ts),
                        evidence={
                            "observed": p.value,
                            "baseline_median": round(med, 2),
                            "scale": round(scale, 2),
                            "departure_score": round(score, 2),
                        },
                        summary=summary,
                    )
                )

    return findings


def detect_flatlines(
    series_by_device: dict[str, list[TelemetryPoint]],
    metric_key: str,
    min_points: int = 12,  # e.g. 1 hour at 5m cadence
    var_threshold: float = 0.001,
) -> list[AnomalyFinding]:
    """Identifies stuck sensors whose reported values display near-zero variance over sustained periods."""
    findings: list[AnomalyFinding] = []

    for dev_id, points in series_by_device.items():
        if len(points) < min_points:
            continue

        # Find longest consecutive streak with max - min <= var_threshold
        current_streak: list[TelemetryPoint] = [points[0]]

        def flush_flatline(streak: list[TelemetryPoint], target_dev: str) -> None:
            if len(streak) >= min_points:
                start_ts = streak[0].ts
                end_ts = streak[-1].ts
                stuck_val = streak[0].value
                duration_pts = len(streak)
                severity: Literal["low", "medium", "high"] = "high" if duration_pts >= min_points * 3 else "medium"
                summary = (
                    f"Device {target_dev} {metric_key} flatlined at constant value {stuck_val} "
                    f"over {duration_pts} consecutive readings ({start_ts} to {end_ts})."
                )
                findings.append(
                    AnomalyFinding(
                        device_id=target_dev,
                        metric_key=metric_key,
                        type="flatline",
                        severity=severity,
                        window=TimeWindow(from_ts=start_ts, to_ts=end_ts),
                        evidence={
                            "stuck_value": stuck_val,
                            "consecutive_points": duration_pts,
                            "range": round(max(p.value for p in streak) - min(p.value for p in streak), 4),
                        },
                        summary=summary,
                    )
                )

        for i in range(1, len(points)):
            p = points[i]
            # Check if this point matches the current streak value within threshold
            if abs(p.value - current_streak[0].value) <= var_threshold:
                current_streak.append(p)
            else:
                flush_flatline(current_streak, dev_id)
                current_streak = [p]
        flush_flatline(current_streak, dev_id)

    return findings


def detect_gaps(
    series_by_device: dict[str, list[TelemetryPoint]],
    metric_key: str,
    max_allowed_gap_seconds: int = 900,  # 15 minutes (3 * 5m intervals)
) -> list[AnomalyFinding]:
    """Identifies missing readings where time between consecutive readings exceeds expected cadence."""
    findings: list[AnomalyFinding] = []

    for dev_id, points in series_by_device.items():
        if len(points) < 2:
            continue

        # Sort points by timestamp
        sorted_points = sorted(points, key=lambda p: parse_utc_timestamp(p.ts))

        for i in range(1, len(sorted_points)):
            prev_p = sorted_points[i - 1]
            curr_p = sorted_points[i]
            dt_prev = parse_utc_timestamp(prev_p.ts)
            dt_curr = parse_utc_timestamp(curr_p.ts)
            gap_seconds = int((dt_curr - dt_prev).total_seconds())

            if gap_seconds > max_allowed_gap_seconds:
                gap_minutes = round(gap_seconds / 60, 1)
                severity: Literal["low", "medium", "high"] = "high" if gap_minutes >= 60 else "medium"
                summary = (
                    f"Telemetry gap of {gap_minutes} minutes detected on device {dev_id} "
                    f"between {prev_p.ts} and {curr_p.ts}."
                )
                findings.append(
                    AnomalyFinding(
                        device_id=dev_id,
                        metric_key=metric_key,
                        type="gap",
                        severity=severity,
                        window=TimeWindow(from_ts=prev_p.ts, to_ts=curr_p.ts),
                        evidence={
                            "gap_minutes": gap_minutes,
                            "gap_seconds": gap_seconds,
                        },
                        summary=summary,
                    )
                )

    return findings


def detect_all_anomalies(
    series_by_device: dict[str, list[TelemetryPoint]],
    metric_key: str,
    peer_threshold: float = 3.0,
    spike_z_threshold: float = 3.5,
    flatline_min_points: int = 12,
    gap_max_seconds: int = 900,
) -> list[AnomalyFinding]:
    """Runs all deterministic statistical anomaly detectors and returns aggregated findings."""
    all_findings: list[AnomalyFinding] = []

    all_findings.extend(
        detect_peer_deviation(
            series_by_device,
            metric_key=metric_key,
            threshold=peer_threshold,
        )
    )
    all_findings.extend(
        detect_spikes(
            series_by_device,
            metric_key=metric_key,
            z_threshold=spike_z_threshold,
        )
    )
    all_findings.extend(
        detect_flatlines(
            series_by_device,
            metric_key=metric_key,
            min_points=flatline_min_points,
        )
    )
    all_findings.extend(
        detect_gaps(
            series_by_device,
            metric_key=metric_key,
            max_allowed_gap_seconds=gap_max_seconds,
        )
    )

    # Sort by start timestamp
    return sorted(all_findings, key=lambda f: f.window.from_ts)
