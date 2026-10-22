# ADR-027: Local-Only Threat Model and Defense-in-Depth Architecture

## Status
Accepted

## Context
The IoT dashboard and agent system is designed as a proof-of-concept demonstrating IoT telemetry ingestion and local LLM orchestration. Previous configurations bound services to all network interfaces (`0.0.0.0`), permitted unconstrained cross-origin requests (`CORS: *`), lacked host header validation against DNS rebinding, relied on a publicly known development key for configuration encryption, and left the streaming agent endpoint unprotected against accidental resource exhaustion.

Standard enterprise solutions (TLS reverse proxies, OAuth2/OIDC identity providers, browser-held bearer tokens, external API gateways, and distributed rate limiting via Redis) would contradict core project architectural boundaries (two backend services only, no brokers or caches, frictionless local execution).

A threat model and hardening strategy was needed that provides defense-in-depth while remaining strictly local and lightweight.

## Decision
We enforce a **"closed by default" defense-in-depth architecture** tailored to local-first operation without browser-held credentials:

1. **Loopback Binding (`127.0.0.1`)**:
   - Backend services (`dashboard-api` and `agent-service`) default their bind host to `127.0.0.1`.
   - Frontend development servers (`dashboard-shell` on port 4200 and `chat-mfe` on port 4204) bind to `127.0.0.1`.
   - In containerized deployments (`docker-compose.yml`), container ports are published strictly to loopback (`127.0.0.1:${PORT}:${PORT}`).

2. **Host and Origin Validation**:
   - Host headers are validated against `ALLOWED_HOSTS` in both backends, rejecting mismatches with `403 Forbidden` to prevent DNS rebinding attacks.
   - Origin headers are validated against `ALLOWED_ORIGINS`. Requests without an Origin (curl, CLI, server-to-server) are permitted, while foreign browser origins are rejected with `403 Forbidden`.
   - Server-to-server MCP authentication (`POST /api/mcp`) uses `node:crypto.timingSafeEqual` for constant-time bearer token validation.

3. **In-Process Resource & Rate Limiting**:
   - `apps/agent-service` enforces an in-process sliding-window rate limiter (`CHAT_RATE_LIMIT_PER_MINUTE`) returning `429 Too Many Requests` with a standard `Retry-After` header.
   - Concurrent active streaming connections are capped per client address (`CHAT_MAX_CONCURRENT_STREAMS`).
   - Incoming message length is bounded (`CHAT_MAX_MESSAGE_CHARS`) to prevent payload exhaustion attacks.
   - Active chat sessions are capped (`CHAT_MAX_SESSIONS`) with LRU idle session eviction.

4. **Security Headers & Attack Surface Minimization**:
   - `apps/dashboard-api` registers `@fastify/helmet` to emit standard security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`) and suppress `X-Powered-By`.
   - Swagger documentation is togglable via `SWAGGER_ENABLED` (disabled by default in production).

5. **Secret Protection & Strict Key Management**:
   - Runtime configuration encryption in `data/runtime-config.json` requires `CONFIG_ENCRYPTION_KEY` to be set to a secure 32-byte hex key, raising a runtime error on startup if missing unless `ALLOW_INSECURE_DEV_KEY=true` is explicitly configured.
   - Diagnostic endpoints (`/health`) and JSON logging formatters mask API keys, bearer tokens, and encrypted ciphertext payloads.

6. **Frontend XSS Mitigation**:
   - The React chat remote sanitizes markdown links, stripping dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`) and rendering plain text for untrusted URLs.

## Consequences & Verification
- **No Pseudo-Security**: Avoids browser-held tokens that offer false security in single-user local setups.
- **Network Isolation**: Machines running the demo on shared networks (Wi-Fi, LAN) do not expose API or telemetry endpoints to local network peers.
- **DNS Rebinding Resistance**: Browsers visiting malicious websites cannot be tricked into pivoting requests to local backend services.
- **Frictionless Developer Experience**: Local development via `nx serve` remains immediate and requires no PKI/TLS setup.
- **Verification**: Verified via unit tests (`security-headers.spec.ts`, `host-origin.hook.spec.ts`, `test_rate_limiter.py`, `test_host_origin.py`, `test_security.py`), contract verification, and Playwright E2E suites.
