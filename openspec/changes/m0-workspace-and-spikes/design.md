## Context

See `proposal.md` for motivation. The workspace is managed with Nx 23, Bun v1.4, and uv. The tech stack includes Angular 22 Zoneless (ApplicationBuilder / Vite dev server) for the dashboard shell, React 19 (Vite) for the chat remote, NestJS (Fastify) for the API, and FastAPI (Python, uv) for the agent service.

## Goals / Non-Goals

**Goals:**
- Enforce Nx project tags (`type:*`, `scope:*`) and module boundary rules across all apps and libraries.
- Establish unified Vitest configuration for unit tests and Playwright configuration for E2E tests.
- Prove runtime microfrontend federation between Angular and React using Native Federation and verify context sharing via `libs/shared-mfe-context`.
- Integrate Python FastAPI project execution into Nx using `uv run` command targets.
- Validate connectivity, authentication, and streaming tool invocation against the local Unsloth LLM (`http://127.0.0.1:8888/api`, `unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL`).

**Non-Goals:**
- Production-grade dashboard UI charts or chat UX components (deferred to M3 and M6).
- Real ETL data ingestion or derived database creation (deferred to M1).
- Full NestJS business logic and production agent tools (deferred to M2 and M5).

## Decisions

### Decision 1: Native Federation over Webpack Module Federation
- **Choice**: Use `@angular-architects/native-federation` for Angular host and `@softarc/native-federation-node` / Vite federation plugin for React remote.
- **Rationale**: Webpack Module Federation forces Angular to use legacy Webpack builders. Native Federation leverages browser-native ESM and Import Maps, maintaining compatibility with Angular's modern ApplicationBuilder (`esbuild` bundler + Vite dev server).
- **Alternatives Considered**: Webpack Module Federation (rejected due to legacy toolchain overhead and ESM config issues).

### Decision 2: Unified Vitest locked to ^4.0.8
- **Choice**: Standardize unit tests on Vitest across Angular, React, and NestJS, strictly pinned to `^4.0.8`.
- **Rationale**: `@angular/build:unit-test` executor has a hard peer dependency lock on Vitest 4.0.x. Keeping NestJS and React on Vitest 4 ensures workspace-wide consistency.
- **Alternatives Considered**: Karma / Jest (rejected due to speed and ESM incompatibility), Vitest 5+ (rejected due to Angular builder failure).

### Decision 3: Python Task Integration via uv run
- **Choice**: Configure `apps/agent-service/project.json` targets using `nx:run-commands` wrapping `uv run <command>`.
- **Rationale**: Keeps Python environment isolated and reproducible while allowing Nx workspace commands (`nx run agent-service:test`, `nx affected`) to execute identically in CI and local machines without global virtualenv pollution.
- **Alternatives Considered**: `@nxlv/python` plugin (rejected to avoid third-party Nx plugin maintenance risks).

### Decision 4: Configurable OpenAI-compatible LLM Client
- **Choice**: Implement LLM client in FastAPI using the standard OpenAI client configured via `pydantic-settings` (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`).
- **Rationale**: Allows connecting to local Unsloth on `http://127.0.0.1:8888/api` for development and seamlessly switching to remote/hosted LLM providers for demos via environment variables alone.
- **Alternatives Considered**: Direct raw HTTP requests via httpx (more verbose and error-prone compared to typed OpenAI client).

## Risks / Trade-offs

- **[Risk] Angular Vitest lock breaks on bun update** → Pin `vitest: "^4.0.8"` explicitly in root `package.json` overrides.
- **[Risk] Webpack graph inference breaks with CommonJS in ESM workspace** → Use `webpack.config.cjs` for any NestJS Webpack configuration.
- **[Risk] Unsloth endpoint authentication or endpoint path quirks** → Probe both `/models` and `/chat/completions` with configurable auth headers, logging clear connectivity diagnostics during spike verification.
