# ADR-026: Observability — Structured Logs-Only Observability Without Heavy APM

## Status
Accepted

## Context
Production-grade observability often pulls in heavy agent dependencies, distributed tracing collectors (OpenTelemetry Collector, Jaeger), APM daemons (Datadog, Dynatrace), or external SaaS ingestion endpoints.

For this proof-of-concept IoT dashboard and agent system:
1. Adding OTel sidecars, collector services, and heavy instrumentation packages adds significant memory and CPU overhead to local Docker deployments.
2. Third-party SaaS collectors require credentials, networking egress, and external accounts that hinder frictionless evaluation by external developers.
3. Troubleshooting requires inspecting prompt traces, tool call executions, error stacks, and request timings without relying on external UI dashboards.

## Decision
We adopt a **structured, logs-only observability** model across all services:

1. **Standardized Structured Logging**:
   - `apps/dashboard-api` (NestJS) and `apps/agent-service` (FastAPI) output structured JSON logs to standard output (`stdout`).
   - Log entries include timestamp (UTC `Z`), log level, service name, correlation/request ID, message, and structured context metadata.
2. **Agent Execution Tracing**:
   - The agent service logs end-to-end execution events: prompt arrival, LLM interaction latency, tool name and arguments, tool output summaries, token usage, and final response synthesis.
   - Sensitive credentials (e.g. `LLM_API_KEY`) are masked before emission.
3. **Log Aggregation via Standard Container Runtimes**:
   - Container logs are captured naturally by Docker Compose logging drivers (`docker compose logs -f`) without specialized sidecars.

## Consequences & Verification
- **Zero External Overhead**: No extra containers (Jaeger, Zipkin, Collector) required to inspect system execution.
- **Inspectability**: Running `docker compose logs -f agent-service` or `nx run-many -t serve` streams clear, correlated trace records directly to the terminal.
- **Production Path**: Because logs are emitted in JSON with consistent keys, they can be ingested directly by any standard collector (FluentBit, Vector, CloudWatch, Datadog) without code changes if enterprise deployment is needed later.
