import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './app/app';
import type { DashboardContext } from 'shared-mfe-context';

export interface MountOptions {
  context?: DashboardContext;
  onContextChange?: (context: DashboardContext) => void;
}

export function mount(
  container: HTMLElement,
  options?: MountOptions
): () => void {
  const root: Root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  return () => {
    root.unmount();
  };
}

export { App as Chat };
export default App;
