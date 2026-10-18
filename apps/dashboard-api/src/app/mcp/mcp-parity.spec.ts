import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MetricsController } from '../metrics/metrics.controller';
import { DevicesController } from '../devices/devices.controller';
import { SeriesController } from '../series/series.controller';
import { StatsController } from '../stats/stats.controller';
import { McpService } from './mcp.service';
import { listMetricsTool } from './tools/list-metrics.tool';
import { listDevicesTool } from './tools/list-devices.tool';
import { getSeriesTool } from './tools/get-series.tool';
import { getStatsTool } from './tools/get-stats.tool';

describe('REST vs MCP Tool Parity Tests (on seeded database)', () => {
  let module: TestingModule;
  let metricsController: MetricsController;
  let devicesController: DevicesController;
  let seriesController: SeriesController;
  let statsController: StatsController;
  let mcpService: McpService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    metricsController = module.get<MetricsController>(MetricsController);
    devicesController = module.get<DevicesController>(DevicesController);
    seriesController = module.get<SeriesController>(SeriesController);
    statsController = module.get<StatsController>(StatsController);
    mcpService = module.get<McpService>(McpService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('metrics parity: list_metrics matches GET /api/metrics', async () => {
    const restMetrics = await metricsController.getMetrics();
    const mcpRes = await listMetricsTool.handler(
      {},
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    const mcpData = JSON.parse(mcpRes.content[0].text);
    expect(mcpData.metrics).toEqual(restMetrics);
  });

  it('devices parity: list_devices matches GET /api/devices', async () => {
    const restDevices = await devicesController.getDevices();
    const mcpRes = await listDevicesTool.handler(
      {},
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    const mcpData = JSON.parse(mcpRes.content[0].text);
    expect(mcpData.devices).toEqual(restDevices);
  });

  it('series parity: get_series matches GET /api/series', async () => {
    const query = {
      metric: 'temperature',
      devices: ['esp32c6'],
      bucket: '1h' as const,
      limit: 10,
    };

    const restSeries = await seriesController.getSeries(query);
    const mcpRes = await getSeriesTool.handler(
      {
        metric_key: 'temperature',
        device_ids: ['esp32c6'],
        bucket: '1h',
        limit: 10,
      },
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    const mcpData = JSON.parse(mcpRes.content[0].text);

    expect(mcpData.metric).toBe(restSeries.metric);
    expect(mcpData.unit).toBe(restSeries.unit);
    expect(mcpData.bucket).toBe(restSeries.bucket);
    expect(mcpData.series).toEqual(restSeries.series);
  });

  it('stats parity: get_stats matches GET /api/stats', async () => {
    const query = {
      metric: 'temperature',
      devices: ['esp32c6'],
    };

    const restStats = await statsController.getStats(query);
    const mcpRes = await getStatsTool.handler(
      {
        metric_key: 'temperature',
        device_id: 'esp32c6',
      },
      mcpService.getDomainServices(),
      { maxPointsPerCall: 500 }
    );

    const mcpData = JSON.parse(mcpRes.content[0].text);

    expect(mcpData.metric).toBe(restStats.metric);
    expect(mcpData.unit).toBe(restStats.unit);
    expect(mcpData.stats).toEqual(restStats.stats);
  });
});
