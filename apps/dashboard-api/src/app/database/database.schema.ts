export type SamplingType = 'scheduled' | 'on_demand';

export interface MetricsCatalogTable {
  metric_key: string;
  unit: string;
}

export interface MeasurementsTable {
  ts: string;
  device_id: string;
  metric_key: string;
  value: number | null;
  sampling: SamplingType;
}

export interface EtlMetadataTable {
  key: string;
  value: string;
}

export interface DatabaseSchema {
  metrics_catalog: MetricsCatalogTable;
  measurements: MeasurementsTable;
  etl_metadata: EtlMetadataTable;
}

