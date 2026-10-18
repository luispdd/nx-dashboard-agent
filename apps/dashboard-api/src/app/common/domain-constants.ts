export const BUCKET_INTERVALS = ['5m', '15m', '1h', '6h', '1d'] as const;
export type BucketInterval = (typeof BUCKET_INTERVALS)[number];

export const DEFAULT_BUCKET_INTERVAL: BucketInterval = '5m';

export const BUCKET_SECONDS_MAP: Record<BucketInterval, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '1d': 24 * 60 * 60,
};

export function bucketToSeconds(bucket?: BucketInterval): number {
  if (bucket && bucket in BUCKET_SECONDS_MAP) {
    return BUCKET_SECONDS_MAP[bucket];
  }
  return BUCKET_SECONDS_MAP[DEFAULT_BUCKET_INTERVAL];
}

export const RANGE_PRESETS = ['last_24h', 'last_7d', 'last_30d'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_MS_MAP: Record<RangePreset, number> = {
  last_24h: 24 * 60 * 60 * 1000,
  last_7d: 7 * 24 * 60 * 60 * 1000,
  last_30d: 30 * 24 * 60 * 60 * 1000,
};

export function resolveRangePreset(
  preset: RangePreset,
  now: Date = new Date()
): { from: string; to: string } {
  const durationMs = RANGE_PRESET_MS_MAP[preset];
  const to = now.toISOString();
  const from = new Date(now.getTime() - durationMs).toISOString();
  return { from, to };
}

export const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
export const ISO_UTC_MESSAGE =
  'Timestamp must be an ISO-8601 UTC timestamp ending in Z (e.g. 2026-10-05T08:00:00Z)';

export const DEFAULT_SERIES_LIMIT = 100;
export const MCP_DEFAULT_MAX_POINTS_PER_CALL = 500;
export const MAX_DEVICES_PER_CALL = 20;
export const DEFAULT_INCLUDE_ON_DEMAND = false;
