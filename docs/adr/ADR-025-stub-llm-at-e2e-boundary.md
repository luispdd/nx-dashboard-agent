# ADR-025: End-to-End Testing — Stub LLM Endpoint at the E2E Boundary

## Status
Accepted

## Context
Validating the full-stack system requires testing the entire path: Angular host, Native Federation React remote, SSE streaming chat, Python agent service, tool dispatch, and NestJS API queries.

However, calling real external LLM providers (or requiring a local GPU-bound LLM runner like Ollama or Unsloth) during automated CI and E2E test runs causes major issues:
1. **Flakiness & Non-Determinism**: Real LLMs generate non-deterministic natural language tokens, complicating assertions.
2. **Execution Latency**: Streaming LLM inference can take tens of seconds per prompt, slowing CI test suites.
3. **External Dependencies & Costs**: API keys, quotas, rate limits, or heavy GPU hardware requirements make CI pipelines brittle and expensive.

## Decision
We introduce a **deterministic stub LLM endpoint at the external HTTP boundary** for automated E2E tests:

1. **Protocol-Compliant OpenAI Stub**:
   - For automated testing (`bun run e2e` / CI), the agent service is configured to target a mock OpenAI-compatible endpoint (`LLM_BASE_URL`).
   - The stub responds with protocol-compliant SSE chunk streams, simulated tool calls (`list_devices`, `get_telemetry`), and predictable responses.
2. **Testing Strategy Alignment**:
   - The entire stack is live and unmocked: real browser, real Native Federation, real Angular signals, real React chat UI, real FastAPI SSE endpoint, real tool execution, real NestJS API, and real SQLite database.
   - The *only* mock exists at the outermost LLM network boundary, isolating LLM variance while exercising 100% of the application code.
3. **Evaluation Separation**:
   - Real LLM capabilities (prompt adherence, reasoning quality, tool-calling precision) are validated separately via the offline eval benchmark suite (`nx run agent-service:eval`).

## Consequences & Verification
- **Fast, Deterministic CI**: E2E test suites run completely within seconds on standard headless CI runners without GPU or API keys.
- **Full-Stack Coverage**: Verifies UI rendering, SSE connection handling, loading states, error boundaries, and tool visualizers end-to-end.
