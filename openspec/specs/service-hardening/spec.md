# service-hardening Specification

## Purpose

Enforces a local-only "closed by default" defense-in-depth security perimeter across backend services and frontend development hosts.

## Requirements

### Requirement: Loopback interface binding by default
Every backend service and frontend development server SHALL bind strictly to the loopback interface (`127.0.0.1`) by default unless explicitly configured otherwise.

#### Scenario: Default loopback binding
- **WHEN** `dashboard-api` or `agent-service` starts without explicit host configuration
- **THEN** the process SHALL listen only on `127.0.0.1` and SHALL NOT accept connections from external network interfaces

#### Scenario: Explicit non-loopback host configuration
- **WHEN** a service is started with `API_HOST` or `AGENT_HOST` set to a non-loopback address (such as `0.0.0.0`)
- **THEN** the service SHALL bind to the specified address and SHALL log a warning stating that the service is exposed beyond the loopback interface

#### Scenario: Docker container port publishing
- **WHEN** services are launched via Docker Compose
- **THEN** published host ports for API, agent, and web frontend SHALL be mapped to `127.0.0.1` by default unless overridden by an explicit environment variable

### Requirement: Host and Origin header validation
Services SHALL reject incoming HTTP and WebSocket/SSE requests whose `Host` or `Origin` headers do not match configured local allowlists.

#### Scenario: Allowed request origin
- **WHEN** an incoming request contains an `Origin` header matching `ALLOWED_ORIGINS` (including `http://localhost:4200`, `http://localhost:4204`, `http://127.0.0.1:4200`, `http://127.0.0.1:4204`)
- **THEN** the service SHALL allow the request and SHALL return CORS response headers reflecting that specific origin (never `*`)

#### Scenario: Untrusted request origin
- **WHEN** an incoming request contains an `Origin` header not present in `ALLOWED_ORIGINS`
- **THEN** the service SHALL immediately reject the request with HTTP status `403 Forbidden` before executing downstream handlers

#### Scenario: Missing origin header
- **WHEN** an incoming request contains no `Origin` header (such as curl, CLI tools, or server-to-server calls)
- **THEN** the service SHALL allow the request to proceed subject to Host and route-level authentication checks

#### Scenario: Host header mismatch protection against DNS rebinding
- **WHEN** an incoming request contains a `Host` header that is not present in `ALLOWED_HOSTS`
- **THEN** the service SHALL reject the request with HTTP status `403 Forbidden` or `421 Misdirected Request`

### Requirement: Chat endpoint rate and resource limiting
The agent chat streaming endpoint SHALL enforce configurable per-client rate limits, concurrency limits, message size bounds, and session lifecycle eviction.

#### Scenario: Per-client rate limit exceeded
- **WHEN** a client address submits more than `CHAT_RATE_LIMIT_PER_MINUTE` (default 20) requests within a 60-second sliding window
- **THEN** the service SHALL reject the request with HTTP status `429 Too Many Requests` and include a valid `Retry-After` header

#### Scenario: Concurrent stream cap exceeded
- **WHEN** a client address initiates a new chat stream while already holding `CHAT_MAX_CONCURRENT_STREAMS` (default 3) active SSE connections
- **THEN** the service SHALL reject the incoming request with HTTP status `429 Too Many Requests`

#### Scenario: Oversized user message
- **WHEN** an incoming chat payload contains a message whose text exceeds `CHAT_MAX_MESSAGE_CHARS` (default 4000 characters)
- **THEN** the service SHALL reject the request with HTTP status `413 Payload Too Large` or `422 Unprocessable Content` without invoking the LLM

#### Scenario: Session capacity LRU eviction
- **WHEN** a new session is created and the total number of active sessions reaches `CHAT_MAX_SESSIONS`
- **THEN** the session manager SHALL evict the oldest idle session and free its associated resources

### Requirement: Standard API security headers and surface toggle
The HTTP API SHALL emit standard defense-in-depth security headers and support toggling interactive API documentation.

#### Scenario: Security headers present on responses
- **WHEN** `dashboard-api` handles an HTTP response
- **THEN** the response headers SHALL include `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and omit `X-Powered-By`

#### Scenario: Swagger documentation toggling
- **WHEN** `SWAGGER_ENABLED` is set to `false` (or in production mode by default)
- **THEN** the `/api/docs` route SHALL return HTTP status `404 Not Found`, while `export-openapi` remains capable of generating the contract definition
