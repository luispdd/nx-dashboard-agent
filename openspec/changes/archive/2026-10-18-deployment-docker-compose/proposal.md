## Why

The IoT dashboard and agent system currently runs as four distinct local processes across Node.js, Bun, and Python with manual startup steps. To complete Milestone M7, the entire stack must be deployable with a single `docker compose up --build` command, running 100% containerized with zero manual bootstrapping, while preserving the existing local development workflow on identical host ports (`4200`, `4204`, `3000`, `8000`).

## What Changes

- **Multi-Stage Dockerfiles**:
  - `docker/Dockerfile.web`: Multi-stage build compiling Angular shell SPA and React `chat-mfe` with Bun/Node, served via a lightweight `nginx:alpine` runner.
  - `docker/Dockerfile.api`: Multi-stage build for NestJS Fastify API with pre-compiled `better-sqlite3` native bindings and production dependencies.
  - `docker/Dockerfile.agent`: Multi-stage build for FastAPI Python 3.13 application leveraging `uv` package manager with layer-cached frozen dependencies.
- **Multi-Port Nginx Server (`web-host`)**:
  - Port `4200`: Serves Angular Shell SPA with client-side SPA routing (`try_files`) and transparent `/api/` reverse proxy to `dashboard-api:3000`.
  - Port `4204`: Serves React Chat MFE static assets and `remoteEntry.json` with CORS headers (`Access-Control-Allow-Origin: *`) for Native Federation.
- **Docker Compose Orchestration (`docker-compose.yml`)**:
  - Declarative orchestration of the 3 services (`web-host`, `dashboard-api`, `agent-service`).
  - Shared volume mounts for `./data/migrations` and `./data/derived`.
  - Host-local LLM resolution on Linux/macOS/Windows via `extra_hosts: ["host.docker.internal:host-gateway"]`.
  - Health checks and dependency gates (`depends_on: condition: service_healthy`).
- **Auto-Bootstrap Demo Data**:
  - `dashboard-api` checks for `measurements.db` on startup; if absent, it runs in-process `SeedService` and `EtlService` to synthesize demo data immediately with `is_demo = true`.
- **Local Development Parity**:
  - Identical ports across Docker and local execution.
  - Automatic `host.docker.internal` translation in `agent-service` when running inside Docker so root `.env` requires no modifications.
  - Root package scripts for `docker:up`, `docker:down`, `docker:build`, and `docker:logs`.

## Capabilities

### New Capabilities
- `container-deployment`: Multi-stage containerization, multi-port Nginx routing (4200 SPA & proxy, 4204 CORS remote), Docker Compose lifecycle orchestration, service health checks, and host-local LLM gateway integration.

### Modified Capabilities
- `data-migration-inbox-and-etl`: Automatic database auto-bootstrap on service startup when `measurements.db` is missing, generating synthetic seed fixtures and running in-process ETL with `is_demo = true`.

## Impact

- **Build & Packaging**: New `docker/` directory containing Dockerfiles, `nginx.conf`, `.dockerignore`, and root `docker-compose.yml`.
- **API Runtime**: `apps/dashboard-api` auto-bootstrap lifecycle hook on startup before database initialization.
- **Agent Service**: `apps/agent-service` config loader supports Docker environment detection and `host.docker.internal` resolution.
- **Developer Workflow**: `package.json` adds Docker lifecycle scripts while preserving `nx serve`, `bun run start`, and `bun run e2e`.
