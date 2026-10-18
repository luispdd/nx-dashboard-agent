import {
  McpDomainServices,
  McpToolContext,
  ToolDefinition,
  ToolResult,
  jsonToolResult,
} from './tool-definition';

export const listDevicesTool: ToolDefinition = {
  name: 'list_devices',
  description: 'Returns the list of all registered IoT device identifiers.',
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
    const devices = await services.devicesService.getDevices();
    return jsonToolResult({ devices });
  },
};
