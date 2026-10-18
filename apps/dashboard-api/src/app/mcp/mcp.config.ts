export interface McpConfig {
  enabled: boolean;
  maxPointsPerCall: number;
  authToken?: string;
  allowedOrigins?: string[];
}

export const MCP_SERVER_INSTRUCTIONS =
  'IoT Dashboard Telemetry MCP Server. ' +
  'Telemetry timestamps are UTC with Z (ISO-8601). ' +
  'Sensor readings are regularly sampled every 5 minutes. ' +
  'On-demand readings are excluded from aggregates by default. ' +
  'Missing data points are represented as null, never zero.';

export function getMcpConfig(): McpConfig {
  const enabled = process.env.MCP_ENABLED !== 'false';
  const maxPointsPerCall = parseInt(
    process.env.MCP_MAX_POINTS_PER_CALL || '500',
    10
  );
  const authToken = process.env.MCP_AUTH_TOKEN || undefined;

  let allowedOrigins: string[] | undefined = undefined;
  if (process.env.MCP_ALLOWED_ORIGINS) {
    allowedOrigins = process.env.MCP_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  return {
    enabled,
    maxPointsPerCall: isNaN(maxPointsPerCall) ? 500 : maxPointsPerCall,
    authToken,
    allowedOrigins,
  };
}
