import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onAbort,
  isStreaming,
  disabled = false,
  placeholder = 'Ask about telemetry data, trends, or anomalies...',
}) => {
  const [text, setText] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on scroll height, capped at 140px
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 140);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;

    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="pt-3 border-t border-white/10 bg-card/80 backdrop-blur-md shrink-0"
      data-testid="chat-input-form"
    >
      <div className="relative flex items-end gap-2 bg-bg-app border border-white/10 focus-within:border-accent/60 rounded-xl p-2 transition-all shadow-inner">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent border-none text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none px-2 py-1 min-h-[36px] max-h-[140px] leading-relaxed"
          data-testid="chat-textarea"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onAbort}
            className="h-8 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Stop generating"
            data-testid="stop-generation-btn"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            className="h-8 w-8 rounded-lg bg-accent text-slate-950 hover:bg-accent/90 disabled:opacity-30 disabled:hover:bg-accent disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
            title="Send message"
            data-testid="send-message-btn"
          >
            <svg
              className="w-4 h-4 transform rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 19V5m0 0l-7 7m7-7l7 7"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-1.5 pt-1.5 text-[10px] text-text-muted font-mono">
        <span>Press <kbd className="text-text-secondary bg-white/5 px-1 rounded">Enter</kbd> to send, <kbd className="text-text-secondary bg-white/5 px-1 rounded">Shift + Enter</kbd> for newline</span>
        <span>FastAPI Agent</span>
      </div>
    </form>
  );
};

export default ChatInput;
