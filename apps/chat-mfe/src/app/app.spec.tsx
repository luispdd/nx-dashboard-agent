import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './app';
import type { DashboardContext, MountOptions } from 'shared-mfe-context';

function createMockSseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('App Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should mount with default container context and empty state', () => {
    render(<App />);

    expect(screen.getByTestId('chat-app-root')).toBeDefined();
    expect(screen.getByTestId('context-pill')).toBeDefined();
    // Default context has temperature, esp32c6, 1d
    expect(screen.getByTestId('context-pill').textContent).toContain('temperature (°C)');
    expect(screen.getByTestId('context-pill').textContent).toContain('esp32c6');
    expect(screen.getByTestId('context-pill').textContent).toContain('1d');

    expect(screen.getByText('IoT Data Assistant')).toBeDefined();
  });

  it('should render custom initial context from mountOptions', () => {
    const customContext: DashboardContext = {
      selectedMetric: 'humidity',
      selectedDevices: ['esp32s3'],
      unit: '%',
      timeRange: { preset: '7d' },
    };

    render(<App mountOptions={{ context: customContext }} />);

    const pill = screen.getByTestId('context-pill');
    expect(pill.textContent).toContain('humidity (%)');
    expect(pill.textContent).toContain('esp32s3');
    expect(pill.textContent).toContain('7d');
  });

  it('should update context pill when host triggers onContextChange', () => {
    let changeListener: ((ctx: DashboardContext) => void) | null = null;

    const mountOptions: MountOptions = {
      context: {
        selectedMetric: 'temperature',
        selectedDevices: ['esp32c6'],
        unit: '°C',
        timeRange: { preset: '1d' },
      },
      onContextChange: (listener) => {
        changeListener = listener;
        return () => {
          changeListener = null;
        };
      },
    };

    render(<App mountOptions={mountOptions} />);

    expect(screen.getByTestId('context-pill').textContent).toContain('temperature (°C)');

    // Simulate host context change (e.g. user toggled to light metric on esp32s3)
    act(() => {
      changeListener?.({
        selectedMetric: 'light',
        selectedDevices: ['esp32s3'],
        unit: 'lux',
        timeRange: { preset: '6h' },
      });
    });

    const updatedPill = screen.getByTestId('context-pill');
    expect(updatedPill.textContent).toContain('light (lux)');
    expect(updatedPill.textContent).toContain('esp32s3');
    expect(updatedPill.textContent).toContain('6h');
  });

  it('should send a message, stream response, and allow clearing', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: token\ndata: {"content": "Telemetry is "}\n\n',
        'event: token\ndata: {"content": "operating within normal limits."}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );

    render(<App />);

    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'Is everything normal?' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-message-btn'));
    });

    expect(screen.getByText('Is everything normal?')).toBeDefined();
    expect(screen.getByText('Telemetry is operating within normal limits.')).toBeDefined();

    // Clear conversation
    const clearBtn = screen.getByTestId('clear-conversation-btn');
    act(() => {
      fireEvent.click(clearBtn);
    });

    expect(screen.queryByText('Is everything normal?')).toBeNull();
    expect(screen.getByText('IoT Data Assistant')).toBeDefined();
  });
});
