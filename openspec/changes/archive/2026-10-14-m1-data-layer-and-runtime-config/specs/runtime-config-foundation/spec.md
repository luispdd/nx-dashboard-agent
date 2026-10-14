## Purpose

Establishes a file-based runtime LLM configuration (`data/runtime-config.json`) with symmetric AES-256 encryption for secrets and clear resolution precedence over environment variables.

## ADDED Requirements

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
The Python agent service SHALL prioritize configuration sources in strict order: `data/runtime-config.json` takes precedence over `.env` variables, which take precedence over code defaults.

#### Scenario: Runtime config file exists
- **WHEN** `data/runtime-config.json` exists with valid configuration
- **THEN** the agent service SHALL use the LLM settings from this file regardless of conflicting `.env` values

#### Scenario: Fallback to environment variables
- **WHEN** `data/runtime-config.json` does not exist
- **THEN** the agent service SHALL fall back to values provided in `.env` (or default fallback constants)
