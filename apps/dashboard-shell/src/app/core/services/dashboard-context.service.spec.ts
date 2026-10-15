import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardContextService } from './dashboard-context.service';

describe('DashboardContextService', () => {
  let service: DashboardContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DashboardContextService],
    });
    service = TestBed.inject(DashboardContextService);
  });

  it('should initialize with default dashboard context', () => {
    const ctx = service.activeContext();
    expect(ctx.selectedMetric).toBe('temperature');
    expect(ctx.selectedDevices).toEqual(['esp32c6']);
    expect(ctx.unit).toBe('°C');
    expect(ctx.timeRange?.preset).toBe('1d');
  });

  it('should update partial context fields', () => {
    service.updateContext({
      selectedMetric: 'humidity',
      unit: '%',
    });

    const ctx = service.activeContext();
    expect(ctx.selectedMetric).toBe('humidity');
    expect(ctx.unit).toBe('%');
    expect(ctx.selectedDevices).toEqual(['esp32c6']); // Preserved
  });

  it('should synchronize trends parameters with specific device and range preset', () => {
    service.syncFromTrends({
      metric: 'humidity',
      device: 'esp32s3',
      range: '7d',
      points: null,
      unit: '%',
      availableDevices: ['esp32c6', 'esp32s3'],
    });

    const ctx = service.activeContext();
    expect(ctx.selectedMetric).toBe('humidity');
    expect(ctx.selectedDevices).toEqual(['esp32s3']);
    expect(ctx.unit).toBe('%');
    expect(ctx.timeRange?.preset).toBe('7d');
    expect(ctx.timeRange?.points).toBeUndefined();
  });

  it('should synchronize trends parameters with "all" devices and point count mode', () => {
    service.syncFromTrends({
      metric: 'temperature',
      device: 'all',
      range: null,
      points: 100,
      unit: '°C',
      availableDevices: ['esp32c6', 'esp32s3'],
    });

    const ctx = service.activeContext();
    expect(ctx.selectedMetric).toBe('temperature');
    expect(ctx.selectedDevices).toEqual(['esp32c6', 'esp32s3']);
    expect(ctx.unit).toBe('°C');
    expect(ctx.timeRange?.points).toBe(100);
    expect(ctx.timeRange?.preset).toBeUndefined();
  });
});
