import React, { Component, type ReactNode, type ErrorInfo } from 'react';

export interface ChatErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

export interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ChatErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      return (
        <div
          className="flex flex-col items-center justify-center h-full w-full p-6 text-center bg-bg-app text-text-primary select-text"
          data-testid="chat-error-boundary-card"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3 shadow-inner">
            <svg
              className="w-6 h-6"
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
          </div>

          <h3 className="text-sm font-semibold text-white mb-1">
            Assistant Component Error
          </h3>
          <p className="text-xs text-text-muted max-w-xs mb-4">
            An unexpected error occurred in the chat assistant. You can reset the assistant to recover.
          </p>

          {this.state.error && (
            <div className="w-full max-w-xs p-2.5 mb-4 rounded-lg bg-card border border-white/10 text-[11px] font-mono text-rose-300 text-left overflow-x-auto truncate">
              {this.state.error.message || 'Unknown error'}
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="px-3.5 py-1.5 rounded-lg bg-accent text-slate-950 font-medium text-xs hover:bg-accent/90 transition-colors cursor-pointer shadow-sm"
            data-testid="reset-assistant-btn"
          >
            Reset Assistant
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChatErrorBoundary;
