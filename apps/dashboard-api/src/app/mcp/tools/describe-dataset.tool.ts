import { z } from 'zod';
import {
  McpDomainServices,
  McpToolContext,
  ToolDefinition,
  ToolResult,
  jsonToolResult,
} from './tool-definition';

export const describeDatasetTool: ToolDefinition = {
  name: 'describe_dataset',
  description:
    'Provides dataset orientation: lists monitored metrics with physical units, registered devices, ' +
    'temporal coverage bounds (earliest and latest timestamp), sampling conventions, and demo data status.',
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
  },
  handler: async (
    _input: Record<string, unknown>,
    services: McpDomainServices,
    _context: McpToolContext
  ): Promise<ToolResult> => {
    const [metrics, devices, timeBounds, status] = await Promise.all([
      services.metricsService.getMetrics(),
      services.devicesService.getDevices(),
      services.appService.getTimeBounds(),
      services.appService.getDatabaseStatus(),
    ]);

    const result = {
      metrics: metrics.map((m) => ({
        metric_key: m.metric_key,
        unit: m.unit,
      })),
      devices,
      temporal_coverage: {
        earliest: timeBounds.earliest,
        latest: timeBounds.latest,
      },
      sampling: {
        interval: '5m',
        convention:
          'Scheduled readings are recorded every 5 minutes. On-demand readings are excluded from aggregates unless explicitly requested.',
      },
      timestamps: {
        format: 'ISO-8601 UTC with Z suffix (e.g. 2026-10-14T00:00:00Z)',
      },
      is_demo: status.isDemo,
      reading_count: status.readingCount,
      device_count: status.deviceCount,
    };

    return jsonToolResult(result);
  },
};
