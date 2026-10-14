import argparse
from pathlib import Path

from agent_service.data.seed_generator import (
    AnomalySpec,
    GeneratorConfig,
    generate_synthetic_database,
)


def find_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for parent in [current, *current.parents]:
        if (parent / "nx.json").is_file() or (parent / ".git").is_dir():
            return parent
    return Path.cwd()


def resolve_default_output() -> Path:
    # Check if run from repo root
    cwd_path = Path("data/migrations/source.db")
    if Path("data/migrations").is_dir():
        return cwd_path

    # Check relative to detected repo root
    repo_path = find_repo_root() / "data" / "migrations" / "source.db"
    return repo_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic IoT source database")
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=str(resolve_default_output()),
        help="Target SQLite path for synthetic source database",
    )
    parser.add_argument(
        "--days",
        "-d",
        type=int,
        default=7,
        help="Number of days of data to generate (default: 7)",
    )
    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=5,
        help="Reading interval in minutes (default: 5)",
    )
    parser.add_argument(
        "--no-anomalies",
        action="store_true",
        help="Disable injection of anomalies",
    )
    parser.add_argument(
        "--seed",
        "-s",
        type=int,
        default=42,
        help="Random seed for reproducibility",
    )

    args = parser.parse_args()

    anomalies: list[AnomalySpec] = []
    if not args.no_anomalies:
        anomalies = [
            # Peer deviation on esp32c6 temperature
            AnomalySpec(
                anomaly_type="peer_deviation",
                device_id="esp32c6",
                metric_key="temperature",
                start_offset_minutes=1440,  # Day 2
                duration_minutes=360,
                magnitude=8.5,
            ),
            # Sensor spike on esp32s3 humidity
            AnomalySpec(
                anomaly_type="spike",
                device_id="esp32s3",
                metric_key="humidity",
                start_offset_minutes=2880,  # Day 3
                duration_minutes=5,
                magnitude=40.0,
            ),
            # Flatline on esp32node1 temperature
            AnomalySpec(
                anomaly_type="flatline",
                device_id="esp32node1",
                metric_key="temperature",
                start_offset_minutes=4320,  # Day 4
                duration_minutes=720,
            ),
            # Gap in esp32c6 readings
            AnomalySpec(
                anomaly_type="gap",
                device_id="esp32c6",
                metric_key="temperature",
                start_offset_minutes=5760,  # Day 5
                duration_minutes=180,
            ),
        ]

    config = GeneratorConfig(
        duration_days=args.days,
        interval_minutes=args.interval,
        anomalies=anomalies,
    )

    output_path = Path(args.output).resolve()
    print(f"Generating synthetic database at: {output_path}")
    counts = generate_synthetic_database(output_path, config=config, seed=args.seed)
    print("Generation complete!")
    print(f"  Nodes:               {counts['nodes']}")
    print(f"  Sensor Capabilities: {counts['sensor_capabilities']}")
    print(f"  Readings:            {counts['readings']}")


if __name__ == "__main__":
    main()
