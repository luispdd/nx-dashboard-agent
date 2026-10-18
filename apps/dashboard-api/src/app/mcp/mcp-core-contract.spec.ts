import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { AppModule } from '../app.module';
import { McpService } from './mcp.service';
import { listMetricsTool } from './tools/list-metrics.tool';
import { getSeriesTool } from './tools/get-series.tool';

function findContractPath(): string {
  let currentDir = process.cwd();
  while (currentDir !== '/') {
    const candidate = resolve(currentDir, 'docs/contracts/mcp-core-contract.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(currentDir, '..');
    if (parent === currentDir) break;
    currentDir = parent;
  }
  throw new Error('Unable to find docs/contracts/mcp-core-contract.json');
}

describe('MCP Core Contract Conformance Tests', () => {
  let module: TestingModule;
  let mcpService: McpService;
  let contract: any;
  let ajv: Ajv;

  beforeAll(async () => {
    const contractPath = findContractPath();
    contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
    ajv = new Ajv({ allErrors: true });

    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    mcpService = module.get<McpService>(McpService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('contract file contains definitions for list_metrics and get_series', () => {
    expect(contract.tools).toBeDefined();
    expect(contract.tools.list_metrics).toBeDefined();
    expect(contract.tools.get_series).toBeDefined();
  });

  it('list_metrics output strictly satisfies the core contract JSON schema', async () => {
    const res = await listMetricsTool.handler(
      {},
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(res.content[0].text);

    const schema = contract.tools.list_metrics.output;
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      console.error('Validation errors for list_metrics:', validate.errors);
    }
    expect(valid).toBe(true);
    expect(data.metrics.length).toBeGreaterThan(0);
  });

  it('get_series output strictly satisfies the core contract JSON schema', async () => {
    const res = await getSeriesTool.handler(
      {
        metric_key: 'temperature',
        device_ids: ['esp32c6'],
        bucket: '1h',
        limit: 10,
      },
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(res.content[0].text);

    const schema = contract.tools.get_series.output;
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      console.error('Validation errors for get_series:', validate.errors);
    }
    expect(valid).toBe(true);
    expect(data.metric).toBe('temperature');
    expect(typeof data.truncated).toBe('boolean');
    expect(Array.isArray(data.series)).toBe(true);
  });

  it('get_series input validation strictly satisfies the core contract JSON schema', () => {
    const inputSchema = contract.tools.get_series.input;
    const validate = ajv.compile(inputSchema);

    // Valid inputs
    expect(
      validate({
        metric_key: 'temperature',
        device_id: 'esp32c6',
        bucket: '5m',
        include_on_demand: false,
        limit: 100,
      })
    ).toBe(true);

    expect(
      validate({
        metric_key: 'humidity',
        range_preset: 'last_24h',
      })
    ).toBe(true);

    // Invalid: missing required metric_key
    expect(validate({})).toBe(false);

    // Invalid: unknown additional property
    expect(
      validate({
        metric_key: 'temperature',
        unknown_field: 'invalid',
      })
    ).toBe(false);
  });
});
