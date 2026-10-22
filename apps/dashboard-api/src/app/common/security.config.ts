export interface SecurityConfig {
  host: string;
  port: number;
  allowedOrigins: string[];
  allowedHosts: string[];
  swaggerEnabled: boolean;
  isLoopbackOnly: boolean;
}

export function getSecurityConfig(): SecurityConfig {
  const host = process.env.API_HOST || process.env.HOST || '127.0.0.1';
  const port = parseInt(process.env.API_PORT || process.env.PORT || '3000', 10);
  const effectivePort = isNaN(port) ? 3000 : port;

  const shellPort = process.env.WEB_SHELL_PORT || '4200';
  const remotePort = process.env.WEB_REMOTE_PORT || '4204';

  const defaultOrigins = [
    `http://localhost:${shellPort}`,
    `http://127.0.0.1:${shellPort}`,
    `http://localhost:${remotePort}`,
    `http://127.0.0.1:${remotePort}`,
  ];

  // ALLOWED_ORIGINS takes precedence; MCP_ALLOWED_ORIGINS acts as an alias
  const originEnv = process.env.ALLOWED_ORIGINS || process.env.MCP_ALLOWED_ORIGINS;
  const allowedOrigins = originEnv
    ? originEnv
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : defaultOrigins;

  const defaultHosts = [
    'localhost',
    '127.0.0.1',
    `localhost:${effectivePort}`,
    `127.0.0.1:${effectivePort}`,
  ];

  const hostEnv = process.env.ALLOWED_HOSTS;
  const allowedHosts = hostEnv
    ? hostEnv
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
    : defaultHosts;

  let swaggerEnabled: boolean;
  if (process.env.SWAGGER_ENABLED !== undefined) {
    swaggerEnabled = process.env.SWAGGER_ENABLED === 'true';
  } else {
    swaggerEnabled = process.env.NODE_ENV !== 'production';
  }

  const isLoopbackOnly = host === '127.0.0.1' || host === 'localhost';

  return {
    host,
    port: effectivePort,
    allowedOrigins,
    allowedHosts,
    swaggerEnabled,
    isLoopbackOnly,
  };
}
