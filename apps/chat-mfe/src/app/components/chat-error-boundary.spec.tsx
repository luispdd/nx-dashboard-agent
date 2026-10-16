import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatErrorBoundary } from './chat-error-boundary';

// Component that throws on demand
const ProblemChild: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test component explosion');
  }
  return <div data-testid="problem-child-ok">Normal Child Content</div>;
};

describe('ChatErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress React error boundary console output in test logs
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ChatErrorBoundary>
        <div data-testid="child-content">Hello World</div>
      </ChatErrorBoundary>
    );

    const child = screen.getByTestId('child-content');
    expect(child.textContent).toContain('Hello World');
    expect(screen.queryByTestId('chat-error-boundary-card')).toBeNull();
  });

  it('catches render error and displays error recovery card', () => {
    render(
      <ChatErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ChatErrorBoundary>
    );

    const card = screen.getByTestId('chat-error-boundary-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('Assistant Component Error');
    expect(card.textContent).toContain('Test component explosion');
    expect(screen.queryByTestId('problem-child-ok')).toBeNull();
  });

  it('clears error and calls onReset when Reset Assistant is clicked', () => {
    const onResetMock = vi.fn();

    const Wrapper = () => {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <ChatErrorBoundary
          onReset={() => {
            onResetMock();
            setShouldThrow(false);
          }}
        >
          <ProblemChild shouldThrow={shouldThrow} />
        </ChatErrorBoundary>
      );
    };

    render(<Wrapper />);

    expect(screen.getByTestId('chat-error-boundary-card')).toBeTruthy();

    const resetBtn = screen.getByTestId('reset-assistant-btn');
    fireEvent.click(resetBtn);

    expect(onResetMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('problem-child-ok')).toBeTruthy();
    expect(screen.queryByTestId('chat-error-boundary-card')).toBeNull();
  });

  it('renders custom fallback if provided', () => {
    render(
      <ChatErrorBoundary
        fallback={({ error, reset }) => (
          <div data-testid="custom-fallback">
            <span>Custom: {error.message}</span>
            <button onClick={reset}>Custom Reset</button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={true} />
      </ChatErrorBoundary>
    );

    const fallback = screen.getByTestId('custom-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('Custom: Test component explosion');
  });
});
