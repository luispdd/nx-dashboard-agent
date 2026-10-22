import { beforeEach, describe, expect, it } from 'vitest';
import { getSecurityConfig } from './security.config';

describe('getSecurityConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_HOST;
    delete process.env.HOST;
    delete process.env.API_PORT;
    delete process.env.PORT;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.MCP_ALLOWED_ORIGINS;
    delete process.env.ALLOWED_HOSTS;
    delete process.env.SWAGGER_ENABLED;
    delete process.env.NODE_ENV;
  });

  it('provides safe loopback defaults when environment variables are unset', () => {
    const config = getSecurityConfig();
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.isLoopbackOnly).toBe(true);
    expect(config.allowedOrigins).toEqual([
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'http://localhost:4204',
      'http://127.0.0.1:4204',
    ]);
    expect(config.allowedHosts).toEqual([
      'localhost',
      '127.0.0.1',
      'localhost:3000',
      '127.0.0.1:3000',
    ]);
    expect(config.swaggerEnabled).toBe(true);
  });

  it('respects API_HOST over legacy HOST', () => {
    process.env.HOST = '0.0.0.0';
    process.env.API_HOST = '127.0.0.2';
    const config = getSecurityConfig();
    expect(config.host).toBe('127.0.0.2');
  });

  it('detects non-loopback bind address', () => {
    process.env.API_HOST = '0.0.0.0';
    const config = getSecurityConfig();
    expect(config.host).toBe('0.0.0.0');
    expect(config.isLoopbackOnly).toBe(false);
  });

  it('parses custom ALLOWED_ORIGINS', () => {
    process.env.ALLOWED_ORIGINS = 'http://trusted.local:8080, https://app.example.com';
    const config = getSecurityConfig();
    expect(config.allowedOrigins).toEqual([
      'http://trusted.local:8080',
      'https://app.example.com',
    ]);
  });

  it('uses MCP_ALLOWED_ORIGINS as alias when ALLOWED_ORIGINS is not set', () => {
    process.env.MCP_ALLOWED_ORIGINS = 'http://alias.local:3000';
    const config = getSecurityConfig();
    expect(config.allowedOrigins).toEqual(['http://alias.local:3000']);
  });

  it('prefers ALLOWED_ORIGINS over MCP_ALLOWED_ORIGINS alias', () => {
    process.env.ALLOWED_ORIGINS = 'http://primary.local';
    process.env.MCP_ALLOWED_ORIGINS = 'http://alias.local';
    const config = getSecurityConfig();
    expect(config.allowedOrigins).toEqual(['http://primary.local']);
  });

  it('parses custom ALLOWED_HOSTS', () => {
    process.env.ALLOWED_HOSTS = 'api.local, 127.0.0.1:3000';
    const config = getSecurityConfig();
    expect(config.allowedHosts).toEqual(['api.local', '127.0.0.1:3000']);
  });

  it('disables swagger when NODE_ENV is production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    expect(getSecurityConfig().swaggerEnabled).toBe(false);

    process.env.SWAGGER_ENABLED = 'true';
    expect(getSecurityConfig().swaggerEnabled).toBe(true);
  });
});
