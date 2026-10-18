import { z } from 'zod';
import { MetricsService } from '../../metrics/metrics.service';
import { DevicesService } from '../../devices/devices.service';
import { SeriesService } from '../../series/series.service';
import { StatsService } from '../../stats/stats.service';
import { AppService } from '../../app.service';

export interface McpDomainServices {
  metricsService: MetricsService;
  devicesService: DevicesService;
  seriesService: SeriesService;
  statsService: StatsService;
  appService: AppService;
}

export interface McpToolContext {
  maxPointsPerCall: number;
  now?: Date;
}

export interface ToolContentItem {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape | z.ZodObject<any>;
  outputSchema?: z.ZodType<TOutput>;
  annotations?: {
    readOnlyHint?: boolean;
    idempotentHint?: boolean;
  };
  handler: (
    input: TInput,
    services: McpDomainServices,
    context: McpToolContext
  ) => Promise<ToolResult>;
}

export function jsonToolResult(data: Record<string, unknown> | unknown[]): ToolResult {
  const text = JSON.stringify(data, null, 2);
  const structuredContent = Array.isArray(data)
    ? { items: data }
    : (data as Record<string, unknown>);

  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

export function errorToolResult(errorMessage: string): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: errorMessage }],
  };
}
