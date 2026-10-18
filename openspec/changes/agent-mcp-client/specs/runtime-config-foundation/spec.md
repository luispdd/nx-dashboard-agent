## MODIFIED Requirements

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
