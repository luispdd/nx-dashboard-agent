import React, { useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../hooks/use-chat-stream';
import { MessageBubble } from './message-bubble';

export interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  'Detect any telemetry anomalies in the current view',
  'Summarize latest readings across active devices',
  'Compare average temperature between esp32c6 and esp32s3',
];

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  onSelectPrompt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);

  // Monitor user scroll position to determine whether to pin auto-scroll to the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 60; // pixels from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= threshold;
  }, []);

  // Auto-scroll to bottom when new tokens or messages arrive, if user is at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center space-y-4"
        data-testid="message-list-empty"
      >
        <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0017.25 3H6.75A2.25 2.25 0 004.5 5.25v13.5A2.25 2.25 0 006.75 21z"
            />
          </svg>
        </div>

        <div className="max-w-xs space-y-1">
          <h3 className="text-sm font-semibold text-white">IoT Data Assistant</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Grounded to your active dashboard filters. Inquire about sensor patterns, anomalies, or historical statistics.
          </p>
        </div>

        {onSelectPrompt && (
          <div className="w-full max-w-sm pt-2 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted text-left px-1">
              Suggested questions:
            </div>
            <div className="flex flex-col gap-1.5">
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-accent/30 text-text-secondary hover:text-white transition-all cursor-pointer group flex items-center justify-between"
                  data-testid={`starter-prompt-${idx}`}
                >
                  <span className="truncate">{prompt}</span>
                  <svg
                    className="w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scroll-smooth min-h-0 select-text"
      data-testid="message-list"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
};

export default MessageList;
