import { z } from 'zod';
import {
  DEFAULT_INCLUDE_ON_DEMAND,
  ISO_UTC_REGEX,
  RANGE_PRESETS,
  RangePreset,
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

export interface CompareDevicesToolInput {
  metric_key: string;
  device_ids?: string[];
  from?: string;
  to?: string;
  range_preset?: RangePreset;
  include_on_demand?: boolean;
}

export function buildCompareDevicesInputSchema(
  metricKeys?: string[]
): z.ZodRawShape {
  const metricSchema =
    metricKeys && metricKeys.length > 0
      ? z.enum([metricKeys[0], ...metricKeys.slice(1)])
      : z.string();

  return {
    metric_key: metricSchema.describe(
      'Metric key to compare across devices (e.g. temperature, humidity)'
    ),
    device_ids: z
      .array(z.string())
      .optional()
      .describe('Optional list of device IDs to compare. If omitted, compares all devices.'),
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
    include_on_demand: z
      .boolean()
      .optional()
      .describe('Include on-demand manual readings in aggregate (default false)'),
  };
}

export const compareDevicesTool: ToolDefinition<CompareDevicesToolInput> = {
  name: 'compare_devices',
  description:
    'Compares statistical summaries of a metric across multiple IoT devices within a time window.',
  inputSchema: buildCompareDevicesInputSchema(),
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
  },
  handler: async (
    input: CompareDevicesToolInput,
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

    // 2. Validate devices
    const devicesList = await services.devicesService.getDevices();
    if (input.device_ids) {
      for (const dev of input.device_ids) {
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

    try {
      const statsResponse = await services.statsService.getStats({
        metric: input.metric_key,
        devices: input.device_ids,
        from,
        to,
        include_on_demand: input.include_on_demand ?? DEFAULT_INCLUDE_ON_DEMAND,
      });

      const deviceSummaries = statsResponse.stats.map((s) => ({
        device_id: s.device_id,
        mean: s.mean,
        std: s.std,
        min: s.min,
        max: s.max,
        count: s.count,
        missing_ratio: s.missing_ratio,
      }));

      const comparison = {
        metric: statsResponse.metric,
        unit: statsResponse.unit,
        window: {
          from: from || null,
          to: to || null,
        },
        devices_count: deviceSummaries.length,
        devices: deviceSummaries,
      };

      return jsonToolResult(comparison);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorToolResult(msg);
    }
  },
};
