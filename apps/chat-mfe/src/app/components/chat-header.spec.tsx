import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatHeader } from './chat-header';
import type { DashboardContext } from 'shared-mfe-context';

describe('ChatHeader', () => {
  it('should render active context pill with metric, device, and preset', () => {
    const context: DashboardContext = {
      selectedMetric: 'temperature',
      selectedDevices: ['esp32c6'],
      unit: '°C',
      timeRange: { preset: '1d' },
    };

    render(
      <ChatHeader
        context={context}
        onClear={vi.fn()}
        hasMessages={true}
        isStreaming={false}
      />
    );

    const pill = screen.getByTestId('context-pill');
    expect(pill.textContent).toContain('temperature (°C)');
    expect(pill.textContent).toContain('esp32c6');
    expect(pill.textContent).toContain('1d');
  });

  it('should format multiple devices count', () => {
    const context: DashboardContext = {
      selectedMetric: 'humidity',
      selectedDevices: ['esp32c6', 'esp32s3'],
      timeRange: { points: 50 },
    };

    render(
      <ChatHeader
        context={context}
        onClear={vi.fn()}
        hasMessages={true}
        isStreaming={false}
      />
    );

    const pill = screen.getByTestId('context-pill');
    expect(pill.textContent).toContain('2 devices');
    expect(pill.textContent).toContain('50 pts');
  });

  it('should trigger onClear when clear button is clicked', () => {
    const onClearSpy = vi.fn();
    render(
      <ChatHeader
        onClear={onClearSpy}
        hasMessages={true}
        isStreaming={false}
      />
    );

    const clearBtn = screen.getByTestId('clear-conversation-btn');
    expect(clearBtn.getAttribute('disabled')).toBeNull();

    fireEvent.click(clearBtn);
    expect(onClearSpy).toHaveBeenCalledTimes(1);
  });

  it('should disable clear button when no messages or streaming', () => {
    const onClearSpy = vi.fn();
    const { rerender } = render(
      <ChatHeader
        onClear={onClearSpy}
        hasMessages={false}
        isStreaming={false}
      />
    );

    expect(screen.getByTestId('clear-conversation-btn').hasAttribute('disabled')).toBe(true);

    rerender(
      <ChatHeader
        onClear={onClearSpy}
        hasMessages={true}
        isStreaming={true}
      />
    );

    expect(screen.getByTestId('clear-conversation-btn').hasAttribute('disabled')).toBe(true);
  });
});
