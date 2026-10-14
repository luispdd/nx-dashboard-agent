export const MEASUREMENTS_REPOSITORY = 'MEASUREMENTS_REPOSITORY';

export interface MetricCatalogItem {
  metric_key: string;
  unit: string;
}

export interface SeriesPointRow {
  device_id: string;
  ts: string;
  value: number;
}

export interface StatsRow {
  device_id: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
  count: number;
  missing_ratio: number;
}

export interface SeriesQueryOptions {
  metric: string;
  devices?: string[];
  from?: string;
  to?: string;
  bucketSeconds?: number;
  includeOnDemand?: boolean;
  limit?: number;
}

export interface StatsQueryOptions {
  metric: string;
  devices?: string[];
  from?: string;
  to?: string;
  includeOnDemand?: boolean;
}

export interface MeasurementsRepository {
  getMetrics(): Promise<MetricCatalogItem[]>;
  getDevices(): Promise<string[]>;
  getSeries(options: SeriesQueryOptions): Promise<SeriesPointRow[]>;
  getStats(options: StatsQueryOptions): Promise<StatsRow[]>;
}
