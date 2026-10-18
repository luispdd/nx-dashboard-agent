import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  McpDomainServices,
  McpToolContext,
  ToolDefinition,
} from './tool-definition';
import { describeDatasetTool } from './describe-dataset.tool';
import { listMetricsTool } from './list-metrics.tool';
import { listDevicesTool } from './list-devices.tool';
import { buildGetSeriesInputSchema, getSeriesTool } from './get-series.tool';
import { buildGetStatsInputSchema, getStatsTool } from './get-stats.tool';
import {
  buildCompareDevicesInputSchema,
  compareDevicesTool,
} from './compare-devices.tool';

export function getAllTools(): ToolDefinition<any, any>[] {
  return [
    describeDatasetTool,
    listMetricsTool,
    listDevicesTool,
    getSeriesTool,
    getStatsTool,
    compareDevicesTool,
  ];
}

export async function registerAllTools(
  server: McpServer,
  services: McpDomainServices,
  context: McpToolContext
): Promise<void> {
  const metrics = await services.metricsService.getMetrics();
  const metricKeys = metrics.map((m) => m.metric_key);

  // 1. describe_dataset
  server.tool(
    describeDatasetTool.name,
    describeDatasetTool.description,
    describeDatasetTool.inputSchema as Record<string, never>,
    async (args) => {
      const res = await describeDatasetTool.handler(
        args as Record<string, unknown>,
        services,
        context
      );
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );

  // 2. list_metrics
  server.tool(
    listMetricsTool.name,
    listMetricsTool.description,
    listMetricsTool.inputSchema as Record<string, never>,
    async (args) => {
      const res = await listMetricsTool.handler(
        args as Record<string, unknown>,
        services,
        context
      );
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );

  // 3. list_devices
  server.tool(
    listDevicesTool.name,
    listDevicesTool.description,
    listDevicesTool.inputSchema as Record<string, never>,
    async (args) => {
      const res = await listDevicesTool.handler(
        args as Record<string, unknown>,
        services,
        context
      );
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );

  // 4. get_series (with dynamic metric enum schema)
  server.tool(
    getSeriesTool.name,
    getSeriesTool.description,
    buildGetSeriesInputSchema(metricKeys),
    async (args) => {
      const res = await getSeriesTool.handler(args as any, services, context);
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );

  // 5. get_stats (with dynamic metric enum schema)
  server.tool(
    getStatsTool.name,
    getStatsTool.description,
    buildGetStatsInputSchema(metricKeys),
    async (args) => {
      const res = await getStatsTool.handler(args as any, services, context);
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );

  // 6. compare_devices (with dynamic metric enum schema)
  server.tool(
    compareDevicesTool.name,
    compareDevicesTool.description,
    buildCompareDevicesInputSchema(metricKeys),
    async (args) => {
      const res = await compareDevicesTool.handler(
        args as any,
        services,
        context
      );
      return {
        content: res.content,
        isError: res.isError,
      };
    }
  );
}
