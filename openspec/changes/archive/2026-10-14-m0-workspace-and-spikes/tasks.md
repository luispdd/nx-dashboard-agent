## 1. Workspace Foundations & Tooling Validation

- [x] 1.1 Verify project tags (`type:*`, `scope:*`) and module boundary enforcement rules in `eslint.config.js` by running `bunx nx affected -t lint`
- [x] 1.2 Verify `nx.json` plugins and ensure Vitest runs in non-watch mode (`"testMode": "run"`) for all projects
- [x] 1.3 Verify shared context library paths in `tsconfig.base.json` for `libs/shared-mfe-context` and confirm clean imports
- [x] 1.4 Run baseline test and build passes across existing projects (`bunx nx affected -t test build`)

## 2. Spike 1 — Microfrontend Native Federation (Angular Host + React Remote)

- [x] 2.1 Configure Native Federation in `apps/dashboard-shell` using `@angular-architects/native-federation`
- [x] 2.2 Configure Native Federation in `apps/chat-mfe` using Vite federation plugin and expose the Chat remote component entry
- [x] 2.3 Implement dynamic remote loader in Angular dashboard shell to mount the React remote and supply dashboard context from `libs/shared-mfe-context`
- [x] 2.4 Verify runtime federation and standalone execution of both apps, documenting the outcome in `docs/adr/ADR-004-native-federation-mfe-spike.md`

## 3. Spike 2 — Python in Nx Task Integration

- [x] 3.1 Configure `apps/agent-service/project.json` targets (`test`, `lint`, `serve`) wrapping `uv run` commands
- [x] 3.2 Initialize `apps/agent-service/pyproject.toml` dependencies (FastAPI, uvicorn, pydantic, openai, pytest, ruff) and sync lockfile via `uv lock`
- [x] 3.3 Verify Python targets run cleanly through Nx CLI (`bunx nx test agent-service` and `bunx nx lint agent-service`)
- [x] 3.4 Document Python in Nx integration outcome in `docs/adr/ADR-016-python-uv-in-nx-spike.md`

## 4. Spike 3 — Local LLM Connectivity & Tool Calling Verification

- [x] 4.1 Implement configurable LLM settings (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) via `pydantic-settings` in `apps/agent-service`
- [x] 4.2 Implement an LLM connectivity check script or endpoint probing Unsloth at `http://127.0.0.1:8888/api` with model `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`
- [x] 4.3 Validate authentication method and streaming chat completion against the local Unsloth instance
- [x] 4.4 Validate structured tool calling response parsing and record results in `docs/adr/ADR-017-local-llm-unsloth-connectivity-spike.md`
