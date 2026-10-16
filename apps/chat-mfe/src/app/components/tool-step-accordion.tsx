import React, { useState } from 'react';
import type { ToolStep } from '../hooks/use-chat-stream';

export interface ToolStepAccordionProps {
  step: ToolStep;
  defaultExpanded?: boolean;
}

export const ToolStepAccordion: React.FC<ToolStepAccordionProps> = ({
  step,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const getStatusBadge = () => {
    switch (step.status) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <svg
              className="animate-spin h-2.5 w-2.5 text-amber-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              data-testid="running-spinner"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            Running
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg
              className="h-2.5 w-2.5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              data-testid="completed-check"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Completed
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <svg
              className="h-2.5 w-2.5 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              data-testid="error-cross"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Error
          </span>
        );
    }
  };

  return (
    <div
      className="my-1.5 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden text-xs transition-colors hover:border-white/20"
      data-testid={`tool-step-${step.callId}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors focus:outline-none"
        aria-expanded={isExpanded}
        data-testid="toggle-tool-step"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-accent text-[11px] font-semibold truncate">
            {step.tool}
          </span>
          {getStatusBadge()}
        </div>

        <div className="flex items-center gap-1 text-text-muted">
          <span className="text-[10px] font-mono">
            {isExpanded ? 'Hide' : 'Inspect'}
          </span>
          <svg
            className={`w-3.5 h-3.5 transform transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div
          className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2 bg-surface-nested"
          data-testid="tool-step-details"
        >
          {step.args && Object.keys(step.args).length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-mono text-text-muted mb-1">
                Arguments:
              </div>
              <pre className="p-2 rounded bg-black/40 border border-white/5 text-[11px] font-mono text-text-secondary overflow-x-auto max-h-36">
                <code>{JSON.stringify(step.args, null, 2)}</code>
              </pre>
            </div>
          )}

          {step.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-mono text-text-muted mb-1">
                Result Output:
              </div>
              <pre className="p-2 rounded bg-black/40 border border-white/5 text-[11px] font-mono text-text-secondary overflow-x-auto max-h-48">
                <code>{JSON.stringify(step.result, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolStepAccordion;
