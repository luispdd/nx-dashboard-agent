export interface DashboardContext {
  selectedMetric?: string;
  selectedDevices: string[];
  timeRange?: {
    from?: string;
    to?: string;
    preset?: string;
  };
}

export function createDefaultDashboardContext(): DashboardContext {
  return {
    selectedDevices: ['esp32c6'],
    timeRange: {
      preset: 'last_24h',
    },
  };
}

export function sharedMfeContext(): string {
  return 'shared-mfe-context';
}
