# ADR-018: Architecture Scope — Two Backend Services Instead of Full Microservices

## Status
Accepted

## Context
A common architectural trap for IoT and AI-assisted telemetry systems is premature decomposition into distributed microservices (e.g. separate ingest service, query service, aggregation service, alert service, agent service, database-per-service, API gateways, message queues, and distributed consensus).

For this proof of concept:
1. The domain consists of read-heavy IoT sensor telemetry and an LLM-powered natural language analytical assistant.
2. The team and operational footprint require simplicity, minimal deployment friction, and instant local reproducibility without Docker Compose sprawl or distributed orchestration headaches.
3. Complex distributed patterns (event brokers, distributed transactions/sagas, outbox pattern, service mesh, API gateway proxies) introduce high operational maintenance overhead without performance or organizational benefit at this scale.

## Decision
We enforce a strict **two-backend-services** architectural topology:
1. **Dashboard API (`apps/dashboard-api`)**: NestJS service responsible for domain queries against the derived read-only SQLite database, ETL coordination, and OpenAPI documentation.
2. **Agent Service (`apps/agent-service`)**: FastAPI service running in Python with `uv`, responsible for LLM orchestration, conversation history, and deterministic statistical anomaly detection.

Rules and boundaries:
- **No API gateway, gRPC, message brokers (Kafka/RabbitMQ), Redis, sagas, outbox, or database-per-service.**
- Frontends communicate directly with their target backends: `dashboard-shell` calls `dashboard-api`, and `chat-mfe` calls `agent-service`.
- In containerized deployments, services run as isolated Docker containers within a single Docker network coordinated via Docker Compose.

## Consequences & Verification
- **Simplicity**: System topology can be held in mind by a single developer and booted with `docker compose up` in seconds.
- **Maintainability**: Eliminates distributed network failure modes, queue lag monitoring, and distributed transaction synchronization.
- **Traceability**: All API interactions between services are synchronous HTTP/1.1 calls verified through explicit OpenAPI schemas.
