import React, { useState, useEffect } from 'react';
import {
  createDefaultContainerContext,
  type DashboardContext,
  type MountOptions,
} from 'shared-mfe-context';
import '../styles.scss';
import '../tailwind.css';
import { useChatStream } from './hooks/use-chat-stream';
import { ChatHeader } from './components/chat-header';
import { MessageList } from './components/message-list';
import { ChatInput } from './components/chat-input';

export interface AppProps {
  mountOptions?: MountOptions;
}

export function App({ mountOptions }: AppProps = {}) {
  // Initialize context from mountOptions or fallback to generic container defaults
  const [currentContext, setCurrentContext] = useState<DashboardContext>(() => {
    return mountOptions?.context ?? createDefaultContainerContext();
  });

  // Subscribe to live context changes dispatched by the host container
  useEffect(() => {
    if (mountOptions?.onContextChange) {
      const unsubscribe = mountOptions.onContextChange((updatedContext) => {
        setCurrentContext(updatedContext);
      });
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [mountOptions?.onContextChange]);

  // If initial context prop changes from host rerender
  useEffect(() => {
    if (mountOptions?.context) {
      setCurrentContext(mountOptions.context);
    }
  }, [mountOptions?.context]);

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    abortStream,
    clearMessages,
  } = useChatStream({
    context: currentContext,
  });

  return (
    <div
      className="flex flex-col h-full w-full bg-bg-app text-text-primary overflow-hidden font-sans select-text min-h-0"
      data-testid="chat-app-root"
    >
      <ChatHeader
        context={currentContext}
        onClear={clearMessages}
        hasMessages={messages.length > 0}
        isStreaming={isStreaming}
      />

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onSelectPrompt={sendMessage}
      />

      {error && (
        <div
          className="mx-3 my-1 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between gap-2 shrink-0"
          data-testid="global-chat-error"
        >
          <div className="flex items-center gap-2 truncate">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={clearMessages}
            className="text-[10px] uppercase font-mono underline hover:text-white shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <ChatInput
        onSendMessage={sendMessage}
        onAbort={abortStream}
        isStreaming={isStreaming}
      />
    </div>
  );
}

export default App;
