import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { McpService } from './mcp.service';

describe('MCP End-to-End & Protocol Integration Tests', () => {
  let app: NestFastifyApplication;
  let mcpService: McpService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    mcpService = moduleRef.get<McpService>(McpService);
  });

  afterAll(async () => {
    await app.close();
  });

  function parseSseOrJson(bodyText: string): any {
    if (bodyText.includes('data:')) {
      const lines = bodyText.split('\n');
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (dataLine) {
        return JSON.parse(dataLine.slice(5).trim());
      }
    }
    return JSON.parse(bodyText);
  }

  describe('HTTP Transport & Routing (/api/mcp)', () => {
    it('rejects GET requests with 405 Method Not Allowed', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/mcp',
      });
      expect(res.statusCode).toBe(405);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Method Not Allowed');
    });

    it('rejects DELETE requests with 405 Method Not Allowed', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/mcp',
      });
      expect(res.statusCode).toBe(405);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Method Not Allowed');
    });

    it('handles initialize request over HTTP POST and returns instructions', async () => {
      const initPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-mcp-client',
            version: '1.0.0',
          },
        },
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: initPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = parseSseOrJson(res.body);
      expect(body.result).toBeDefined();
      expect(body.result.protocolVersion).toBe('2024-11-05');
      expect(body.result.instructions).toContain('UTC with Z');
      expect(body.result.instructions).toContain('regularly sampled every 5 minutes');
    });

    it('handles tools/list request over HTTP POST returning all 6 tools with dynamic enums', async () => {
      const listPayload = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: listPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = parseSseOrJson(res.body);
      expect(body.result).toBeDefined();
      expect(body.result.tools).toBeDefined();

      const toolNames = body.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('describe_dataset');
      expect(toolNames).toContain('list_metrics');
      expect(toolNames).toContain('list_devices');
      expect(toolNames).toContain('get_series');
      expect(toolNames).toContain('get_stats');
      expect(toolNames).toContain('compare_devices');

      // Check dynamic metric enum in get_series tool schema
      const getSeries = body.result.tools.find((t: any) => t.name === 'get_series');
      expect(getSeries.inputSchema.properties.metric_key.enum).toEqual(
        expect.arrayContaining(['temperature', 'humidity', 'pressure'])
      );
    });

    it('handles tools/call request over HTTP POST for valid list_metrics call', async () => {
      const callPayload = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_metrics',
          arguments: {},
        },
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: callPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = parseSseOrJson(res.body);
      expect(body.result).toBeDefined();
      expect(body.result.isError).toBeFalsy();
      const content = JSON.parse(body.result.content[0].text);
      expect(content.metrics.length).toBeGreaterThan(0);
    });

    it('returns actionable tool error when calling tool with invalid parameters', async () => {
      const callPayload = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_series',
          arguments: {
            metric_key: 'non_existent_metric',
          },
        },
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: callPayload,
      });

      expect(res.statusCode).toBe(200);
      const body = parseSseOrJson(res.body);
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toMatch(/humidity|pressure|temperature/);
    });
  });

  describe('Authentication & Origin Guards', () => {
    it('rejects unauthorized requests when MCP_AUTH_TOKEN is configured', async () => {
      process.env.MCP_AUTH_TOKEN = 'secret-test-token-123';

      const resNoAuth = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        payload: { jsonrpc: '2.0', id: 10, method: 'tools/list', params: {} },
      });
      expect(resNoAuth.statusCode).toBe(401);

      const resBadAuth = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: { authorization: 'Bearer wrong-token' },
        payload: { jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} },
      });
      expect(resBadAuth.statusCode).toBe(401);

      const resGoodAuth = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          authorization: 'Bearer secret-test-token-123',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: { jsonrpc: '2.0', id: 12, method: 'tools/list', params: {} },
      });
      expect(resGoodAuth.statusCode).toBe(200);

      delete process.env.MCP_AUTH_TOKEN;
    });

    it('rejects forbidden origins when MCP_ALLOWED_ORIGINS is configured', async () => {
      process.env.MCP_ALLOWED_ORIGINS = 'https://dashboard.internal,https://agent.internal';

      const resForbidden = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: { origin: 'https://evil.external' },
        payload: { jsonrpc: '2.0', id: 20, method: 'tools/list', params: {} },
      });
      expect(resForbidden.statusCode).toBe(403);

      const resAllowed = await app.inject({
        method: 'POST',
        url: '/api/mcp',
        headers: {
          origin: 'https://dashboard.internal',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: { jsonrpc: '2.0', id: 21, method: 'tools/list', params: {} },
      });
      expect(resAllowed.statusCode).toBe(200);

      delete process.env.MCP_ALLOWED_ORIGINS;
    });
  });

  describe('In-Process Client Interaction', () => {
    it('connects in-process client, discovers tools, and calls describe_dataset', async () => {
      const server = await mcpService.createServer();
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await server.connect(serverTransport);

      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      await client.connect(clientTransport);

      // Verify instructions
      const instructions = client.getInstructions?.() ?? (client as any)._instructions;
      expect(instructions).toContain('UTC with Z');

      // Verify tool discovery
      const toolList = await client.listTools();
      expect(toolList.tools.length).toBe(6);

      // Call describe_dataset
      const res = await client.callTool({
        name: 'describe_dataset',
        arguments: {},
      });

      expect(res.isError).toBeFalsy();
      const data = JSON.parse((res.content[0] as any).text);
      expect(data.metrics.length).toBeGreaterThanOrEqual(3);
      expect(data.devices.length).toBeGreaterThanOrEqual(3);
      expect(data.temporal_coverage.earliest).toBeDefined();
      expect(data.temporal_coverage.latest).toBeDefined();

      await client.close();
      await server.close();
    });
  });
});
