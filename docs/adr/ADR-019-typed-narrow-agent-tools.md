# ADR-019: Agent Tool Design — Typed Narrow Tools Without Free-Form SQL

## Status
Accepted

## Context
When integrating Large Language Models (LLMs) with relational databases, an initial inclination is often to provide a "Text-to-SQL" tool that allows the LLM to generate raw SQL queries dynamically against the schema.

However, in an IoT telemetry and diagnostic dashboard:
1. **Safety & Injection**: Generating raw SQL introduces severe security and operational risks (denial of service through pathological joins, unbounded scans on large telemetry tables, potential injection).
2. **Determinism & Hallucination**: LLMs frequently hallucinate column names, misinterpret timestamp timezone semantics, or forget crucial business filters (e.g. excluding on-demand calibration readings from scheduled averages).
3. **Auditability**: Free-form SQL queries are difficult to validate, benchmark, cache, and trace in production telemetry.

## Decision
We prohibit free-form SQL execution by the LLM agent. Instead, we expose strictly **typed, narrow tools** implemented as deterministic Python functions calling structured HTTP endpoints on `dashboard-api`.

1. **Explicit Function Contracts**:
   - `list_devices`: Enumerate known IoT sensor nodes and active metrics.
   - `get_telemetry`: Fetch aggregated time-series readings for a specific device, metric, time window, and sampling filter.
   - `detect_anomalies`: Run deterministic statistical detection algorithms against telemetry.
2. **Strict Parameter Validation**:
   - Tool arguments use Pydantic schemas validating bounds, ISO 8601 UTC timestamps, and recognized device IDs.
3. **Domain Guardrails**:
   - Tool implementations encapsulate domain rules, such as defaulting to regular scheduled readings (`sampling: "scheduled"`) and rejecting unbounded time ranges.

## Consequences & Verification
- **Predictability**: Agent tool invocations are deterministic, schema-validated, and reproducible.
- **Safety**: Uncontrolled SQL queries cannot execute against the storage layer.
- **Evaluation**: Each typed tool has dedicated unit tests and can be verified against frozen test fixtures in agent evaluation benchmarks.
