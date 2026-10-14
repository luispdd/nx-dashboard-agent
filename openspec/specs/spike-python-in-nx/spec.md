# spike-python-in-nx Specification

## Purpose

Integrates a Python FastAPI service and virtual environment management via uv seamlessly into the Nx monorepo task graph.

## Requirements

### Requirement: Nx task delegation to uv
The workspace SHALL execute Python service tasks through Nx targets wrapping `uv run` commands.

#### Scenario: Running Python test suite through Nx
- **WHEN** `bunx nx test agent-service` is executed
- **THEN** Nx SHALL run pytest within the project uv virtual environment and report test outcomes

#### Scenario: Running Python lint and type checks through Nx
- **WHEN** `bunx nx lint agent-service` is executed
- **THEN** Nx SHALL invoke ruff through uv and validate Python source files

### Requirement: Python dependency management
Python package dependencies and lockfiles SHALL be maintained exclusively with `uv`.

#### Scenario: Syncing virtual environment
- **WHEN** `uv sync` is invoked in the agent service directory
- **THEN** dependencies listed in `pyproject.toml` SHALL be resolved and locked in `uv.lock`
