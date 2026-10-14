## MODIFIED Requirements

### Requirement: Local LLM service connectivity and authentication
The FastAPI agent service SHALL connect to an OpenAI-compatible LLM endpoint (local runner or remote API) and resolve its authentication and connection parameters via runtime configuration with environment variable fallback.

#### Scenario: Verifying LLM endpoint health and access
- **WHEN** the agent service initiates a connectivity probe to the configured `LLM_BASE_URL`
- **THEN** the service SHALL authenticate and confirm the configured model is reachable

#### Scenario: Switching LLM provider via configuration
- **WHEN** runtime configuration in `data/runtime-config.json` or `.env` parameters are changed
- **THEN** the client SHALL connect to the updated provider without requiring code modifications
