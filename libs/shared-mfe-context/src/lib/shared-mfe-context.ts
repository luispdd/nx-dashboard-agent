export interface TimeRangeContext {
  from?: string;
  to?: string;
  preset?: string;
  points?: number;
}

export interface DashboardContext {
  selectedMetric?: string;
  selectedDevices: string[];
  unit?: string;
  timeRange?: TimeRangeContext;
}

export type DashboardContextListener = (context: DashboardContext) => void;

export interface DashboardAction {
  type: string;
  payload?: unknown;
}

export interface MountOptions {
  context?: DashboardContext;
  onContextChange?: (listener: DashboardContextListener) => () => void;
  onAction?: (action: DashboardAction) => void;
}

export function createDefaultDashboardContext(): DashboardContext {
  return {
    selectedMetric: 'temperature',
    selectedDevices: ['esp32c6'],
    unit: '°C',
    timeRange: {
      preset: '1d',
    },
  };
}

export const createDefaultContainerContext = createDefaultDashboardContext;

export function sharedMfeContext(): string {
  return 'shared-mfe-context';
}
