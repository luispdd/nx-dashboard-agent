## 1. Shared Context & Decoupling Foundation

- [x] 1.1 Export `createDefaultContainerContext()` from `libs/shared-mfe-context/src/lib/shared-mfe-context.ts` aliasing `createDefaultDashboardContext()`, and verify tests pass with `nx test shared-mfe-context`
- [x] 1.2 Update `apps/chat-mfe/src/remote-entry.tsx` to import `MountOptions` from `shared-mfe-context` and pass `options` to `<App mountOptions={options} />`, verifying build succeeds with `nx build chat-mfe`
- [x] 1.3 Add `apps/chat-mfe/.env.example` defining `VITE_AGENT_API_URL=http://localhost:8000` and verify the file exists and is documented

## 2. Core Streaming Hook & SSE Protocol

- [x] 2.1 Implement `useChatStream` hook in `apps/chat-mfe/src/app/hooks/use-chat-stream.ts` supporting `fetch` + `ReadableStream` SSE parsing (`token`, `tool_call`, `tool_result`, `done`, `error`) and `AbortController` cancellation, and verify typecheck passes
- [x] 2.2 Add unit tests for `useChatStream` in `apps/chat-mfe/src/app/hooks/use-chat-stream.spec.ts` covering token streaming, tool call states, abort cancellation, error handling, and clearing messages, verifying with `nx test chat-mfe`

## 3. Zero-Dependency Markdown & UI Components

- [x] 3.1 Implement zero-dependency `MarkdownContent` in `apps/chat-mfe/src/app/components/markdown-content.tsx` rendering paragraphs, bold/italic, inline code, code blocks, lists, and summary tables, and verify unit tests pass with `nx test chat-mfe`
- [x] 3.2 Implement `ToolStepAccordion` in `apps/chat-mfe/src/app/components/tool-step-accordion.tsx` rendering active spinner, completed badge, and expandable JSON inspector, and verify unit tests pass with `nx test chat-mfe`
- [x] 3.3 Implement `ChatHeader` in `apps/chat-mfe/src/app/components/chat-header.tsx` with active context pill badge (metric, device, time range) and "Clear Conversation" button, and verify unit tests pass with `nx test chat-mfe`
- [x] 3.4 Implement `MessageList` and `MessageBubble` in `apps/chat-mfe/src/app/components/message-list.tsx` and `message-bubble.tsx` with auto-scroll detection and distinct user/assistant styling, and verify unit tests pass with `nx test chat-mfe`
- [x] 3.5 Implement `ChatInput` in `apps/chat-mfe/src/app/components/chat-input.tsx` with auto-expanding textarea, Enter to send, Shift+Enter for newline, and dynamic Send/Stop buttons, and verify unit tests pass with `nx test chat-mfe`

## 4. Main Chat MFE Integration & Styling

- [x] 4.1 Configure Tailwind CSS dark theme tokens in `apps/chat-mfe` matching the host palette (`#0B0D12`, `#131722`, `#181E2C`, `#171B28`, `#2DD4BF`), and verify assets build cleanly with `nx build chat-mfe`
- [x] 4.2 Replace `NxWelcome` in `apps/chat-mfe/src/app/app.tsx` with `ChatContainer` connecting `useChatStream`, `mountOptions`, and reactive `onContextChange` subscription, and verify tests pass with `nx test chat-mfe`
- [x] 4.3 Add integration unit test in `apps/chat-mfe/src/app/app.spec.tsx` verifying full chat UI mounts with context pill, handles message submission, and updates on context changes

## 5. Verification & Quality

- [x] 5.1 Run all unit tests for affected projects with `nx test chat-mfe && nx test shared-mfe-context` and verify all tests pass
- [x] 5.2 Run lint and build verification with `nx run-many -t lint,build --projects=chat-mfe,shared-mfe-context` and verify zero errors

## 6. Shell Drawer DOM Persistence & Resilience

- [x] 6.1 Persist `<app-chat-wrapper>` in DOM across drawer open/close toggles in `apps/dashboard-shell/src/app/app.html` using CSS translate classes, backdrop opacity, and `inert` attribute
- [x] 6.2 Add retry action to `ChatWrapperComponent` and error UI in `apps/dashboard-shell/src/app/chat-wrapper`
- [x] 6.3 Add unit test in `apps/dashboard-shell/src/app/app.spec.ts` verifying drawer DOM persistence across toggles
