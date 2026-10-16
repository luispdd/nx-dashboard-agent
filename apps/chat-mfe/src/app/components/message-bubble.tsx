import React from 'react';
import type { ChatMessage } from '../hooks/use-chat-stream';
import { ToolStepAccordion } from './tool-step-accordion';
import { MarkdownContent } from './markdown-content';

export interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div
        className="flex justify-end my-3"
        data-testid={`user-message-${message.id}`}
      >
        <div className="max-w-[85%] rounded-2xl rounded-tr-xs px-4 py-2.5 bg-accent/15 border border-accent/30 text-white shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div
      className="flex items-start gap-2.5 my-3"
      data-testid={`assistant-message-${message.id}`}
    >
      {/* Bot Avatar */}
      <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5 shadow-sm">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L4.2 15.3"
          />
        </svg>
      </div>

      {/* Bubble Content */}
      <div className="max-w-[88%] rounded-2xl rounded-tl-xs px-4 py-3 bg-[#131722] border border-white/10 text-text-primary shadow-md overflow-hidden select-text">
        {/* Tool Call Accordions */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2.5 space-y-1.5" data-testid="tool-steps-container">
            {message.toolCalls.map((step) => (
              <ToolStepAccordion key={step.callId} step={step} />
            ))}
          </div>
        )}

        {/* Markdown Rendered Content */}
        {message.content ? (
          <MarkdownContent content={message.content} />
        ) : (
          message.status === 'streaming' && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted py-1 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-ping"></span>
              <span>Thinking...</span>
            </div>
          )
        )}

        {/* Streaming Cursor */}
        {message.status === 'streaming' && message.content && (
          <span
            className="inline-block w-1.5 h-3.5 bg-accent ml-1 animate-pulse align-middle"
            data-testid="streaming-cursor"
          ></span>
        )}

        {/* Error Alert inside message */}
        {message.status === 'error' && (
          <div
            className="mt-2.5 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2"
            data-testid="assistant-error-alert"
          >
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>An error occurred during generation or tool execution.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
