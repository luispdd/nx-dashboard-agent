## Context

See `proposal.md` for motivation. The application is an IoT telemetry dashboard consisting of an Angular 22 shell (`dashboard-shell`), a React chat remote (`chat-mfe`), a NestJS Fastify backend (`dashboard-api`), and a FastAPI agent service (`agent-service`). All components are deployed locally or via Docker Compose.

The current system binds `0.0.0.0`, lacks `Host` verification against DNS rebinding, allows unconstrained CORS, uses a publicly known development fallback key for `runtime-config.json`, and imposes no limits on the chat SSE streaming endpoint.

## Goals / Non-Goals

**Goals:**
- Enforce loopback binding (`127.0.0.1`) across all backend services, frontend development servers, and Docker port publishing.
- Enforce strict `Host` and `Origin` header allowlists (`ALLOWED_HOSTS`, `ALLOWED_ORIGINS`).
- Protect the LLM agent streaming endpoint with in-process rate limits, concurrency limits, character length bounds, and LRU session eviction.
- Remove the public fallback encryption key, enforce strict key presence in production, and mask secrets across logs and endpoints.
- Add response security headers via `@fastify/helmet` in `dashboard-api` and allow disabling Swagger UI in production.
- Retain frictionless local development with `nx serve` without requiring complex manual security credentials.

**Non-Goals:**
- TLS/HTTPS termination or mTLS.
- User authentication, RBAC, or OAuth/OIDC tokens in the browser.
- External API gateway or message broker.
- Database changes or REST API schema modifications.

## Decisions

### 1. Loopback Binding Strategy
- **Decision**: All local dev scripts, `project.json` serve commands, and `main.ts` / `main.py` entry points default to `127.0.0.1`. In Docker Compose, containers listen on `0.0.0.0` internally for bridge/host compatibility, but `ports` are explicitly bound to `127.0.0.1:${PORT}:${PORT}`.
- **Rationale**: Prevents accidental exposure on local networks (Wi-Fi, LAN) without needing firewall configurations.
- **Alternatives considered**:
  - *Firewall / OS level rules only*: Fragile and environment-specific.
  - *Keep `0.0.0.0` and rely on CORS*: CORS does not prevent simple non-browser HTTP requests or DNS rebinding.

### 2. Request Validation: Order of Checks
- **Decision**: Enforce checks in the following order:
  1. `Host` validation (reject mismatch with 403/421).
  2. `Origin` validation (requests with no `Origin` allowed; foreign `Origin` rejected with 403).
  3. Authentication check (bearer token on `/api/mcp` using constant-time comparison).
  4. Rate & concurrency limits (`agent-service` chat endpoint).
  5. Payload validation (`ValidationPipe` in NestJS; Pydantic in FastAPI).
- **Rationale**: Early rejection avoids executing expensive serialization, LLM invocations, or database queries.

### 3. In-Process Limiter for Agent Service
- **Decision**: Implement a lightweight in-process sliding window rate limiter and concurrency tracker in Python with an injectable clock for testability.
- **Rationale**: The project architecture explicitly forbids Redis or external cache brokers (`AGENTS.md`). A single-process FastAPI service can maintain client request timestamps in memory.
- **Alternatives considered**:
  - *Redis/Memcached limiter*: Violates closed decision (no external broker/cache).
  - *SlowAPI / third-party rate limiters*: Adds external dependencies when a simple sliding-window class with standard library constructs (`asyncio.Lock`, `collections.deque`) is minimal, zero-dependency, and easily testable.

### 4. LRU Session Eviction Policy
- **Decision**: When `active_session_count()` reaches `CHAT_MAX_SESSIONS`, the session manager evicts the oldest idle session (LRU) rather than rejecting the incoming request.
- **Rationale**: Chat sessions are ephemeral client contexts. Evicting idle sessions ensures new user interactions succeed seamlessly during local demonstrations.

### 5. Secret Key Handling & Dev Opt-in
- **Decision**: `.env.example` ships `CONFIG_ENCRYPTION_KEY=` empty. If unconfigured, reading or writing encrypted values raises a clear `RuntimeError` unless `ALLOW_INSECURE_DEV_KEY=true` is explicitly set. A one-line helper or script is documented for generating a key (`python -c "import secrets; print(secrets.token_hex(32))"`).
- **Rationale**: Eliminates the vulnerability where any clone of the repository can decrypt stored LLM API keys.

### 6. Architectural Decision Record (ADR)
- **Decision**: Create `docs/adr/ADR-027-local-only-threat-model-and-defense-in-depth.md` recording the threat model, defense layers, and the explicit choice not to require browser-held tokens.

## Risks / Trade-offs

- **[Risk] Existing `runtime-config.json` fails to decrypt**: If an existing local instance relied on the old hardcoded dev key, the service will fail to decrypt on startup.
  - *Mitigation*: Provide clear error messaging with recovery steps (delete `data/runtime-config.json` or re-enter the API key).
- **[Risk] Native Federation remote entry fails due to Origin check**: The Angular shell loads the React remote from `localhost:4204`.
  - *Mitigation*: Both `localhost` and `127.0.0.1` on ports `4200` and `4204` are included in `ALLOWED_ORIGINS` by default.
- **[Risk] Rate limiting disrupts interactive exploration**: Fast prompt typing or testing could trigger 429.
  - *Mitigation*: Generous default limits (20 req/min per IP, 3 concurrent streams) and a human-readable error displayed in the chat UI.
- **[Risk] CI workflows fail due to missing encryption key**: Container smoke tests in GitHub Actions run with `.env.example`.
  - *Mitigation*: CI workflows generate an ephemeral key per run or pass `ALLOW_INSECURE_DEV_KEY=true`.

## Migration Plan

1. Update `.env.example` to remove the default key and document all new hardening settings.
2. If working with existing local environments, generate a 32-byte hex key for `CONFIG_ENCRYPTION_KEY` or set `ALLOW_INSECURE_DEV_KEY=true`.
3. Rollback strategy: Revert commits to restore previous bind addresses and dev key if breaking changes occur.
