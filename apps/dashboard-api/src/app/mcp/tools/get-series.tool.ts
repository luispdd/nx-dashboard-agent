import { z } from 'zod';
import {
  BUCKET_INTERVALS,
  BucketInterval,
  DEFAULT_BUCKET_INTERVAL,
  DEFAULT_INCLUDE_ON_DEMAND,
  ISO_UTC_REGEX,
  RANGE_PRESETS,
  RangePreset,
  bucketToSeconds,
  resolveRangePreset,
} from '../../common/domain-constants';
import {
  McpDomainServices,
  McpToolContext,
  ToolDefinition,
  ToolResult,
  errorToolResult,
  jsonToolResult,
} from './tool-definition';

export interface GetSeriesToolInput {
  metric_key: string;
  device_id?: string;
  device_ids?: string[];
  from?: string;
  to?: string;
  range_preset?: RangePreset;
  bucket?: BucketInterval;
  include_on_demand?: boolean;
  limit?: number;
}

export function buildGetSeriesInputSchema(metricKeys?: string[]): z.ZodRawShape {
  const metricSchema =
    metricKeys && metricKeys.length > 0
      ? z.enum([metricKeys[0], ...metricKeys.slice(1)])
      : z.string();

  return {
    metric_key: metricSchema.describe(
      'Metric key identifier (e.g. temperature, humidity, pressure)'
    ),
    device_id: z
      .string()
      .optional()
      .describe('Optional single target IoT device ID (e.g. esp32c6)'),
    device_ids: z
      .array(z.string())
      .optional()
      .describe('Optional list of target IoT device IDs'),
    from: z
      .string()
      .optional()
      .describe('Start timestamp in ISO-8601 UTC with Z suffix (e.g. 2026-10-05T00:00:00Z)'),
    to: z
      .string()
      .optional()
      .describe('End timestamp in ISO-8601 UTC with Z suffix (e.g. 2026-10-06T00:00:00Z)'),
    range_preset: z
      .enum(RANGE_PRESETS)
      .optional()
      .describe('Optional relative range preset (last_24h, last_7d, last_30d)'),
    bucket: z
      .enum(BUCKET_INTERVALS)
      .optional()
      .describe('Downsampling bucket interval (5m, 15m, 1h, 6h, 1d)'),
    include_on_demand: z
      .boolean()
      .optional()
      .describe('Include on-demand manual readings in aggregate (default false)'),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of points per device'),
  };
}

export const getSeriesTool: ToolDefinition<GetSeriesToolInput> = {
  name: 'get_series',
  description:
    'Retrieves telemetry time series for a metric over a time range, downsampled into buckets. ' +
    'Outputs are automatically downsampled to larger buckets if points would exceed MCP_MAX_POINTS_PER_CALL (500). ' +
    'Missing intervals are represented as null.',
  inputSchema: buildGetSeriesInputSchema(),
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
  },
  handler: async (
    input: GetSeriesToolInput,
    services: McpDomainServices,
    context: McpToolContext
  ): Promise<ToolResult> => {
    // 1. Dynamic metric validation
    const metrics = await services.metricsService.getMetrics();
    const metricKeys = metrics.map((m) => m.metric_key);
    if (!metricKeys.includes(input.metric_key)) {
      return errorToolResult(
        `Unknown metric_key: '${input.metric_key}'. Valid metric keys: ${metricKeys.join(', ')}`
      );
    }

    // 2. Normalize and validate devices
    const devicesList = await services.devicesService.getDevices();
    let targetDevices: string[] | undefined = undefined;

    if (input.device_ids && input.device_ids.length > 0) {
      targetDevices = input.device_ids;
    } else if (input.device_id) {
      targetDevices = [input.device_id];
    }

    if (targetDevices) {
      for (const dev of targetDevices) {
        if (!devicesList.includes(dev)) {
          return errorToolResult(
            `Unknown device: '${dev}'. Known devices: ${devicesList.join(', ')}`
          );
        }
      }
    }

    // 3. Resolve time range
    let from = input.from;
    let to = input.to;

    if (input.range_preset) {
      const presetRange = resolveRangePreset(input.range_preset, context.now);
      from = presetRange.from;
      to = presetRange.to;
    }

    if (from && !ISO_UTC_REGEX.test(from)) {
      return errorToolResult(
        `Timestamp '${from}' must be an ISO-8601 UTC timestamp ending in Z (e.g. 2026-10-05T08:00:00Z)`
      );
    }

    if (to && !ISO_UTC_REGEX.test(to)) {
      return errorToolResult(
        `Timestamp '${to}' must be an ISO-8601 UTC timestamp ending in Z (e.g. 2026-10-05T08:00:00Z)`
      );
    }

    if (from && to && from > to) {
      return errorToolResult("'from' timestamp must be before or equal to 'to' timestamp");
    }

    // 4. Downsampling and truncation calculation
    let effectiveBucket: BucketInterval = input.bucket || DEFAULT_BUCKET_INTERVAL;
    let truncated = false;
    const maxPoints = context.maxPointsPerCall || 500;

    if (from && to) {
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime();
      const durationSeconds = Math.max(0, (toMs - fromMs) / 1000);

      const estimatedPoints = Math.ceil(
        durationSeconds / bucketToSeconds(effectiveBucket)
      );

      if (estimatedPoints > maxPoints) {
        truncated = true;
        // Promote bucket
        const promoted = BUCKET_INTERVALS.find(
          (b) => Math.ceil(durationSeconds / bucketToSeconds(b)) <= maxPoints
        );
        if (promoted) {
          effectiveBucket = promoted;
        } else {
          // Even largest bucket exceeds cap
          effectiveBucket = '1d';
        }
      }
    }

    let queryLimit = input.limit;
    if (queryLimit && queryLimit > maxPoints) {
      queryLimit = maxPoints;
      truncated = true;
    }

    // 5. Query domain service
    try {
      const seriesResponse = await services.seriesService.getSeries({
        metric: input.metric_key,
        devices: targetDevices,
        from,
        to,
        bucket: effectiveBucket,
        include_on_demand: input.include_on_demand ?? DEFAULT_INCLUDE_ON_DEMAND,
        limit: queryLimit,
      });

      // Check if any device series points hit limit/cap
      if (
        queryLimit &&
        seriesResponse.series.some((s) => s.points.length >= queryLimit)
      ) {
        truncated = true;
      }

      return jsonToolResult({
        metric: seriesResponse.metric,
        unit: seriesResponse.unit,
        bucket: effectiveBucket,
        truncated,
        series: seriesResponse.series,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorToolResult(msg);
    }
  },
};
