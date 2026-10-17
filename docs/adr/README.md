# Architecture Decision Records (ADRs)

This directory documents the significant architectural decisions made during the evolution of the IoT Dashboard + Data Agent workspace.

## Index of Architectural Decisions

| ADR | Title | Status | Scope |
| :--- | :--- | :--- | :--- |
| [ADR-004](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-004-native-federation-mfe-spike.md) | Microfrontend Architecture — Native Federation for Angular Host and React Remote | Accepted | Frontend / Microfrontends |
| [ADR-015](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-015-apexcharts-visualization.md) | Time-Series Data Visualization with ApexCharts | Accepted | Dashboard Shell / Charts |
| [ADR-016](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-016-python-uv-in-nx-spike.md) | Python Fast Package & Environment Management with uv in Nx Monorepo | Accepted | Workspace / Tooling |
| [ADR-017](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-017-local-llm-unsloth-connectivity-spike.md) | Local LLM Connectivity — Unsloth & Ollama Integration | Accepted | AI / Local LLM |
| [ADR-018](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-018-two-backend-services-architecture.md) | Architecture Scope — Two Backend Services Instead of Full Microservices | Accepted | Backend / System Architecture |
| [ADR-019](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-019-typed-narrow-agent-tools.md) | Agent Tool Design — Typed Narrow Tools Without Free-Form SQL | Accepted | Agent Service / Security |
| [ADR-020](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-020-deterministic-anomaly-statistics.md) | Anomaly Detection — Deterministic Python Statistics with LLM Interpretation | Accepted | Agent Service / Analytics |
| [ADR-021](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-021-agent-service-never-touches-database.md) | Service Decoupling — Agent Service Never Connects Directly to the Database | Accepted | Backend / Data Isolation |
| [ADR-022](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-022-openapi-contract-first-generated-clients.md) | API Contracts — OpenAPI as Single Source of Truth with Generated Clients | Accepted | Contracts / Codegen |
| [ADR-023](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-023-derived-readonly-database-via-etl.md) | Data Pipeline — Read-Only Derived SQLite Database via In-Process ETL | Accepted | Data / Storage |
| [ADR-024](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-024-utc-iso8601-timestamps.md) | Temporal Data — UTC with Z Timestamps Everywhere Internally | Accepted | Data / Invariants |
| [ADR-025](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-025-stub-llm-at-e2e-boundary.md) | End-to-End Testing — Stub LLM Endpoint at the E2E Boundary | Accepted | Testing / E2E |
| [ADR-026](file:///home/fuchik0ma/code/nx-dashboard-agent/docs/adr/ADR-026-logs-only-observability.md) | Observability — Structured Logs-Only Observability Without Heavy APM | Accepted | Operations / Telemetry |

## ADR Format

Each record is named according to `ADR-NNN-<kebab-case-slug>.md` and follows standard sections:
- **Status**: Status of the decision (Accepted, Proposed, Deprecated, Superseded).
- **Context**: The forces, requirements, and constraints motivating the decision.
- **Decision**: The selected strategy, tools, protocols, and implementation rules.
- **Consequences & Verification**: The resulting benefits, trade-offs, and verification steps.
