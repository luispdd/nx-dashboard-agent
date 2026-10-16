import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ToolStepAccordion } from './tool-step-accordion';
import type { ToolStep } from '../hooks/use-chat-stream';

describe('ToolStepAccordion', () => {
  it('should render running state with spinner', () => {
    const step: ToolStep = {
      callId: 'call-1',
      tool: 'get_device_series',
      args: { metric: 'temperature', device_id: 'esp32c6' },
      status: 'running',
    };

    render(<ToolStepAccordion step={step} />);

    expect(screen.getByText('get_device_series')).toBeDefined();
    expect(screen.getByText('Running')).toBeDefined();
    expect(screen.getByTestId('running-spinner')).toBeDefined();
    expect(screen.queryByTestId('tool-step-details')).toBeNull();
  });

  it('should toggle expansion to inspect arguments and results', () => {
    const step: ToolStep = {
      callId: 'call-2',
      tool: 'detect_series_anomalies',
      args: { metric: 'temperature' },
      result: { anomalies_found: 2 },
      status: 'completed',
    };

    render(<ToolStepAccordion step={step} />);

    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByTestId('completed-check')).toBeDefined();

    // Details initially hidden
    expect(screen.queryByTestId('tool-step-details')).toBeNull();

    // Click toggle button
    fireEvent.click(screen.getByTestId('toggle-tool-step'));

    // Details visible
    const details = screen.getByTestId('tool-step-details');
    expect(details).toBeDefined();
    expect(details.textContent).toContain('"metric": "temperature"');
    expect(details.textContent).toContain('"anomalies_found": 2');

    // Click again to hide
    fireEvent.click(screen.getByTestId('toggle-tool-step'));
    expect(screen.queryByTestId('tool-step-details')).toBeNull();
  });

  it('should render error state badge', () => {
    const step: ToolStep = {
      callId: 'call-3',
      tool: 'get_stats',
      args: {},
      status: 'error',
    };

    render(<ToolStepAccordion step={step} />);

    expect(screen.getByText('Error')).toBeDefined();
    expect(screen.getByTestId('error-cross')).toBeDefined();
  });
});
