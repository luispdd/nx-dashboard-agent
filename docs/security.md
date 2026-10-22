# Security Policy & Hardening Guide

This document describes the security architecture, threat model, and defense-in-depth controls implemented in the **nx-dashboard-agent** IoT telemetry and chat agent proof of concept.

---

## 1. Threat Model & Posture

This repository is designed as a **local-only developer demonstration and proof-of-concept** showing IoT telemetry and local LLM agent orchestration. 

### Core Architectural Choices
- **Closed by Default**: Services are bound strictly to the local loopback interface (`127.0.0.1`), preventing accidental network exposure over LAN or Wi-Fi.
- **No Browser-Held Secrets**: The frontend browser client (`dashboard-shell` and `chat-mfe`) never holds static administrative tokens or database credentials.
- **Strict Service Boundaries**: The FastAPI agent service calls the NestJS backend via internal MCP (`/api/mcp`) protected with a server-to-server bearer token. The database is read-only derived SQLite. Free-form SQL execution is strictly forbidden.

---

## 2. Defense-in-Depth Layers

The platform incorporates several complementary security layers:

### 2.1 Loopback Binding (`127.0.0.1`)
- **Backend APIs**: `dashboard-api` (`API_HOST`) and `agent-service` (`AGENT_HOST`) default to `127.0.0.1`.
- **Frontend Dev Servers**: `dashboard-shell` (`localhost`/`127.0.0.1:4200`) and `chat-mfe` (`localhost`/`127.0.0.1:4204`).
- **Container Ports**: `docker-compose.yml` binds host published ports exclusively to `127.0.0.1` (e.g. `127.0.0.1:3000:3000`, `127.0.0.1:8000:8000`, `127.0.0.1:4200:80`).

### 2.2 Host & Origin Validation
- **Host Header Verification**: Protects against DNS rebinding attacks (`ALLOWED_HOSTS`). Mismatches return `403 Forbidden`.
- **Origin Header Verification**: Prevents unauthorized cross-origin requests from arbitrary web origins (`ALLOWED_ORIGINS`). Requests without an `Origin` (such as curl or CLI tools) are permitted, while foreign origins receive `403 Forbidden`.
- **Constant-Time Token Comparison**: MCP endpoint (`POST /api/mcp`) compares tokens with `node:crypto.timingSafeEqual` to eliminate timing attacks.

### 2.3 Agent Service Rate & Resource Limiting
- **Sliding-Window Rate Limiter**: Limits incoming chat requests to `CHAT_RATE_LIMIT_PER_MINUTE` (default: 20 req/min per IP) and emits `429 Too Many Requests` with a `Retry-After` header.
- **Concurrency Tracker**: Caps simultaneous SSE chat streams to `CHAT_MAX_CONCURRENT_STREAMS` (default: 3 active streams).
- **Payload Bound Enforcer**: Rejects user prompts exceeding `CHAT_MAX_MESSAGE_CHARS` (default: 4000 characters) with `413 Payload Too Large`.
- **LRU Session Eviction**: Evicts the oldest idle session when total active sessions reach `CHAT_MAX_SESSIONS` (default: 100).

### 2.4 Security Headers & Attack Surface Reduction
- **HTTP Security Headers**: `dashboard-api` registers `@fastify/helmet`, enforcing `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and suppressing `X-Powered-By`.
- **Interactive Documentation Toggle**: Swagger UI at `/api/docs` can be disabled via `SWAGGER_ENABLED=false` (default in production), returning `404 Not Found` while preserving contract generation (`export-openapi`).

### 2.5 Secret Encryption & Credential Protection
- **Symmetric Configuration Encryption**: Stored LLM credentials in `data/runtime-config.json` are encrypted using AES-256-GCM.
- **Key Requirement**: A secure 32-byte hex key must be supplied via `CONFIG_ENCRYPTION_KEY`. If unconfigured, the service fails fast with `RuntimeError` unless `ALLOW_INSECURE_DEV_KEY=true` is explicitly passed for local experimentation.
- **Secret Redaction**: JSON logging (`logging_config.py`) and diagnostic endpoints (`/health`) redact API keys (`sk-...`), bearer tokens, and encryption payloads.

### 2.6 Frontend Sanitization
- **Markdown Link Sanitization**: The React chat UI (`markdown-content.tsx`) restricts clickable links to `http:`, `https:`, `mailto:`, and relative links. Dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`) are stripped to prevent XSS.

---

## 3. Security Auditing

Run dependency and security audits across both JavaScript/TypeScript and Python services using:

```bash
bun run security:audit
```

This executes:
1. `bun audit` across workspace JavaScript dependencies.
2. `uvx pip-audit` across FastAPI agent service Python dependencies.

---

## 4. Key Generation

To generate a secure 32-byte random hex key for `CONFIG_ENCRYPTION_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Save the output to `CONFIG_ENCRYPTION_KEY` in your workspace `.env` file.
