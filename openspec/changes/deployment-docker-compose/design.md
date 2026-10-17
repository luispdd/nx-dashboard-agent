## Context

The IoT dashboard and agent system is composed of an Angular shell SPA host, a React chat assistant micro frontend remote loaded via Native Federation, a NestJS telemetry API, and a Python FastAPI agent service. Recent changes consolidated data transformations into `EtlService` and synthetic generation into `SeedService` inside `dashboard-api`. The system must now be containerized using Docker and Docker Compose while preserving identical developer workflows and ports on the host.

See `proposal.md` for problem motivation and scope.

## Goals / Non-Goals

**Goals:**
- Provide a 3-container topology (`web-host`, `dashboard-api`, `agent-service`) orchestrating the entire system via `docker compose up --build`.
- Support self-bootstrapping demo data out-of-the-box on a fresh clone if `data/derived/measurements.db` is absent.
- Ensure strict port and route parity (`4200`, `4204`, `3000`, `8000`) between Docker and local host execution (`nx run-many -t serve`).
- Support host-local LLM connectivity across Linux, macOS, and Windows via `host.docker.internal`.
- Enable the unified Playwright E2E suite (`bun run e2e`) to execute against either the live Dockerized stack or local dev servers without configuration changes.

**Non-Goals:**
- Containerizing the local LLM runner (e.g. Unsloth, Ollama). The LLM runs on the host to leverage host GPU hardware.
- Introducing an API gateway, Kubernetes manifests, or production reverse proxies beyond Nginx.
- Creating separate container instances for the Angular host and React remote.

## Decisions

### 1. Three-Service Container Topology with Multi-Port Nginx
- **Decision**: Deploy exactly three services: `web-host` (Nginx), `dashboard-api` (NestJS), and `agent-service` (FastAPI). The `web-host` container listens on both port `4200` (Angular shell SPA + `/api` reverse proxy) and port `4204` (React `chat-mfe` with CORS headers).
- **Rationale**: Keeps container count minimal and resource footprint low. Port 4200 matches the Angular dev server port and proxies `/api` requests same-origin to `dashboard-api:3000`. Port 4204 serves the federated remote with `Access-Control-Allow-Origin: *` matching `federation.manifest.json` (`http://localhost:4204/remoteEntry.json`).
- **Alternatives Considered**:
  - *Two separate Nginx containers (one per frontend)*: Rejected for unnecessary resource overhead and port coordination complexity.
  - *Single Nginx port with sub-path routing (`/chat`)*: Rejected because Native Federation manifest resolution and Vite asset chunk paths are built around dedicated origin ports.

### 2. In-Process API Self-Bootstrapping for Demo Data
- **Decision**: When `dashboard-api` starts, `DatabaseModule` checks if `data/derived/measurements.db` exists. If missing, it invokes in-process `SeedService` to generate `data/migrations/source.db` (if absent) and runs `EtlService` to produce `measurements.db` with `is_demo = true` before opening database connections.
- **Rationale**: Eliminates the need for external init containers, complex entrypoint shell scripts, or inter-service startup races. The compiled NestJS bundle already contains `better-sqlite3`, `SeedService`, and `EtlService`.
- **Alternatives Considered**:
  - *Dedicated `db-init` container in Docker Compose*: Rejected as redundant now that both seed generation and ETL live in TypeScript within `dashboard-api`.
  - *Entrypoint bash script invoking CLI scripts*: Rejected because it requires bundling development tools (`jiti`, `tsx`) inside the production container.

### 3. Docker Directory Organization & Multi-Stage Builds
- **Decision**: Colocate all Docker assets inside a dedicated `docker/` directory:
  - `docker/Dockerfile.web`: Multi-stage build (Node 22 / Bun builder compiling `dashboard-shell` and `chat-mfe` -> `nginx:1.27-alpine` runner).
  - `docker/Dockerfile.api`: Multi-stage build (Node 22 builder -> `node:22-slim` runner with production `node_modules` and compiled `better-sqlite3`).
  - `docker/Dockerfile.agent`: Astral `ghcr.io/astral-sh/uv:python3.13-bookworm-slim` with layer-cached `uv sync --frozen --no-dev`.
  - `docker/nginx.conf`: Multi-port virtual host configuration.
  - Root `docker-compose.yml` and `.dockerignore`.
- **Rationale**: Isolates deployment files from application source trees while keeping the workspace root tidy.

### 4. Zero-Friction Networking and Host LLM Resolution
- **Decision**:
  - Compose services join a single default internal bridge network.
  - `agent-service` sets `extra_hosts: ["host.docker.internal:host-gateway"]` to connect to host LLM servers.
  - In `agent-service/config.py`, when `RUNNING_IN_DOCKER=true`, `llm_base_url` normalizes `127.0.0.1` and `localhost` to `host.docker.internal`, allowing the root `.env` to keep `http://127.0.0.1:8888/v1` for both environments without manual editing.
  - `DASHBOARD_API_URL` is set to `http://dashboard-api:3000` via compose environment override.

## Risks / Trade-offs

- **[Risk] Linux host file permission mismatch on volume mounts**:
  - *Details*: Files created by containers running as `root` inside `./data/migrations` and `./data/derived` may be owned by root on the host, preventing non-root local commands from modifying them.
  - *Mitigation*: Run containers with `user: "${UID:-1000}:${GID:-1000}"` or ensure directory permissions allow read/write access.
- **[Risk] Host firewall blocking `host.docker.internal`**:
  - *Details*: On Linux systems with strict UFW / iptables rules, connections from Docker bridge to host ports (e.g. 8888) can be dropped.
  - *Mitigation*: Document requirement that host LLM runner must listen on `0.0.0.0` or allow incoming connections from the Docker bridge interface.
- **[Risk] Docker build context size**:
  - *Details*: Unfiltered `COPY . .` copying `node_modules` or `.venv` can slow down builds.
  - *Mitigation*: Provide a comprehensive `.dockerignore` excluding all dependency directories, temporary files, test reports, and SQLite database artifacts.

## Migration Plan

1. Create `docker/` directory and configure multi-stage Dockerfiles (`Dockerfile.web`, `Dockerfile.api`, `Dockerfile.agent`) and `nginx.conf`.
2. Add `.dockerignore` at workspace root.
3. Update `dashboard-api` to self-bootstrap `SeedService` + `EtlService` on missing database.
4. Update `agent-service` config to handle Docker environment detection and `host.docker.internal` normalization.
5. Create `docker-compose.yml` at workspace root with service declarations, health checks, volumes, and port mappings.
6. Add convenience scripts (`docker:up`, `docker:down`, `docker:build`, `docker:logs`) to `package.json`.
7. Verify both `docker compose up --build` and local `nx run-many -t serve` workflows.
