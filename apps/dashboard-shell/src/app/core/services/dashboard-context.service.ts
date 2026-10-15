import { Injectable, signal } from '@angular/core';
import {
  createDefaultDashboardContext,
  type DashboardContext,
} from 'shared-mfe-context';

export interface SyncTrendsParams {
  metric: string;
  device: string;
  range: string | null;
  points: number | null;
  unit: string;
  availableDevices?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DashboardContextService {
  readonly activeContext = signal<DashboardContext>(
    createDefaultDashboardContext()
  );

  updateContext(partial: Partial<DashboardContext>): void {
    this.activeContext.update((current) => ({
      ...current,
      ...partial,
      timeRange: partial.timeRange
        ? { ...current.timeRange, ...partial.timeRange }
        : current.timeRange,
    }));
  }

  setContext(context: DashboardContext): void {
    this.activeContext.set(context);
  }

  syncFromTrends(params: SyncTrendsParams): void {
    const { metric, device, range, points, unit, availableDevices } = params;

    const devices =
      device === 'all'
        ? (availableDevices && availableDevices.length > 0 ? availableDevices : [])
        : [device];

    let timeRange: DashboardContext['timeRange'] = undefined;

    if (points != null && points > 0) {
      timeRange = {
        points,
      };
    } else if (range) {
      timeRange = {
        preset: range,
      };
    }

    this.activeContext.set({
      selectedMetric: metric,
      selectedDevices: devices,
      unit,
      timeRange,
    });
  }
}
