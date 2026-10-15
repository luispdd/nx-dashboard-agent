## Purpose

Provides the core FastAPI application foundation, lifespan lifecycle, CORS configuration for frontend micro frontends, health inspection, and in-memory session management for the agent service.

## ADDED Requirements

### Requirement: Service Lifespan and Application Bootstrapping
The agent service SHALL expose a standardized FastAPI application instance with structured startup and shutdown lifecycle management.

#### Scenario: Application startup and shutdown lifecycle
- **WHEN** the application starts up and shuts down
- **THEN** the service SHALL initialize application state cleanly and execute lifespan cleanup hooks without unhandled exceptions

### Requirement: Cross-Origin Resource Sharing (CORS) Policy
The agent service SHALL support cross-origin HTTP requests from configured dashboard and chat frontend origins.

#### Scenario: Permitting allowed frontend origins
- **WHEN** a request with an `Origin` header matching `http://localhost:4200` or `http://localhost:4204` is received
- **THEN** the service SHALL return the corresponding `Access-Control-Allow-Origin` header and allow standard HTTP methods

#### Scenario: Preflight OPTIONS request
- **WHEN** an HTTP `OPTIONS` preflight request is made from an allowed origin
- **THEN** the service SHALL return HTTP 200 with allowed headers and methods

### Requirement: Health Check and Diagnostic Liveness
The agent service SHALL provide an unauthenticated health check endpoint `GET /health` reporting service liveness, provider status, and model metadata with credentials strictly masked.

#### Scenario: Querying health endpoint
- **WHEN** a client performs an HTTP `GET` request to `/health`
- **THEN** the service SHALL return HTTP 200 with a JSON payload indicating `status: "ok"`, the active LLM provider type, and the configured model name

#### Scenario: Secret masking in diagnostic output
- **WHEN** the health endpoint or diagnostic logs produce configuration details
- **THEN** sensitive credentials including `llm_api_key` SHALL be omitted or masked

### Requirement: In-Memory Ephemeral Session Management
The agent service SHALL maintain ephemeral chat session states and active task references entirely in-memory without database persistence.

#### Scenario: Initializing and retrieving session state
- **WHEN** a session ID is accessed or created
- **THEN** the session manager SHALL provide an in-memory session container for tracking requests, event buffers, and active execution tasks

#### Scenario: Inactive session TTL eviction
- **WHEN** an in-memory session has been inactive past its configured time-to-live threshold
- **THEN** the session manager SHALL evict the session and release its associated resources
