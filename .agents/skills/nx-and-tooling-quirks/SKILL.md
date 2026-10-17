---
name: nx-and-tooling-quirks
description: Use when running Nx generators or tasks, configuring Vitest, tsconfig, Webpack, ng-openapi or OpenSpec CLI commands, wiring Python targets into Nx, or when a build/test/serve command hangs or fails unexpectedly in the workspace.
---

# Nx and tooling quirks

Workspace-level toolchain quirks and pitfalls (Nx, Bun, Vitest, TypeScript, OpenSpec CLI, contract generation).

- **No Positional Arguments**: Modern Nx generators reject positional path arguments. Always pass explicit named flags: `--name=<name> --directory=<dir>`.
- **Always Pass Non-Interactive Flags**: Explicitly supply choices (e.g., `--unitTestRunner=vitest`, `--style=scss`, `--ssr=false`) to prevent generator prompts from hanging background executions.
- **Angular Bundler Flag**: `@nx/angular:app` accepts `esbuild`, `rspack`, or `webpack` (`--bundler=vite` does not exist). Use `--bundler=esbuild` to get Angular's official ApplicationBuilder (uses Vite dev server under the hood).
- **React Bundler Flag**: `@nx/react:app` accepts `vite`, `rsbuild`, `rspack`, or `webpack` (raw `esbuild` does not exist). Use `--bundler=vite`.
- **Webpack in ESM Workspaces**: If root `package.json` contains `"type": "module"`, any Webpack configuration using CommonJS must be named `webpack.config.cjs`. A `.js` file will break `@nx/webpack/plugin` graph inference with `require is not defined in ES module scope`.
- **Angular Vitest Version Lock**: Angular's `@angular/build:unit-test` executor strictly requires `vitest@^4.0.8`. Do not install Vitest 5+ in this workspace.
- **Vitest Non-Watch Execution**: In `nx.json`, ensure `@nx/vitest` plugin uses `"testMode": "run"` instead of `"watch"` so CI and batch tasks (`nx run-many -t test`) exit cleanly.
- **Root tsconfig & DOM Lib**: Project configs must extend `tsconfig.base.json`. Keep root `tsconfig.json` clean (no `verbatimModuleSyntax` or `bun` types). Ensure `tsconfig.base.json` includes `"dom"` and `"dom.iterable"` in `compilerOptions.lib` for Angular ApplicationBuilder.
- **Nx Environment Injection in Python Tests**: Nx automatically loads `.env` into `os.environ` when executing tasks. Tests asserting fallback behavior or missing environment variables (e.g. Pydantic Settings in `agent-service`) must isolate or delete ambient variables with a `monkeypatch.delenv` fixture to avoid developer `.env` leakage.
- **OpenSpec CLI Execution**: Run `openspec <cmd>` directly; never prefix with `bunx` or `npx`. Bare `openspec validate` opens an interactive menu; pass explicit flags like `openspec validate --all` or `openspec validate --specs` to avoid hanging background executions.
- **Python Project Target Delegation**: Configure `apps/agent-service/project.json` with `nx:run-commands` wrapping `uv run <command>` (e.g. `uv run uvicorn`, `uv run pytest`, `uv run ruff`).
- **Vitest `process.cwd()` Path Resolution**: Under `vitest run`, `process.cwd()` resolves to the individual project directory (e.g. `apps/dashboard-api`) instead of the workspace root. File lookups targeting workspace roots (`data/...`, `dist/...`) must search upwards recursively rather than assuming `resolve(process.cwd(), ...)`.
- **`ng-openapi` in ESM Workspaces**: In ESM root workspaces (`"type": "module"`), name the config `openapi.config.cjs` using `require()`. Generated client output (`libs/shared/contracts/src/generated/`) emits `@ts-nocheck` directives; add `{ ignores: ["src/generated/**/*"] }` to the library's `eslint.config.mjs`.
- **OpenAPI Export Prerequisite for API Contract Tests**: `apps/dashboard-api/src/app/openapi-contract.spec.ts` verifies against `dist/apps/dashboard-api/openapi.json`. Run `nx run dashboard-api:export-openapi` before executing API tests if `dist/` is clean or newly cloned.
- **Nx Multi-Project Serve Streaming**: `nx run-many -t serve` displays spinners indefinitely in interactive TUI mode because dev servers are continuous daemons. Pass `--outputStyle=stream` to view real-time startup logs and port bindings.
