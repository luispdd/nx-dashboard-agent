import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpGuard } from './mcp.guard';

function createMockContext(headers: Record<string, string | undefined>): ExecutionContext {
  const request = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('McpGuard', () => {
  let guard: McpGuard;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MCP_ENABLED = 'true';
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
    process.env.ALLOWED_HOSTS = 'localhost:3000,127.0.0.1:3000';
    guard = new McpGuard();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws NotFoundException when MCP is disabled', () => {
    process.env.MCP_ENABLED = 'false';
    const context = createMockContext({ host: 'localhost:3000' });
    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('allows request with valid Host and allowed Origin', () => {
    const context = createMockContext({
      host: 'localhost:3000',
      origin: 'http://localhost:4200',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows request without Origin header', () => {
    const context = createMockContext({
      host: '127.0.0.1:3000',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when Host is not allowed', () => {
    const context = createMockContext({
      host: 'attacker.rebinding.domain',
      origin: 'http://localhost:4200',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when Origin is not allowed', () => {
    const context = createMockContext({
      host: 'localhost:3000',
      origin: 'http://evil.example.com',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('validates bearer token when MCP_AUTH_TOKEN is configured', () => {
    process.env.MCP_AUTH_TOKEN = 'secure-mcp-token-xyz';

    // Missing header
    const missingCtx = createMockContext({ host: 'localhost:3000' });
    expect(() => guard.canActivate(missingCtx)).toThrow(UnauthorizedException);

    // Wrong token
    const wrongCtx = createMockContext({
      host: 'localhost:3000',
      authorization: 'Bearer wrong-token',
    });
    expect(() => guard.canActivate(wrongCtx)).toThrow(UnauthorizedException);

    // Correct token
    const validCtx = createMockContext({
      host: 'localhost:3000',
      authorization: 'Bearer secure-mcp-token-xyz',
    });
    expect(guard.canActivate(validCtx)).toBe(true);
  });
});
