---
name: react-mfe-and-chat-quirks
description: Use when working on the React chat remote (`chat-mfe`): Vite remote entry bundling and dev serving, root .env handling, CORS between host and remote, drawer state persistence or streaming scroll behavior.
---

# React MFE and chat quirks

Pitfalls specific to the React chat micro frontend and its integration with the Angular host.

- **Vite Remote Entry Rollup Signatures**: When bundling React MFE entries (`apps/chat-mfe`), specify `preserveEntrySignatures: 'exports-only'` in `build.rollupOptions` so Rollup does not strip entry exports (`mount`, `Chat`) from `remoteEntry.js`.
- **Vite Dev Server Remote Entry MIME Type**: Vite dev mode serves on-demand without building `remoteEntry.js` to disk. Dynamic host imports fall back to `index.html` (`text/html`), causing browser errors (`Unsupported Content-Type "text/html"`). Fix by adding a custom dev middleware in `vite.config.mts` to serve `remoteEntry.js` and build assets with `application/javascript` and CORS headers, plus adding `"dependsOn": ["build"]` to `serve` in `project.json`.
- **Micro Frontend Origin Resolution in CORS**: When a remote MFE (e.g. `chat-mfe` on port 4204) mounts into a host shell (`dashboard-shell` on port 4200), browser `fetch` requests execute within the host's browsing context (`origin: http://localhost:4200`). Backend CORS configs (e.g. FastAPI `agent-service`) must permit both host and remote origins, including `localhost` and `127.0.0.1` variants.
- **MFE DOM State Persistence Across UI Toggles**: Toggling microfrontend host drawers or modals with Angular `@if` destroys the wrapper DOM and unmounts the remote's React root (`root.unmount()`), wiping in-memory state (messages, active streams). Keep the wrapper mounted in the DOM and toggle visibility via CSS transforms (`translate-x-full` / `translate-x-0`), backdrop opacity, and `[attr.inert]="!isOpen() ? '' : null"`.
- **Token Streaming vs. Smooth Scrolling Conflict**: Applying `scroll-smooth` or `scroll-behavior: smooth` to a chat message container during high-frequency token streams (~20 events/sec) causes animated scroll latency. Mid-flight scroll events falsely flag that the user has scrolled up (`distanceFromBottom > threshold`), permanently disengaging auto-scroll. Use instant scroll pinning (`el.scrollTop = el.scrollHeight`) without `scroll-smooth` during active streaming.
- **Vite `envDir` in Monorepo Sub-Apps**: In sub-applications bundled with Vite (`apps/chat-mfe`), Vite resolves `.env` files relative to its `root` (`apps/chat-mfe`). When environment configuration is centralized at workspace root, configure `envDir: '../../'` in `vite.config.mts` so Vite exposes root `VITE_*` variables to the client build without requiring redundant per-app `.env` files.
