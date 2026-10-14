import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MetricsService, DevicesService } from 'shared-contracts';
import {
  CapabilitiesService,
  formatMetricLabel,
  assignDeviceColors,
  BOARD_PALETTE,
} from './capabilities.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CapabilitiesService', () => {
  let service: CapabilitiesService;

  const mockMetricsService = {
    metricsControllerGetMetrics: vi.fn().mockReturnValue(
      of([
        { metric_key: 'temperature', unit: '°C' },
        { metric_key: 'humidity', unit: '%' },
      ])
    ),
  };

  const mockDevicesService = {
    devicesControllerGetDevices: vi.fn().mockReturnValue(
      of(['esp32s3', 'esp32c6'])
    ),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CapabilitiesService,
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: DevicesService, useValue: mockDevicesService },
      ],
    });

    service = TestBed.inject(CapabilitiesService);
  });

  it('should format metric labels into title case', () => {
    expect(formatMetricLabel('temperature')).toBe('Temperature');
    expect(formatMetricLabel('air_quality_index')).toBe('Air Quality Index');
    expect(formatMetricLabel('co2Ppm')).toBe('Co2 Ppm');
  });

  it('should sort devices alphabetically and assign stable colors', () => {
    const colorMap = assignDeviceColors(['esp32s3', 'esp32c6']);
    expect(Array.from(colorMap.keys())).toEqual(['esp32c6', 'esp32s3']);
    expect(colorMap.get('esp32c6')).toBe(BOARD_PALETTE[0]);
    expect(colorMap.get('esp32s3')).toBe(BOARD_PALETTE[1]);
  });

  it('should populate metrics and devices signals after loading catalog', async () => {
    await service.loadCatalog();

    const metrics = service.metrics();
    expect(metrics).toHaveLength(2);
    expect(metrics[0].metric_key).toBe('temperature');
    expect(metrics[0].label).toBe('Temperature');
    expect(metrics[0].unit).toBe('°C');

    const devices = service.devices();
    expect(devices).toHaveLength(2);
    expect(devices[0].device_id).toBe('esp32c6');
    expect(devices[1].device_id).toBe('esp32s3');
    expect(service.getDeviceColor('esp32c6')).toBe(BOARD_PALETTE[0]);
  });
});
