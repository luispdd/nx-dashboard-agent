import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './app/app';
import { ChatErrorBoundary } from './app/components/chat-error-boundary';
import type { DashboardContext, MountOptions } from 'shared-mfe-context';

export type { DashboardContext, MountOptions };

export function mount(
  container: HTMLElement,
  options?: MountOptions
): () => void {
  const root: Root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ChatErrorBoundary>
        <App mountOptions={options} />
      </ChatErrorBoundary>
    </React.StrictMode>
  );

  return () => {
    root.unmount();
  };
}

export { App as Chat };
export default App;
