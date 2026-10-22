## Why

The project is an IoT dashboard + data agent designed as a local-only demo, but currently services listen on all network interfaces (`0.0.0.0`), allow unrestricted or hardcoded CORS, expose runtime secrets with a well-known default encryption key, lack request rate/concurrency limits on the chat endpoint, and omit host/origin validation to protect against DNS rebinding.

Hardening each component to follow a "closed by default" posture ensures that only expected local traffic is accepted with sensible resource boundaries, preventing inadvertent network exposure and LLM quota exhaustion while keeping the local developer experience frictionless.

## What Changes

- **Loopback binding by default**: `dashboard-api`, `agent-service`, and frontend dev servers listen on `127.0.0.1` by default, configurable via `API_HOST` and `AGENT_HOST`. Docker Compose publishes ports strictly to `127.0.0.1`.
- **Host and Origin validation**: Both services reject requests with unrecognized `Host` headers (protecting against DNS rebinding) or untrusted `Origin` headers (protecting against malicious web browser tabs). Requests without an `Origin` (such as curl or internal tooling) remain allowed.
- **Agent chat resource limits**: The chat SSE endpoint enforces configurable limits: per-client rate limit (`CHAT_RATE_LIMIT_PER_MINUTE`), active stream concurrency (`CHAT_MAX_CONCURRENT_STREAMS`), maximum prompt character length (`CHAT_MAX_MESSAGE_CHARS`), and LRU session eviction (`CHAT_MAX_SESSIONS`, `CHAT_SESSION_TTL_SECONDS`).
- **Secret protection & safe defaults**: Remove the public default encryption key from `.env.example`. Require `CONFIG_ENCRYPTION_KEY` unless `ALLOW_INSECURE_DEV_KEY=true` is explicitly set. Mask tokens and keys in all logs and health endpoints.
- **Security headers & surface reduction**: Add `@fastify/helmet` to `dashboard-api` to serve standard security headers (`X-Content-Type-Options`, restrictive CSP, `Referrer-Policy`). Conditionally toggle Swagger UI via `SWAGGER_ENABLED`.
- **MCP guard hardening**: Enforce Origin and Host validation on `/api/mcp` by default, and use constant-time bearer token comparison.
- **Frontend & Agent safety**: Treat tool outputs as untrusted data in agent evaluation; enforce safe link protocols in the chat markdown renderer; map non-2xx error responses (413, 422, 429) to clear user feedback in the React chat MFE.
- **Hygiene & scanning**: Add `docs/security.md`, a root `security:audit` script, and non-blocking CI audit jobs for dependencies and secrets.

## Non-goals

- User authentication, roles, or identity providers (OIDC/OAuth).
- TLS/HTTPS termination or mTLS (out of scope for local loopback demo; handled by reverse proxy if ever exposed).
- API Gateway, message brokers, or additional network microservices (prohibited by `AGENTS.md`).
- Browser token authentication (frontend client bundles are public; tokens in browser provide false security).
- Changes to REST contracts or generated client models.

## Capabilities

### New Capabilities
- `service-hardening`: Loopback binding by default, Host and Origin header validation, security headers, Swagger UI toggle, and chat endpoint resource and rate limiting.

### Modified Capabilities
- `runtime-config-foundation`: Require explicit encryption key or dev flag, remove hardcoded dev key default from `.env.example`, and enforce secret masking in logs and API endpoints.
- `dashboard-mcp-server`: Enforce shared Origin and Host allowlists by default on `/api/mcp`, and verify bearer authentication tokens using constant-time comparison.

## Impact

- **Affected Projects**: `dashboard-api`, `agent-service`, `chat-mfe`, `dashboard-shell`, plus `.github/workflows` and workspace root configs (`docker-compose.yml`, `.env.example`).
- **Dependencies**: Add `@fastify/helmet` to `dashboard-api` (compatible with Fastify v5 and NestJS 11). No new Python or frontend dependencies; rate limiting and secret checks are implemented in-process.
- **API Contracts**: No changes to REST contracts or generated TypeScript client bindings (`export-openapi` remains unchanged).
- **Architecture & ADR**: Requires `docs/adr/ADR-027-local-only-threat-model-and-defense-in-depth.md` documenting the defense-in-depth layers and the local threat model.
