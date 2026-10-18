import {
  McpDomainServices,
  McpToolContext,
  ToolDefinition,
  ToolResult,
  jsonToolResult,
} from './tool-definition';

export const listMetricsTool: ToolDefinition = {
  name: 'list_metrics',
  description:
    'Returns the complete metric catalog including metric keys and measurement physical units.',
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
    const rawMetrics = await services.metricsService.getMetrics();
    const metrics = rawMetrics.map((m) => ({
      metric_key: m.metric_key,
      unit: m.unit,
    }));

    return jsonToolResult({ metrics });
  },
};
