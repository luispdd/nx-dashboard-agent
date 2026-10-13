## Why

Milestone M0 establishes the Nx monorepo foundations and de-risks the three core architectural risks before feature development begins: Native Federation between Angular 22 and React, Python integration with `uv` in an Nx workspace, and local LLM connectivity with Unsloth running Qwen 3.5 4B. Completing these foundational spikes upfront ensures that subsequent data and feature milestones build on tested integration paths.

## What Changes

- Initialize and configure the Nx monorepo structure with apps (`dashboard-shell`, `chat-mfe`, `dashboard-api`, `agent-service`) and libraries (`shared-mfe-context`).
- Configure module boundary lint rules with explicit tags (`type:*`, `scope:*`).
- Establish unified testing infrastructure: Vitest for unit testing across frontend and backend, Playwright for E2E testing across applications.
- **Spike 1 (Microfrontend Federation)**: Integrate Angular host (Zoneless, Signals-first, ApplicationBuilder/Vite dev server) with React remote (Vite) via Native Federation (`@angular-architects/native-federation`), consuming `libs/shared-mfe-context`.
- **Spike 2 (Python in Nx)**: Integrate FastAPI service into Nx using `uv` with delegated targets (`test`, `lint`, `serve`) via `nx:run-commands`.
- **Spike 3 (Local LLM Connectivity)**: Implement connectivity and authentication check from FastAPI agent service to local Unsloth server (`http://127.0.0.1:8888/api`, model `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`), verifying streaming chat completion and tool calling capability.

## Capabilities

### New Capabilities
- `workspace-bootstrap`: Nx monorepo project structure, module boundary lint rules, Vitest unit runner configuration, and Playwright E2E runner setup.
- `spike-module-federation`: Runtime Native Federation bridge enabling the Angular 22 shell to dynamically load the React chat remote and pass dashboard context.
- `spike-python-in-nx`: Python FastAPI project orchestration inside Nx using `uv run` commands for testing, linting, and running.
- `spike-local-llm-connectivity`: FastAPI integration with the local Unsloth OpenAI-compatible API on port 8888, verifying authentication, connectivity, and model inference.

### Modified Capabilities
<!-- None: This is the initial bootstrap milestone -->

## Impact

- Monorepo tooling and configuration (`nx.json`, root `package.json`, `tsconfig.base.json`, `eslint.config.js`).
- Applications: `apps/dashboard-shell`, `apps/chat-mfe`, `apps/dashboard-api`, `apps/agent-service`.
- Libraries: `libs/shared-mfe-context`.
- ADR documentation under `docs/adr/` recording the outcomes of Spikes 1, 2, and 3.
