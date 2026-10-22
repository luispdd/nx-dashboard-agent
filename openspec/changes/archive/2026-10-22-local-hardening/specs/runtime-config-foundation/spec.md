## MODIFIED Requirements

### Requirement: Symmetric encryption for sensitive API keys
The system SHALL encrypt the LLM API key using symmetric AES-256 encryption before storing it in `data/runtime-config.json`, preventing plain-text storage on disk, and SHALL require a secure encryption key.

#### Scenario: Encrypting and decrypting API keys
- **WHEN** an API key is persisted to or read from `data/runtime-config.json` and a valid `CONFIG_ENCRYPTION_KEY` is provided
- **THEN** it SHALL be securely encrypted or decrypted in memory using AES-256-GCM

#### Scenario: Missing encryption key in standard operation
- **WHEN** secret encryption or decryption is required and `CONFIG_ENCRYPTION_KEY` is empty or missing and `ALLOW_INSECURE_DEV_KEY` is not true
- **THEN** the system SHALL raise a configuration error identifying the missing variable and refusing to fall back to a hardcoded key

#### Scenario: Insecure development key opt-in
- **WHEN** `CONFIG_ENCRYPTION_KEY` is empty but `ALLOW_INSECURE_DEV_KEY=true` is explicitly provided
- **THEN** the service MAY use the development fallback key and SHALL emit a prominent security warning in logs

### Requirement: Centralized workspace environment specification
The workspace SHALL provide a centralized `.env.example` at the repository root defining default ports, service URLs, database paths, encryption keys, LLM connection settings, and MCP discovery settings, while deprecating direct REST API URLs for the agent and shipping no usable default encryption secrets.

#### Scenario: Root environment template existence
- **WHEN** inspecting the repository root
- **THEN** a `.env.example` file SHALL exist containing documented configuration variables for `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `WEB_SHELL_PORT`, `WEB_REMOTE_PORT`, `API_PORT`, `AGENT_PORT`, `API_HOST`, `AGENT_HOST`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `DERIVED_DB_PATH`, `CONFIG_ENCRYPTION_KEY` (empty by default), `ALLOW_INSECURE_DEV_KEY`, `MCP_SERVER_URLS`, `MCP_AUTH_TOKEN`, `SWAGGER_ENABLED`, and `CHAT_*` limits

#### Scenario: Deprecating fragmented per-app environment files
- **WHEN** configuring services locally or in containers
- **THEN** no individual service SHALL require dedicated `.env` files within its application directory, and all runtime configurations SHALL source from the root environment

#### Scenario: Removal of dashboard REST URL for agent
- **WHEN** the agent service is configured
- **THEN** the agent SHALL NOT require or consult `DASHBOARD_API_BASE_URL`

## ADDED Requirements

### Requirement: Secret masking in logs and runtime responses
The system SHALL prevent sensitive tokens and keys from being logged or exposed via diagnostic endpoints.

#### Scenario: Masking secrets in health responses
- **WHEN** a client queries `/health` or system status
- **THEN** the returned payload SHALL NOT contain decrypted API keys or bearer tokens

#### Scenario: Masking secrets in application logs
- **WHEN** runtime configuration or tool calls are logged
- **THEN** any credential or token values SHALL be masked or redacted
