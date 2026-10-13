# ADR-004: Microfrontend Architecture — Native Federation for Angular Host and React Remote

## Status
Accepted (Validated via Spike 1)

## Context
The project architecture requires an Angular host application (`dashboard-shell`) displaying IoT telemetry charts that dynamically hosts a React micro frontend (`chat-mfe`) for conversational interactions.

Key architectural requirements and constraints:
1. **Modern Angular toolchain**: Angular 22 Zoneless application built with the official ApplicationBuilder (`esbuild` bundler with Vite dev server).
2. **React Remote**: Bundled with Vite for fast HMR and lightweight bundle footprint.
3. **No Webpack Lock-in**: Standard Webpack Module Federation requires downgrading Angular to legacy Webpack builders or complex CommonJS polyfills in ESM monorepos.
4. **Decoupled execution**: React remote must be runnable standalone in development and loaded at runtime in the Angular shell without host rebuilds.

## Decision
We adopt **Native Federation** (`@angular-architects/native-federation` and `@softarc/native-federation`).

1. **Angular Host Configuration**:
   - `apps/dashboard-shell` utilizes `@angular-architects/native-federation:build` executor.
   - `src/main.ts` initiates federation via `initFederation('federation.manifest.json')` and dynamically imports `src/bootstrap.ts`.
   - `federation.manifest.json` maps `chat-mfe` to `http://localhost:4204/remoteEntry.json`.
   - `ChatWrapperComponent` uses `loadRemoteModule('chat-mfe', './Chat')` to lazily resolve the remote module.

2. **React Remote Configuration**:
   - `apps/chat-mfe` serves on port `4204` with CORS enabled.
   - Vite builds a multi-entry bundle preserving `remoteEntry.js` with `public/remoteEntry.json` declaring exposed `./Chat`.
   - `src/remote-entry.tsx` exports a framework-agnostic `mount(container: HTMLElement, options?: { context?: DashboardContext })` function and `Chat` component.

3. **Shared Contract Bridge**:
   - `libs/shared-mfe-context` defines the shared contract interface (`DashboardContext`).
   - Communication between the Angular host and React remote occurs strictly through typed DOM mount options and events without cross-framework import coupling.

## Consequences & Verification
- **Build & Test**: `bunx nx build dashboard-shell`, `bunx nx build chat-mfe`, `bunx nx test dashboard-shell`, and `bunx nx test chat-mfe` all succeed.
- **Outcome**: **Works**. Native Federation successfully bridges Angular 22 ApplicationBuilder and Vite React remote using browser-native ESM and Import Maps.
