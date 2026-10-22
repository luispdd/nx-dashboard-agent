## 1. Environment & Configuration Setup

- [x] 1.1 Add `@fastify/helmet` to `package.json` and verify installation succeeds with `bun install`
- [x] 1.2 Define configuration variables in `dashboard-api` (`API_HOST`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `SWAGGER_ENABLED`) and `agent-service` (`AGENT_HOST`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `CHAT_*`, `ALLOW_INSECURE_DEV_KEY`) with tests verifying default values and aliases
- [x] 1.3 Update `.env.example` to remove the default encryption key value, document all hardening variables with safe loopback defaults, and verify documentation alignment

## 2. Loopback Binding & Port Isolation

- [x] 2.1 Update `apps/dashboard-api/src/main.ts` to default `HOST` to `127.0.0.1` (configurable via `API_HOST`), log a warning when exposed, and verify local startup with loopback binding
- [x] 2.2 Update `apps/agent-service/src/agent_service/main.py` and `project.json` serve targets to bind `127.0.0.1` by default (configurable via `AGENT_HOST`) and verify with `ss -ltn` during `nx serve agent-service`
- [x] 2.3 Ensure frontend dev servers (`dashboard-shell`, `chat-mfe` vite config) bind to `localhost`/`127.0.0.1` and verify with `nx serve dashboard-shell` and `nx serve chat-mfe`
- [x] 2.4 Update `docker-compose.yml` to publish ports strictly to `127.0.0.1` and verify container configuration syntax

## 3. Host and Origin Validation

- [x] 3.1 Implement Host and Origin validation middleware / guards in `dashboard-api` replacing open `enableCors()` and verify with tests for allowed origins, rejected foreign origins (403), and missing origins
- [x] 3.2 Update `agent-service` CORS and trusted host middleware in `main.py` to use `ALLOWED_ORIGINS` and `ALLOWED_HOSTS` and verify with tests for allowed and disallowed origins
- [x] 3.3 Update `apps/dashboard-api/src/app/mcp/mcp.guard.ts` to enforce the shared allowlist by default and use constant-time token comparison, verifying unit tests in `mcp.guard.spec.ts`

## 4. Agent Chat Endpoint Limiting & Error Handling

- [x] 4.1 Implement in-process sliding-window rate limiter and active stream concurrency tracker in `agent-service` with injectable clock and verify with unit tests covering 429 and `Retry-After` headers
- [x] 4.2 Enforce `CHAT_MAX_MESSAGE_CHARS` and payload bounds in `apps/agent-service/src/agent_service/api/chat.py` and verify with unit tests for oversized inputs returning 413/422
- [x] 4.3 Implement LRU idle session eviction in `apps/agent-service/src/agent_service/session_manager.py` when `CHAT_MAX_SESSIONS` is reached and verify with unit tests
- [x] 4.4 Update `apps/chat-mfe/src/app/hooks/use-chat-stream.ts` to extract non-2xx error details from backend response bodies (413, 422, 429) and display readable error messages to the user

## 5. Security Headers, Surface Reduction & Secret Protection

- [x] 5.1 Register `@fastify/helmet` in `apps/dashboard-api/src/main.ts`, configure `SWAGGER_ENABLED` route toggling, and verify headers and documentation accessibility in tests
- [x] 5.2 Enforce strict key requirement in `apps/agent-service/src/agent_service/security.py`, support `ALLOW_INSECURE_DEV_KEY=true` with warning, and verify behavior with tests
- [x] 5.3 Mask secrets, keys, and tokens across logs and `/health` endpoints and verify with unit tests
- [x] 5.4 Sanitize links in `apps/chat-mfe/src/app/components/markdown-content.tsx` to disallow unsafe schemes (`javascript:`) and verify with XSS unit tests
- [x] 5.5 Add an evaluation case in `apps/agent-service/src/agent_service/evals/dataset.json` testing agent resistance to prompt injection inside tool outputs

## 6. Supply Chain Hygiene & Documentation

- [x] 6.1 Create `docs/security.md` and add root script `security:audit` for `bun audit` and `uvx pip-audit`, verifying both run cleanly
- [x] 6.2 Add a non-blocking dependency and secret audit job to `.github/workflows/ci.yml` and update `docker.yml` / `e2e.yml` to supply a generated test key
- [x] 6.3 Author `docs/adr/ADR-027-local-only-threat-model-and-defense-in-depth.md` documenting the threat model and defense layers
- [x] 6.4 Update `README.md`, `AGENTS.md`, and relevant skills (`nestjs-conventions`, `fastapi-python-conventions`, `react-mfe-conventions`, `testing-strategy`) with the new loopback and security rules

## 7. Verification & Definition of Done

- [x] 7.1 Verify OpenAPI schema generation (`nx run dashboard-api:export-openapi`) and contracts (`nx run shared-contracts:generate-contracts`) produce zero unexpected git diffs
- [x] 7.2 Run full affected test suite (`nx affected -t lint test build`, `uv run pytest`, `uv run ruff check .`) and verify all pass
- [x] 7.3 Run Playwright E2E tests (`bun run e2e`) and verify end-to-end integration remains green
- [x] 7.4 Validate OpenSpec change with `openspec validate local-hardening`
