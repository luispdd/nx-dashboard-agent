---
name: nx-workspace-conventions
description: Use when creating projects or libraries, moving code between projects, changing module boundaries or tags, or running build/test/lint tasks in the Nx workspace (TypeScript and Python projects).
---

# Nx workspace conventions

## Tooling

- Choose `nx`, `bun` or `bunx` for running TypeScript/Angular/React/NestJS related scripts (`bunx nx <command>` or `nx <command>`). Install dependencies with `bun install` / `bun add`.
- Python projects are driven exclusively by `uv`; Nx targets for `apps/agent-service` are thin wrappers via `nx:run-commands` around `uv run ...`.
- Do not use `npm`, `npx`, `yarn` or `pnpm`.

## Creating Projects & Nx Generator Quirks

- **Use Nx Generators**: (`bunx nx g ...`) instead of hand-creating projects. Check available options with `--help`.
- **No Positional Arguments**: Modern Nx generators reject positional path arguments. Always pass explicit named flags: `--name=<name> --directory=<dir>`.
- **Always Pass Non-Interactive Flags**: Explicitly supply choices (e.g., `--unitTestRunner=vitest`, `--style=scss`, `--ssr=false`) to prevent generator prompts from hanging background executions.
- **Angular Bundler Flag**: `@nx/angular:app` accepts `esbuild`, `rspack`, or `webpack` (`--bundler=vite` does not exist). Use `--bundler=esbuild` to get Angular's official ApplicationBuilder (uses Vite dev server under the hood).
- **React Bundler Flag**: `@nx/react:app` accepts `vite`, `rsbuild`, `rspack`, or `webpack` (raw `esbuild` does not exist). Use `--bundler=vite`.
- After generating, review the output, remove unused boilerplate, set root `tsconfig.base.json` references if needed, and add tags.

## Toolchain Quirks & Pitfalls

- **Webpack in ESM Workspaces**: If root `package.json` contains `"type": "module"`, any Webpack configuration using CommonJS must be named `webpack.config.cjs`. A `.js` file will break `@nx/webpack/plugin` graph inference with `require is not defined in ES module scope`.
- **Angular Vitest Version Lock**: Angular's `@angular/build:unit-test` executor strictly requires `vitest@^4.0.8`. Do not install Vitest 5+ in this workspace.
- **Vitest Non-Watch Execution**: In `nx.json`, ensure `@nx/vitest` plugin uses `"testMode": "run"` instead of `"watch"` so CI and batch tasks (`nx run-many -t test`) exit cleanly.
- **Python Project Target Delegation**: Configure `apps/agent-service/project.json` with `nx:run-commands` wrapping `uv run <command>` (e.g. `uv run uvicorn`, `uv run pytest`, `uv run ruff`).

## Workspace Layout

```
apps/
  dashboard-shell/    Angular host (dashboard, zoneless, signals-first, ApexCharts, Tailwind + SCSS)
  chat-mfe/           React remote (chat, Vite, Tailwind + SCSS)
  dashboard-api/      NestJS (Fastify, SQLite/WAL, Vitest, Playwright E2E)
  agent-service/      FastAPI (Python managed with uv, LangGraph, SQLite)
libs/
  shared-mfe-context/ Dashboard context contract (event/state shared by shell and chat)
  shared/contracts/   Generated OpenAPI clients and shared constants (no hand-written duplicates)
docs/
  adr/                Architecture decision records
```

## Tags and boundaries

- Tag every project with a **type** (`type:app`, `type:feature`, `type:ui`, `type:data-access`, `type:util`, `type:contracts`) and a **scope** (`scope:dashboard`, `scope:chat`, `scope:shared`, `scope:agent`).
- Enforce with the module-boundary lint rule (`@nx/enforce-module-boundaries`). Example constraints:
  - apps can depend on any lib in their scope or `scope:shared`
  - `scope:dashboard` and `scope:chat` must not import each other; they communicate only through `scope:shared` contracts
  - `type:util` depends on nothing but other utils
  - libs never import from apps
- No deep imports into another project's internals; import only from its public entry point (`index.ts`).
- If a boundary rule blocks you, fix the design or ask. Do not disable the rule.

## Running tasks

- Prefer `bunx nx affected -t lint test build` over running everything.
- Use `bunx nx run <project>:<target>` for a single target; use `--skip-nx-cache` only when diagnosing cache issues.
- Make sure each target declares correct inputs and outputs so caching is reliable. A target that produces generated code (for example an OpenAPI client) must declare it as an output and run before the targets that depend on it (`dependsOn`).
- Generated code is checked in only if the plan says so; never hand-edit it.

## Microfrontend Federation

- The Angular shell is the host; the React chat is a remote.
- Architecture uses **Native Federation** (`@angular-architects/native-federation` / `@softarc/native-federation-node`) based on browser ESM and Import Maps (ADR-004).
- The remote must build and run standalone for development and load at runtime in the shell.

## Checklist

- [ ] Created with a generator using explicit named flags and non-interactive arguments
- [ ] Angular uses `--bundler=esbuild`, React uses `--bundler=vite`, styles use `--style=scss`
- [ ] Tags set, boundaries pass
- [ ] Targets have inputs/outputs and correct `dependsOn`
- [ ] Public API exported only through `index.ts`
