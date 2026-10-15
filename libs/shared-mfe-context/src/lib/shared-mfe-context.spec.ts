import { describe, it, expect, vi } from 'vitest';
import {
  createDefaultDashboardContext,
  sharedMfeContext,
  type DashboardContext,
  type MountOptions,
} from './shared-mfe-context';

describe('sharedMfeContext', () => {
  it('should return package identifier', () => {
    expect(sharedMfeContext()).toEqual('shared-mfe-context');
  });

  it('should create default dashboard context with expected initial parameters', () => {
    const defaultCtx = createDefaultDashboardContext();
    expect(defaultCtx.selectedMetric).toBe('temperature');
    expect(defaultCtx.selectedDevices).toEqual(['esp32c6']);
    expect(defaultCtx.unit).toBe('°C');
    expect(defaultCtx.timeRange?.preset).toBe('1d');
  });

  it('should satisfy MountOptions shape and callback typing', () => {
    let capturedContext: DashboardContext | null = null;
    const initialCtx = createDefaultDashboardContext();
    const cleanupSpy = vi.fn();

    const options: MountOptions = {
      context: initialCtx,
      onContextChange: (listener) => {
        listener({
          ...initialCtx,
          selectedMetric: 'humidity',
          unit: '%',
        });
        return cleanupSpy;
      },
    };

    expect(options.context?.selectedMetric).toBe('temperature');

    const unsubscribe = options.onContextChange?.((ctx) => {
      capturedContext = ctx;
    });

    expect(capturedContext).not.toBeNull();
    expect(capturedContext?.selectedMetric).toBe('humidity');
    expect(capturedContext?.unit).toBe('%');

    unsubscribe?.();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
