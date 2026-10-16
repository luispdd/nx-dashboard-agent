## MODIFIED Requirements

### Requirement: Configuration resolution precedence
The Python agent service SHALL prioritize configuration sources in strict order: `data/runtime-config.json` takes precedence over centralized workspace root `.env` variables, which take precedence over code defaults.

#### Scenario: Runtime config file exists
- **WHEN** `data/runtime-config.json` exists with valid configuration
- **THEN** the agent service SHALL use the LLM settings from this file regardless of conflicting `.env` values

#### Scenario: Fallback to environment variables
- **WHEN** `data/runtime-config.json` does not exist
- **THEN** the agent service SHALL fall back to environment variables provided in the centralized workspace root `.env` (or default fallback constants)

## ADDED Requirements

### Requirement: Centralized workspace environment specification
The workspace SHALL provide a centralized `.env.example` at the repository root defining default ports, service URLs, database paths, encryption keys, and LLM connection settings across all backend services, frontends, and container environments.

#### Scenario: Root environment template existence
- **WHEN** inspecting the repository root
- **THEN** a `.env.example` file SHALL exist containing documented configuration variables for `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `WEB_SHELL_PORT`, `WEB_REMOTE_PORT`, `API_PORT`, `AGENT_PORT`, `DERIVED_DB_PATH`, and `CONFIG_ENCRYPTION_KEY`

#### Scenario: Deprecating fragmented per-app environment files
- **WHEN** configuring services locally or in containers
- **THEN** no individual service SHALL require dedicated `.env` files within its application directory, and all runtime configurations SHALL source from the root environment
