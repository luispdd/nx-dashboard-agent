# Architecture Decision Records (ADRs)

This directory documents the significant architectural decisions made during the evolution of the IoT Dashboard + Data Agent workspace.

## Index of Architectural Decisions

| ADR | Title | Status | Scope |
| :--- | :--- | :--- | :--- |
| [ADR-004](ADR-004-native-federation-mfe-spike.md) | Microfrontend Architecture — Native Federation for Angular Host and React Remote | Accepted | Frontend / Microfrontends |
| [ADR-0014](0014-dashboard-mcp-server.md) | In-Process Dashboard MCP Server for Telemetry Tools | Accepted | Dashboard API / MCP |
| [ADR-0015](0015-agent-mcp-tool-discovery.md) | Agent Dynamic MCP Tool Discovery and Anomaly Detection Decoupling | Accepted | Agent Service / MCP |
| [ADR-015](ADR-015-apexcharts-visualization.md) | Time-Series Data Visualization with ApexCharts | Accepted | Dashboard Shell / Charts |
| [ADR-016](ADR-016-python-uv-in-nx-spike.md) | Python Fast Package & Environment Management with uv in Nx Monorepo | Accepted | Workspace / Tooling |
| [ADR-017](ADR-017-local-llm-unsloth-connectivity-spike.md) | Local LLM Connectivity — Unsloth & Ollama Integration | Accepted | AI / Local LLM |
| [ADR-018](ADR-018-two-backend-services-architecture.md) | Architecture Scope — Two Backend Services Instead of Full Microservices | Accepted | Backend / System Architecture |
| [ADR-019](ADR-019-typed-narrow-agent-tools.md) | Agent Tool Design — Typed Narrow Tools Without Free-Form SQL | Accepted | Agent Service / Security |
| [ADR-020](ADR-020-deterministic-anomaly-statistics.md) | Anomaly Detection — Deterministic Python Statistics with LLM Interpretation | Accepted | Agent Service / Analytics |
| [ADR-021](ADR-021-agent-service-never-touches-database.md) | Service Decoupling — Agent Service Never Connects Directly to the Database | Accepted | Backend / Data Isolation |
| [ADR-022](ADR-022-openapi-contract-first-generated-clients.md) | API Contracts — OpenAPI as Single Source of Truth with Generated Clients | Accepted | Contracts / Codegen |
| [ADR-023](ADR-023-derived-readonly-database-via-etl.md) | Data Pipeline — Read-Only Derived SQLite Database via In-Process ETL | Accepted | Data / Storage |
| [ADR-024](ADR-024-utc-iso8601-timestamps.md) | Temporal Data — UTC with Z Timestamps Everywhere Internally | Accepted | Data / Invariants |
| [ADR-025](ADR-025-stub-llm-at-e2e-boundary.md) | End-to-End Testing — Stub LLM Endpoint at the E2E Boundary | Accepted | Testing / E2E |
| [ADR-026](ADR-026-logs-only-observability.md) | Observability — Structured Logs-Only Observability Without Heavy APM | Accepted | Operations / Telemetry |
| [ADR-027](ADR-027-local-only-threat-model-and-defense-in-depth.md) | Local Hardening — Local-Only Threat Model and Defense-in-Depth Architecture | Accepted | Security / Architecture |

## ADR Format

Each record is named according to `ADR-NNN-<kebab-case-slug>.md` and follows standard sections:
- **Status**: Status of the decision (Accepted, Proposed, Deprecated, Superseded).
- **Context**: The forces, requirements, and constraints motivating the decision.
- **Decision**: The selected strategy, tools, protocols, and implementation rules.
- **Consequences & Verification**: The resulting benefits, trade-offs, and verification steps.
