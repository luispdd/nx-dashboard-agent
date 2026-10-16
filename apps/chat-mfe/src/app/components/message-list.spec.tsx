import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageList } from './message-list';
import type { ChatMessage } from '../hooks/use-chat-stream';

describe('MessageList and MessageBubble', () => {
  it('should render empty state with starter prompts when messages array is empty', () => {
    const selectPromptSpy = vi.fn();
    render(
      <MessageList
        messages={[]}
        isStreaming={false}
        onSelectPrompt={selectPromptSpy}
      />
    );

    expect(screen.getByTestId('message-list-empty')).toBeDefined();
    expect(screen.getByText('IoT Data Assistant')).toBeDefined();

    const starterBtn = screen.getByTestId('starter-prompt-0');
    expect(starterBtn).toBeDefined();

    fireEvent.click(starterBtn);
    expect(selectPromptSpy).toHaveBeenCalledWith(
      'Detect any telemetry anomalies in the current view'
    );
  });

  it('should render user and assistant messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Check anomalies',
        status: 'completed',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'No anomalies detected.',
        toolCalls: [
          {
            callId: 'call-1',
            tool: 'detect_series_anomalies',
            args: { metric: 'temperature' },
            result: { anomalies: [] },
            status: 'completed',
          },
        ],
        status: 'completed',
      },
    ];

    render(<MessageList messages={messages} isStreaming={false} />);

    expect(screen.getByTestId('user-message-msg-1')).toBeDefined();
    expect(screen.getByText('Check anomalies')).toBeDefined();

    expect(screen.getByTestId('assistant-message-msg-2')).toBeDefined();
    expect(screen.getByText('No anomalies detected.')).toBeDefined();
    expect(screen.getByText('detect_series_anomalies')).toBeDefined();
  });

  it('should display streaming indicator and cursor when streaming', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Analyzing data...',
        status: 'completed',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Calculating',
        status: 'streaming',
      },
    ];

    render(<MessageList messages={messages} isStreaming={true} />);

    expect(screen.getByTestId('streaming-cursor')).toBeDefined();
  });

  it('should display error alert when assistant message has error status', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: '',
        status: 'error',
      },
    ];

    render(<MessageList messages={messages} isStreaming={false} />);

    expect(screen.getByTestId('assistant-error-alert')).toBeDefined();
  });
});
