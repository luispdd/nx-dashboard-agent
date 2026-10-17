# container-deployment Specification

## Purpose

Defines containerization and deployment specifications for orchestrating the IoT telemetry dashboard, chat assistant micro frontend, API, and agent services using Docker and Docker Compose.

## Requirements

### Requirement: Multi-stage Docker container builds
The system SHALL provide hermetic, multi-stage Dockerfiles for all tiers (`web-host`, `dashboard-api`, and `agent-service`) that isolate build-time dependencies from the final lightweight runtime images.

#### Scenario: Building dashboard API runtime container
- **WHEN** `docker build` executes against `docker/Dockerfile.api`
- **THEN** the builder stage SHALL bundle the NestJS application and compile native `better-sqlite3` bindings, and the runner stage SHALL produce a Node.js runtime image excluding developer dependencies

#### Scenario: Building agent service runtime container
- **WHEN** `docker build` executes against `docker/Dockerfile.agent`
- **THEN** the runner stage SHALL install frozen dependencies using `uv` with layer caching and run Uvicorn on Python 3.13 without development packages

#### Scenario: Building web host static container
- **WHEN** `docker build` executes against `docker/Dockerfile.web`
- **THEN** the builder stage SHALL compile the Angular shell and React chat MFE, and the runner stage SHALL copy static distribution bundles into a lightweight Nginx image

### Requirement: Multi-port Nginx routing and CORS configuration
The `web-host` Nginx service SHALL listen on multiple ports simultaneously to serve the host shell and remote micro frontend while eliminating cross-origin blockers and proxying API traffic.

#### Scenario: Serving Angular dashboard shell on port 4200
- **WHEN** an HTTP client requests `http://localhost:4200/` or client-side SPA routes
- **THEN** Nginx SHALL serve the Angular shell SPA and route unknown paths to `/index.html`

#### Scenario: Reverse proxying dashboard API calls on port 4200
- **WHEN** the browser on port 4200 requests `/api/*` endpoints
- **THEN** Nginx SHALL reverse proxy requests to `http://dashboard-api:3000/api/*` supporting request payloads up to 100 MB

#### Scenario: Serving React chat remote with CORS headers on port 4204
- **WHEN** the browser requests `http://localhost:4204/remoteEntry.json` or federated asset chunks
- **THEN** Nginx SHALL respond with `Access-Control-Allow-Origin: *` headers and handle `OPTIONS` preflight requests

### Requirement: Docker Compose orchestration and volume persistence
The system SHALL provide a `docker-compose.yml` configuration that coordinates service startup, health checks, shared data volumes, and network isolation across the stack.

#### Scenario: Starting complete stack via Docker Compose
- **WHEN** `docker compose up` is executed
- **THEN** all three services (`web-host`, `dashboard-api`, and `agent-service`) SHALL start on their standard mapped ports (`4200`, `4204`, `3000`, `8000`) and establish shared volume mounts for `./data/migrations` and `./data/derived`

#### Scenario: Service dependency ordering and health gating
- **WHEN** services launch in Docker Compose
- **THEN** `dashboard-api` and `agent-service` SHALL pass HTTP health checks before `web-host` accepts incoming frontend traffic

### Requirement: Host-local LLM gateway resolution
The `agent-service` container SHALL support connecting to local LLM inference engines (such as Unsloth or Ollama) running on the host machine.

#### Scenario: Resolving host machine from container on Linux and macOS
- **WHEN** `agent-service` attempts to reach an LLM endpoint running on the host machine
- **THEN** on Linux it SHALL access the host's loopback interface directly via `network_mode: host` to reach engines bound to `127.0.0.1` (such as Unsloth) or via gateway resolution on Docker Desktop systems

### Requirement: Local development and Docker runtime parity
The system SHALL allow developers to toggle between containerized execution and local `nx serve` workflows without altering root configuration or data paths.

#### Scenario: Running local development tools alongside Docker configuration
- **WHEN** a developer executes `nx run-many -t serve` on the host machine
- **THEN** services SHALL bind to the identical ports (`4200`, `4204`, `3000`, `8000`) and read/write to the identical `./data/` directories as the containerized environment
