## 1. Application Container Readiness & Auto-Bootstrap

- [x] 1.1 Add database auto-bootstrap logic to `dashboard-api` (`apps/dashboard-api/src/app/database/database.module.ts`) to execute `SeedService` (if `data/migrations/source.db` is missing) and `EtlService` when `data/derived/measurements.db` is absent on application startup, verifying with unit tests in `apps/dashboard-api/src/app/database/database.module.spec.ts`.
- [x] 1.2 Update `agent-service` configuration (`apps/agent-service/src/agent_service/config.py`) to support `RUNNING_IN_DOCKER=true` and automatically normalize `127.0.0.1` and `localhost` to `host.docker.internal` for `llm_base_url`, verifying with unit tests in `apps/agent-service/tests/test_config.py`.

## 2. Docker Packaging & Multi-Stage Builds

- [x] 2.1 Create `.dockerignore` at repository root excluding `node_modules`, `.venv`, `dist`, `.git`, temporary artifacts, test reports, and local database files.
- [x] 2.2 Create `docker/Dockerfile.api` for `dashboard-api` using multi-stage build (`node:22-slim`) with Webpack bundling and compiled `better-sqlite3` runtime dependencies, verifying build execution with `docker build -f docker/Dockerfile.api -t dashboard-api-test .`.
- [x] 2.3 Create `docker/Dockerfile.agent` for `agent-service` using `ghcr.io/astral-sh/uv:python3.13-bookworm-slim` with layer-cached frozen dependencies, verifying build execution with `docker build -f docker/Dockerfile.agent -t agent-service-test .`.
- [x] 2.4 Create `docker/nginx.conf` configuring port `4200` (Angular shell SPA fallback and `/api/` reverse proxy to `dashboard-api:3000`) and port `4204` (React `chat-mfe` static assets with CORS headers), and create `docker/Dockerfile.web` bundling both frontends into `nginx:1.27-alpine`, verifying build execution with `docker build -f docker/Dockerfile.web -t web-host-test .`.

## 3. Docker Compose Orchestration & Verification

- [x] 3.1 Create root `docker-compose.yml` declaring `web-host`, `dashboard-api`, and `agent-service` services with shared volume mounts (`./data/migrations`, `./data/derived`), health checks, port bindings (`4200`, `4204`, `3000`, `8000`), and `extra_hosts` for host LLM reachability.
- [x] 3.2 Add container lifecycle scripts (`docker:up`, `docker:down`, `docker:build`, `docker:logs`) to root `package.json`.
- [x] 3.3 Validate the containerized stack end-to-end: boot with `docker compose up -d --build`, verify auto-bootstrap creates `measurements.db` with `is_demo: true`, verify health check endpoints for all three containers, and verify clean teardown with `docker compose down`.
- [x] 3.4 Verify that local development on host (`nx run-many -t serve --outputStyle=stream`) and Playwright E2E tests (`bun run e2e`) remain fully operational without configuration divergence.
