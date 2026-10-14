## Context

Milestone M0 established the Nx monorepo, Native Federation spike, and Python integration with `uv`. Milestone M1 now builds the data foundation and runtime configuration infrastructure. See `proposal.md` for background and motivation.

## Goals / Non-Goals

**Goals:**
- Provide a clear migration inbox directory (`data/migrations/`) where source SQLite files can be placed or uploaded.
- Build an idempotent ETL pipeline that validates timestamps, maps `is_fine_tuned` to `sampling: "scheduled" | "on_demand"`, flattens JSON readings into `measurements`, creates indexes, and performs an atomic swap to `data/derived/measurements.db`.
- Build a synthetic dataset generator producing realistic multi-device environmental measurements and injected anomalies for tests and demos without private data.
- Implement file-based runtime LLM configuration (`data/runtime-config.json`) with symmetric AES-256 encryption for the API key and strict resolution precedence (`runtime-config.json` > `.env` > code defaults).

**Non-Goals:**
- In-browser file upload UI (deferred to Milestone M3 / M2).
- Incremental continuous sync or live streaming ingestion (stretch goal for M9; M1 focuses on snapshot ETL).
- Writing data back to the source database (strictly prohibited by non-negotiable rules).

## Decisions

### Decision 1: Python-based ETL and Seed Generation via `uv`
- **Choice**: Implement the ETL script and synthetic seed generator in Python within `apps/agent-service/scripts/` (or `src/agent_service/data/`), invoked via `uv run` commands wrapped in Nx targets.
- **Rationale**: Python's standard `sqlite3` and `json` modules provide high performance and zero external dependencies for JSON extraction. Co-locating ETL and synthetic data generation with the Python agent service unifies data models with anomaly detection and eval suites.
- **Alternatives Considered**: TypeScript ETL with `better-sqlite3` (rejected to keep data analysis and anomaly seeding unified in Python).

### Decision 2: Atomic SQLite Derived Database Swap
- **Choice**: Write derived transformations and index creation to a temporary staging file (`measurements.db.tmp`), and swap it to `data/derived/measurements.db` using an atomic file rename (`os.replace`).
- **Rationale**: Ensures that concurrent or future NestJS API read queries never encounter a partially populated or unindexed database during an ETL run.
- **Alternatives Considered**: In-place table drops and recreation (rejected due to lock contention and dirty reads).

### Decision 3: Cross-Language AES-256-GCM Secret Encryption
- **Choice**: Use standard AES-256-GCM for encrypting the `api_key` in `data/runtime-config.json`. Persist as formatted string `enc:aes256:<nonce_hex>:<tag_hex>:<ciphertext_hex>`.
- **Rationale**: Supported natively in Python (`cryptography` library) and Node.js (`node:crypto`), providing authenticated encryption that prevents plain-text keys on disk and detects tampering.
- **Alternatives Considered**: Base64 obfuscation (insecure), asymmetric RSA (unnecessary complexity for a two-service local architecture).

### Decision 4: Deterministic Synthetic Dataset Generator
- **Choice**: Generate synthetic sensor readings using diurnal sinusoidal base curves, Gaussian noise, and configurable anomaly injection windows (spikes, peer divergence, flatlines, gaps).
- **Rationale**: Gives full reproducibility for unit tests and future M5 anomaly evaluation suites without leaking real user data.

## Risks / Trade-offs

- **[Risk] Private source databases accidentally committed to Git** → Explicitly ignore `*.db`, `*.sqlite`, `*.sqlite3`, and `data/migrations/*.db` in root `.gitignore`.
- **[Risk] Schema mismatch if real database schema changes** → ETL script runs strict validation checks on tables, metric keys, and data types, halting with clear error messages before staging swap.
- **[Risk] Missing runtime config encryption key** → Default to a deterministic workspace development secret if `CONFIG_ENCRYPTION_KEY` is unset, logging a security notice.
