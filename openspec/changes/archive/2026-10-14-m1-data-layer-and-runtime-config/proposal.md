## Why

Milestone M1 establishes the data layer and runtime configuration foundation for the IoT Dashboard and Agent. The application requires a reliable ETL transformation pipeline that ingests source SQLite database snapshots from a designated migration folder, normalizes timestamps to UTC `Z`, flattens JSON readings into a query-optimized derived database, and provides a synthetic seed generator so the repo runs without private data. Additionally, decoupling the agent's LLM configuration from a specific local runner (Unsloth) into a generic OpenAI-compatible runtime configuration file (`data/runtime-config.json`) with `.env` fallback enables secure, dynamic configuration from both local development and future dashboard settings.

## What Changes

- **Migration Inbox (`data/migrations/`)**: Establish a dedicated directory for uploading or dropping raw source SQLite databases (`source.db`), git-ignored to prevent leaking private sensor data.
- **Data ETL Pipeline**: Implement an idempotent ETL script that snapshots the raw source database, validates UTC timestamps (`2026-10-05T08:36:23` UTC+0 normalized to ISO-8601 `2026-10-05T08:36:23Z`), maps `is_fine_tuned` to `sampling: "scheduled" | "on_demand"`, validates metric catalogue and units, and generates an indexed derived database (`data/derived/measurements.db`) with atomic swap.
- **Synthetic Seed Generator**: Implement a synthetic data generator script producing realistic source database fixtures with multiple devices, 5-minute scheduled cadences, on-demand triggers, gaps, and injected anomalies (spike, drift, flatline, peer deviation).
- **Runtime Configuration Foundation**: Define `data/runtime-config.json` schema for storing LLM connection parameters (`base_url`, `model`, `api_key_encrypted`), implement AES-256 symmetric encryption/decryption utilities, and update the Python agent service settings loader to prioritize `runtime-config.json` over `.env`.

## Capabilities

### New Capabilities
- `data-migration-inbox-and-etl`: Ingests source SQLite database snapshots from `data/migrations/`, normalizes timestamps, validates catalogue consistency, flattens metrics, and atomically produces `data/derived/measurements.db`.
- `synthetic-seed-generator`: Generates synthetic source SQLite databases with realistic readings and injected anomalies for tests and demos.
- `runtime-config-foundation`: Manages file-based runtime LLM configuration (`data/runtime-config.json`) with encrypted API keys and fallback precedence.

### Modified Capabilities
- `spike-local-llm-connectivity`: Updates LLM connectivity to support generic OpenAI-compatible endpoints with resolution from `runtime-config.json` prior to `.env`.

## Impact

- **Filesystem**: Creates `data/migrations/` and `data/derived/` directories; updates `.gitignore` to ignore `.db`, `.sqlite*`, and `data/runtime-config.json`.
- **Backend / ETL**: Adds ETL script and synthetic generator runnable via workspace commands.
- **Agent Service**: Updates `apps/agent-service/src/agent_service/config.py` to support runtime configuration file resolution and API key decryption.
- **Dependencies**: Adds `cryptography` to `apps/agent-service` and SQLite / encryption utilities to TypeScript tooling if needed.
