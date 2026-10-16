---
name: react-mfe-conventions
description: Use when creating or changing the React chat micro frontend (remote), including the streaming chat UI, hooks, error handling, bundle size and the dashboard context contract with the Angular shell.
---

# React MFE conventions (chat remote)

Commands go through `bunx nx ...` / `bun`. Use the workspace's installed React version and idioms.

## Architecture and Bundler

- **Bundler**: Vite (`--bundler=vite`), providing fast HMR and seamless integration with Vitest.
- **Styling**:
  - Tailwind CSS + SCSS (`--style=scss`), sharing design tokens and styles consistently across microfrontends.
  - Use a theme color file to store all the color values and style constants, and use them in the SCSS files. Avoid hardcoding color values in the SCSS or HTML.
- **Microfrontend Architecture**: Native Federation (`@angular-architects/native-federation` / `@softarc/native-federation-node`), using browser-native ESM and Import Maps.
- **Coupling & Contracts**:
  - The remote is a **chat UI for the agent service**. Keep it small and focused.
  - The only coupling with the shell is the **dashboard context contract** in `libs/shared-mfe-context` (selected metric, devices, range) and the exposed entry module. Never import from the Angular shell.
  - The remote must run standalone in development, and load at runtime inside the shell without rebuilding the host.
  - Keep the bundle small. Avoid heavy dependencies; share framework packages through Native Federation.

## Components and hooks

- Function components and hooks only. Small components with typed props (TypeScript strict).
- Keep server communication and streaming logic in custom hooks (for example `useChatStream`), not in components.
- Derive state instead of duplicating it. Prefer local state and context; add a state library only if justified in an ADR.
- Use stable keys, memoize only where measured or clearly beneficial.
- Use an error boundary around the chat; a failing remote must not crash the shell.

## Streaming chat

- Consume the SSE protocol from the agent service: `token`, `tool_call`, `tool_result`, `done`, `error`.
- Render tool calls as visible **steps** (name, status, collapsed result summary). This is a core part of the demo.
- Handle: connection errors, cancellation (abort controller), partial output on error, and a stream that ends without `done`.
- Render model output as text/markdown safely; never inject unsanitized HTML.
- Include the current dashboard context in each request; do not rely on the model to guess the selected range.
- Use the generated OpenAPI client or typed event definitions from the contracts lib; never hand-duplicate event types.

## Timestamps and units

- Values arrive as UTC ISO-8601 with `Z`; show them in the viewer's timezone only at display time. Never parse zone-less strings.
- Show units exactly as provided by the API/tools.

## UX and accessibility

- Show clear states: idle, sending, streaming, tool running, error, retry.
- Keyboard accessible input and send action, live region for streamed messages, focus management on new messages.
- Disable or queue sending while a response streams, and allow stopping it.

## Tests

- **Unit / Component Tests**: Vitest (`@nx/vite:test` or `@nx/vitest`) for component and hook tests with streaming states (mock the SSE stream, inject deterministic events), including error and abort paths. No real LLM in unit tests.
- **E2E Tests**: Playwright for end-to-end user journeys (standalone and within shell). See `testing-strategy`.

## Checklist

- [ ] No imports from the shell; context only via `libs/shared-mfe-context`
- [ ] Bundled via Vite with Tailwind CSS + SCSS
- [ ] Streaming hook handles all event types, errors and cancellation
- [ ] Tool calls shown as steps; output rendered safely
- [ ] Standalone dev run and runtime load in the shell both work
- [ ] Lint and tests pass (`bunx nx affected -t lint test`)
