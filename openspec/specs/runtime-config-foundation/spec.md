# runtime-config-foundation Specification

## Purpose

Establishes a file-based runtime LLM configuration (`data/runtime-config.json`) with symmetric AES-256 encryption for secrets and clear resolution precedence over environment variables.

## Requirements

### Requirement: Runtime configuration file schema
The system SHALL support an optional `data/runtime-config.json` file defining LLM settings including `base_url`, `model`, `api_key_encrypted`, and `updated_at`.

#### Scenario: Validating runtime config structure
- **WHEN** `data/runtime-config.json` is read
- **THEN** it SHALL provide valid fields for `base_url`, `model`, and encrypted `api_key`

### Requirement: Symmetric encryption for sensitive API keys
The system SHALL encrypt the LLM API key using symmetric AES-256 encryption before storing it in `data/runtime-config.json`, preventing plain-text storage on disk.

#### Scenario: Encrypting and decrypting API keys
- **WHEN** an API key is persisted to `data/runtime-config.json`
- **THEN** it SHALL be stored in encrypted form and SHALL be successfully decrypted into memory by authorized services

### Requirement: Configuration resolution precedence
The Python agent service SHALL prioritize configuration sources in strict order: `data/runtime-config.json` takes precedence over centralized workspace root `.env` variables, which take precedence over code defaults.

#### Scenario: Runtime config file exists
- **WHEN** `data/runtime-config.json` exists with valid configuration
- **THEN** the agent service SHALL use the LLM settings from this file regardless of conflicting `.env` values

#### Scenario: Fallback to environment variables
- **WHEN** `data/runtime-config.json` does not exist
- **THEN** the agent service SHALL fall back to environment variables provided in the centralized workspace root `.env` (or default fallback constants)

### Requirement: Centralized workspace environment specification
The workspace SHALL provide a centralized `.env.example` at the repository root defining default ports, service URLs, database paths, encryption keys, LLM connection settings, and MCP discovery settings, while deprecating direct REST API URLs for the agent.

#### Scenario: Root environment template existence
- **WHEN** inspecting the repository root
- **THEN** a `.env.example` file SHALL exist containing documented configuration variables for `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `WEB_SHELL_PORT`, `WEB_REMOTE_PORT`, `API_PORT`, `AGENT_PORT`, `DERIVED_DB_PATH`, `CONFIG_ENCRYPTION_KEY`, `MCP_SERVER_URLS`, `MCP_AUTH_TOKEN`, `MCP_TOOL_LIST_TTL_SECONDS`, `MCP_CALL_TIMEOUT_SECONDS`, and `TOOL_RESULT_MAX_CHARS`

#### Scenario: Deprecating fragmented per-app environment files
- **WHEN** configuring services locally or in containers
- **THEN** no individual service SHALL require dedicated `.env` files within its application directory, and all runtime configurations SHALL source from the root environment

#### Scenario: Removal of dashboard REST URL for agent
- **WHEN** the agent service is configured
- **THEN** the agent SHALL NOT require or consult `DASHBOARD_API_BASE_URL`

