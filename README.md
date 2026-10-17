# IoT Dashboard + Data Agent

A showcase and proof-of-concept monorepo demonstrating modern full-stack architecture: real-world environmental IoT telemetry monitoring, framework-agnostic Micro Frontends via Native Federation, and an intelligent data agent with deterministic anomaly detection.

---

## Architecture Overview

```
 ┌────────────────────────────────── Nx Monorepo ──────────────────────────────────┐
 │                                                                                 │
 │   Angular 22 Host (Shell)  ─────── Native Federation ───────  React 19 Remote   │
 │   • Zoneless & Signals-first                                  (Chat MFE)        │
 │   • Tailwind CSS v4 & ApexCharts                              • Vite + Tailwind │
 │   • Port 4200                                                 • Port 4204       │
 │            │                                                       │            │
 └────────────┼───────────────────────────────────────────────────────┼────────────┘
              │ REST (Proxied in dev via /api)                        │ HTTP + SSE
              ▼                                                       ▼
      NestJS API (TypeScript)                          FastAPI Agent Service (Python)
      • Fastify adapter & Kysely                       • Pydantic Settings & uv
      • Read-only SQLite access                        • Deterministic anomaly stats
      • Port 3000 (/api)                               • Tool execution & LLM orchestration
              │                                                       │
              │                 Agent calls typed API tools           │
              │◄──────────────────────────────────────────────────────┤
              ▼                                                       │ OpenAI-compatible HTTP
      Derived SQLite DB                                               ▼
      (data/derived/measurements.db)                    OpenAI-Compatible LLM Endpoint
      Normalized & indexed via ETL                      (Local runner or Cloud API)
```

---

## Key Architectural Decisions

All architectural decisions are documented in [`docs/adr/`](docs/adr/README.md):

- **[Lean Architecture (ADR-018)](docs/adr/ADR-018-two-backend-services-architecture.md):** Two backend services only. Zero unnecessary enterprise overhead (no API gateway, gRPC, message brokers, Redis, sagas, outbox, or database-per-service bloat).
- **Service Specialization:**
  - **NestJS (TypeScript):** Type-safe REST API, Fastify adapter, OpenAPI contract generation, and query building via Kysely.
  - **FastAPI (Python):** Deterministic mathematical anomaly computation, Pydantic settings, and LLM orchestration via OpenAI-compatible endpoints.
- **[Single Source of Truth (ADR-021)](docs/adr/ADR-021-agent-service-never-touches-database.md):** The agent service never accesses the database directly. It interacts strictly through typed, contract-governed NestJS API endpoints exposed as LLM tools.
- **[Native Federation Micro Frontends (ADR-004)](docs/adr/ADR-004-native-federation-mfe-spike.md):** Angular shell host and React chat remote integrated via browser-native ESM and Import Maps (`@angular-architects/native-federation`). Eliminates legacy Webpack runtime coupling and allows independent framework upgrades.
- **[Time-Series Visualizations (ADR-015)](docs/adr/ADR-015-apexcharts-visualization.md):** Modern responsive charts with ApexCharts and `ng-apexcharts`.
- **[Python Package Management with uv (ADR-016)](docs/adr/ADR-016-python-uv-in-nx-spike.md):** Fast environment and package management via Astral's `uv`.
- **[Local LLM Connectivity (ADR-017)](docs/adr/ADR-017-local-llm-unsloth-connectivity-spike.md):** Unsloth and Ollama integration for local inference.
- **[Read-Only Derived Database & ETL (ADR-023)](docs/adr/ADR-023-derived-readonly-database-via-etl.md):** Raw source logs (`data/migrations/source.db`) are treated as immutable inputs. The ETL pipeline normalizes timestamps, units, and metrics into a query-optimized SQLite database (`data/derived/measurements.db`).
- **[Typed Agent Tools over Free-Form SQL (ADR-019)](docs/adr/ADR-019-typed-narrow-agent-tools.md):** Narrow, strongly validated function schemas prevent hallucinations and ensure secure, reliable data access even with smaller local LLMs.
- **[Deterministic Anomaly Statistics (ADR-020)](docs/adr/ADR-020-deterministic-anomaly-statistics.md):** Statistical metrics (IQR, z-scores, min/max bounds) are computed deterministically in Python. The LLM acts purely as an analytical synthesizer and conversational layer.
- **[Strict UTC Timestamps (ADR-024)](docs/adr/ADR-024-utc-iso8601-timestamps.md):** All dates and timestamps are stored and transmitted internally with ISO 8601 UTC `Z` precision (`YYYY-MM-DDTHH:mm:ssZ`). Timestamps are only converted to the viewer's local timezone at the presentation layer.
- **[OpenAPI as Single Source of Truth (ADR-022)](docs/adr/ADR-022-openapi-contract-first-generated-clients.md):** Zero API drift through contract-first client code generation.
- **[Stub LLM at E2E Boundary (ADR-025)](docs/adr/ADR-025-stub-llm-at-e2e-boundary.md):** Deterministic, fast CI test runs with full-stack coverage.
- **[Logs-Only Observability (ADR-026)](docs/adr/ADR-026-logs-only-observability.md):** Structured JSON logging and agent tracing without heavy APM sidecars.

---

## Monorepo Layout

```
nx-dashboard-agent/
├── apps/
│   ├── dashboard-shell/         # Angular 22 shell (Zoneless, Signals, ApexCharts, Tailwind v4)
│   ├── dashboard-shell-e2e/     # Playwright E2E tests for dashboard shell
│   ├── chat-mfe/                # React 19 micro frontend (Vite, Tailwind v4)
│   ├── chat-mfe-e2e/            # Playwright E2E tests for chat MFE
│   ├── dashboard-api/           # NestJS REST API (Fastify, Kysely, SQLite)
│   └── agent-service/           # FastAPI agent service (Python, uv, ETL, LLM tools)
├── libs/
│   ├── shared/contracts/        # Generated Angular httpResource API client
│   └── shared-mfe-context/      # Shared MFE contracts and inter-app communication
├── data/
│   ├── migrations/              # Ingested source SQLite databases (source.db)
│   └── derived/                 # Derived, read-only analytical database (measurements.db)
├── docs/adr/                    # Architectural Decision Records
└── openspec/                    # Specification-driven development changes and specs
```

---

## Tooling & Prerequisites

Ensure the following tools are installed on your workstation:

- **[Bun](https://bun.com/)** (v1.2+) — Primary package manager for JavaScript/TypeScript (`bun install`).
- **[Python](https://www.python.org/)** (v3.12+) & **[uv](https://docs.astral.sh/uv/)** — Python package and project manager.
- **[Nx](https://nx.dev/)** — Monorepo orchestration (`nx` commands run directly).
- **Node.js** (v22+ LTS).

---

## Quickstart

### 1. Install Dependencies

```bash
# Install JavaScript/TypeScript dependencies
bun install

# Install Python dependencies for the agent service
cd apps/agent-service && uv sync && cd ../..
```

### 2. Populate and Transform Data (ETL)

The dashboard visualizes environmental measurements from physical IoT devices (ESP32-C6, Raspberry Pi Pico W). The raw database lives in `data/migrations/source.db`. Run the ETL pipeline to build the derived analytical database:

```bash
nx run dashboard-api:etl
```

> **Note:** Do not run `nx run dashboard-api:seed` unless you explicitly want to overwrite real telemetry with synthetic demo fixtures.

### 3. Generate API Contracts

The NestJS API serves as the single source of truth for the frontend:

```bash
# 1. Export OpenAPI specification from NestJS
nx run dashboard-api:export-openapi

# 2. Generate Angular httpResource client bindings in libs/shared/contracts
nx run shared-contracts:generate-contracts
```

### 4. Run Development Servers

Start the backend and frontend services in separate terminal sessions:

| Service | Command | Port / URL | Notes |
|---|---|---|---|
| **Dashboard API** | `nx serve dashboard-api` | `http://localhost:3000/api` | NestJS REST API & Swagger docs |
| **Dashboard Shell** | `nx serve dashboard-shell` | `http://localhost:4200` | Angular host (proxies `/api` to port 3000) |
| **Chat MFE** | `nx serve chat-mfe` | `http://localhost:4204` | React remote loaded via Native Federation |
| **Agent Service** | `nx serve agent-service` | `http://localhost:8000` | FastAPI service & tool endpoints |

Open [http://localhost:4200](http://localhost:4200) in your browser to view the dashboard.

> **Tip:** Convenience scripts are configured in `package.json`. You can also run `bun start` (starts API, Shell, and Chat), `bun run serve:shell`, `bun test`, `bun run lint`, `bun run etl`, etc.

---

## Development & Testing Commands

### Testing

```bash
# Run unit tests across all TypeScript projects using Vitest
nx run-many -t test

# Run Python unit tests for the agent service
cd apps/agent-service && uv run pytest

# Run the unified Playwright E2E suite (deterministic LLM stub by default)
bun run e2e
# ...or against a real LLM: E2E_LLM_MODE=real bun run e2e
```

See [docs/testing-strategy.md](docs/testing-strategy.md) for the test layers and the E2E LLM modes.

### Linting & Formatting

```bash
# Lint TypeScript and HTML files across projects
nx affected -t lint

# Lint and check Python code with Ruff
cd apps/agent-service && uv run ruff check .
```

### Building

```bash
# Build all apps and libraries
nx run-many -t build
```

---

## Configuration

Runtime configuration is resolved using a layered approach:
1. `data/runtime-config.json` (git-ignored, active at runtime)
2. `.env` file (see `.env.example`)
3. Built-in defaults

### Key Environment Variables

```bash
# NestJS Dashboard API
PORT=3000
DATABASE_PATH=data/derived/measurements.db

# FastAPI Agent Service
PORT=8000
DASHBOARD_API_BASE_URL=http://localhost:3000/api
LLM_BASE_URL=http://localhost:11434/v1    # e.g., Ollama, vLLM, Unsloth, OpenAI
LLM_MODEL=deepseek-r1:8b                  # Configured LLM model name
LLM_API_KEY=optional_api_key
```

---

## Spec-Driven Development (OpenSpec)

This project strictly adheres to specification-driven development using OpenSpec. All architectural changes, features, and milestones are planned, reviewed, and tracked as formal specifications in `openspec/`.

```bash
# Validate all active specifications
openspec validate --all
```
