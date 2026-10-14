import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MetricsService, DevicesService, MetricItemDto } from 'shared-contracts';

export const BOARD_PALETTE: readonly string[] = [
  '#2DD4BF', // 0: Teal
  '#38BDF8', // 1: Sky Blue
  '#FBBF24', // 2: Amber
  '#A78BFA', // 3: Purple
  '#F472B6', // 4: Pink
  '#34D399', // 5: Emerald
  '#FB923C', // 6: Orange
  '#818CF8', // 7: Indigo
  '#E879F9', // 8: Fuchsia
  '#22D3EE', // 9: Cyan
];

export interface MetricOption {
  metric_key: string;
  label: string;
  unit: string;
  color: string;
}

export interface DeviceOption {
  device_id: string;
  color: string;
}

export function formatMetricLabel(key: string): string {
  if (!key) return '';
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function assignDeviceColors(deviceIds: string[]): Map<string, string> {
  const sorted = [...deviceIds].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  sorted.forEach((id, idx) => {
    map.set(id, BOARD_PALETTE[idx % BOARD_PALETTE.length]);
  });
  return map;
}

@Injectable({
  providedIn: 'root',
})
export class CapabilitiesService {
  private readonly metricsService = inject(MetricsService);
  private readonly devicesService = inject(DevicesService);

  private readonly rawMetrics = signal<MetricItemDto[]>([]);
  private readonly rawDevices = signal<string[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadCatalog();
  }

  async loadCatalog(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const [metrics, devices] = await Promise.all([
        firstValueFrom(this.metricsService.metricsControllerGetMetrics()),
        firstValueFrom(this.devicesService.devicesControllerGetDevices()),
      ]);
      this.rawMetrics.set(metrics ?? []);
      this.rawDevices.set(devices ?? []);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  readonly metrics = computed<MetricOption[]>(() => {
    const list = this.rawMetrics();
    return list.map((m, idx) => ({
      metric_key: m.metric_key,
      label: formatMetricLabel(m.metric_key),
      unit: m.unit,
      color: BOARD_PALETTE[idx % BOARD_PALETTE.length],
    }));
  });

  readonly deviceColorMap = computed<Map<string, string>>(() => {
    return assignDeviceColors(this.rawDevices());
  });

  readonly devices = computed<DeviceOption[]>(() => {
    const list = [...this.rawDevices()].sort((a, b) => a.localeCompare(b));
    const colors = this.deviceColorMap();
    return list.map((id) => ({
      device_id: id,
      color: colors.get(id) ?? BOARD_PALETTE[0],
    }));
  });

  getDeviceColor(deviceId: string): string {
    return this.deviceColorMap().get(deviceId) ?? BOARD_PALETTE[0];
  }

  getMetricOption(metricKey: string): MetricOption | undefined {
    return this.metrics().find((m) => m.metric_key === metricKey);
  }

  setMockCatalog(metrics: MetricItemDto[], devices: string[]): void {
    this.rawMetrics.set(metrics);
    this.rawDevices.set(devices);
  }
}
