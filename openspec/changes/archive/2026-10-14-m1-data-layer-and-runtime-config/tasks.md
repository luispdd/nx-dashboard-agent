## 1. Directory Structure and Security Setup

- [x] 1.1 Create `data/migrations/` and `data/derived/` directories with `.gitkeep` files, and update `.gitignore` to ignore `*.db`, `*.sqlite*`, `data/migrations/*.db`, `data/derived/*.db`, and `data/runtime-config.json`. Verify with `git status` that database and config files are ignored.
- [x] 1.2 Add `cryptography` dependency to `apps/agent-service/pyproject.toml` via `uv add cryptography` and verify lockfile and dependencies sync cleanly.

## 2. Runtime Configuration Foundation

- [x] 2.1 Implement symmetric AES-256-GCM encryption and decryption helpers in `apps/agent-service/src/agent_service/security.py` supporting format `enc:aes256:<nonce_hex>:<tag_hex>:<ciphertext_hex>`. Verify with unit tests in `apps/agent-service/tests/test_security.py`.
- [x] 2.2 Update `apps/agent-service/src/agent_service/config.py` to check for `data/runtime-config.json`, decrypt `api_key_encrypted`, and overlay values before falling back to `.env` and defaults. Verify resolution precedence in `apps/agent-service/tests/test_config.py`.
- [x] 2.3 Update `apps/agent-service/src/agent_service/llm_client.py` and `tests/test_llm_client.py` to ensure generic OpenAI-compatible model handling without hardcoded Unsloth dependencies. Verify all agent service tests pass with `uv run pytest`.

## 3. Synthetic Seed Generator

- [x] 3.1 Implement synthetic database generator in `apps/agent-service/src/agent_service/data/seed_generator.py` creating `nodes`, `sensor_capabilities`, `readings`, and `sync_state` matching the source schema with UTC timestamps (`YYYY-MM-DDTHH:MM:SS`). Verify generation with unit tests.
- [x] 3.2 Add anomaly injection capabilities (peer deviation, spike, flatline, gap) into `seed_generator.py` with configurable flags and known anomaly labels. Verify anomalies are generated as expected in `apps/agent-service/tests/test_seed_generator.py`.
- [x] 3.3 Create a CLI entrypoint for the seed generator outputting to `data/migrations/source.db` by default. Verify execution via command line.

## 4. ETL Pipeline

- [x] 4.1 Implement ETL extractor and snapshot loader in `apps/agent-service/src/agent_service/data/etl.py` reading from `data/migrations/source.db` safely in read-only mode. Verify read-only access behavior.
- [x] 4.2 Implement timestamp validation and normalization in `etl.py`, asserting ISO-8601 UTC format and appending `Z` (`2026-10-05T08:36:23` -> `2026-10-05T08:36:23Z`), rejecting malformed dates. Verify with unit tests.
- [x] 4.3 Implement JSON metrics flattener in `etl.py`, mapping `readings.metrics` keys into discrete `measurements` rows and translating `is_fine_tuned` to `sampling: "scheduled" | "on_demand"`. Verify flattening logic with unit tests.
- [x] 4.4 Implement `metrics_catalog` builder and unit validation in `etl.py`, ensuring consistent units per metric key across all nodes and rejecting conflicts loudly. Verify conflict detection in unit tests.
- [x] 4.5 Implement derived database staging, indexing (`device_id, metric_key, ts`), and atomic swap (`os.replace`) to `data/derived/measurements.db`. Verify database swap integrity.

## 5. Nx Task Integration and End-to-End Validation

- [x] 5.1 Configure Nx run-commands targets in `apps/agent-service/project.json` for `seed` and `etl` wrapping `uv run`. Verify `bunx nx run agent-service:seed` and `bunx nx run agent-service:etl` execute successfully.
- [x] 5.2 Execute end-to-end pipeline: generate synthetic seed, run ETL migration, verify `data/derived/measurements.db` schema and row counts, and ensure all tests pass with `bunx nx affected -t test,lint`.
