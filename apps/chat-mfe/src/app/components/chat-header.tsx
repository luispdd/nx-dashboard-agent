import React from 'react';
import type { DashboardContext } from 'shared-mfe-context';

export interface ChatHeaderProps {
  context?: DashboardContext;
  onClear: () => void;
  hasMessages: boolean;
  isStreaming: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  context,
  onClear,
  hasMessages,
  isStreaming,
}) => {
  // Format context pill text
  const metricLabel = context?.selectedMetric
    ? `${context.selectedMetric}${context.unit ? ` (${context.unit})` : ''}`
    : 'Telemetry';

  const deviceCount = context?.selectedDevices?.length || 0;
  const devicesLabel =
    deviceCount === 1
      ? context?.selectedDevices[0]
      : deviceCount > 1
      ? `${deviceCount} devices`
      : 'All boards';

  const rangeLabel =
    context?.timeRange?.preset
      ? context.timeRange.preset
      : context?.timeRange?.points
      ? `${context.timeRange.points} pts`
      : 'Live';

  return (
    <div
      className="px-4 py-2.5 border-b border-white/10 bg-[#131722]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0"
      data-testid="chat-header"
    >
      {/* Active Context Pill Badge */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs overflow-hidden"
        title="Active host container context applied to assistant queries"
        data-testid="context-pill"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
        </span>

        <div className="flex items-center gap-1.5 truncate text-[11px] font-mono">
          <span className="text-white font-medium">{metricLabel}</span>
          <span className="text-text-muted">/</span>
          <span className="text-accent">{devicesLabel}</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-secondary">{rangeLabel}</span>
        </div>
      </div>

      {/* Clear Conversation Action */}
      <button
        type="button"
        onClick={onClear}
        disabled={!hasMessages || isStreaming}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none"
        title="Clear current conversation"
        data-testid="clear-conversation-btn"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <span>Clear</span>
      </button>
    </div>
  );
};

export default ChatHeader;
