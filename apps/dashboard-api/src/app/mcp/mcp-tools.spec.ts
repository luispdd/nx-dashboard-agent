import { describe, it, expect, vi, beforeEach } from 'vitest';
import { describeDatasetTool } from './tools/describe-dataset.tool';
import { listMetricsTool } from './tools/list-metrics.tool';
import { listDevicesTool } from './tools/list-devices.tool';
import { getSeriesTool } from './tools/get-series.tool';
import { getStatsTool } from './tools/get-stats.tool';
import { compareDevicesTool } from './tools/compare-devices.tool';
import { McpDomainServices, McpToolContext } from './tools/tool-definition';

describe('MCP Tools Unit Tests', () => {
  let mockServices: McpDomainServices;
  let context: McpToolContext;

  beforeEach(() => {
    mockServices = {
      metricsService: {
        getMetrics: vi.fn().mockResolvedValue([
          { metric_key: 'temperature', unit: '°C' },
          { metric_key: 'humidity', unit: '%' },
        ]),
      } as any,
      devicesService: {
        getDevices: vi.fn().mockResolvedValue(['esp32c6', 'esp32s3']),
      } as any,
      seriesService: {
        getSeries: vi.fn().mockResolvedValue({
          metric: 'temperature',
          unit: '°C',
          bucket: '5m',
          series: [
            {
              device_id: 'esp32c6',
              points: [{ ts: '2026-10-05T08:00:00Z', value: 21.5 }],
            },
          ],
        }),
      } as any,
      statsService: {
        getStats: vi.fn().mockResolvedValue({
          metric: 'temperature',
          unit: '°C',
          stats: [
            {
              device_id: 'esp32c6',
              min: 15.0,
              max: 25.0,
              mean: 20.0,
              std: 2.5,
              count: 288,
              missing_ratio: 0.0,
            },
          ],
        }),
      } as any,
      appService: {
        getTimeBounds: vi.fn().mockResolvedValue({
          earliest: '2026-10-01T00:00:00Z',
          latest: '2026-10-08T00:00:00Z',
        }),
        getDatabaseStatus: vi.fn().mockResolvedValue({
          isDemo: true,
          readingCount: 5000,
          deviceCount: 2,
          lastImportedAt: null,
        }),
      } as any,
    };

    context = {
      maxPointsPerCall: 500,
      now: new Date('2026-10-18T12:00:00Z'),
    };
  });

  describe('describe_dataset tool', () => {
    it('returns metrics, devices, time bounds, sampling convention, and demo status', async () => {
      const res = await describeDatasetTool.handler({}, mockServices, context);
      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.metrics).toHaveLength(2);
      expect(data.metrics[0]).toEqual({ metric_key: 'temperature', unit: '°C' });
      expect(data.devices).toEqual(['esp32c6', 'esp32s3']);
      expect(data.temporal_coverage).toEqual({
        earliest: '2026-10-01T00:00:00Z',
        latest: '2026-10-08T00:00:00Z',
      });
      expect(data.sampling.interval).toBe('5m');
      expect(data.is_demo).toBe(true);
    });
  });

  describe('list_metrics tool', () => {
    it('returns metrics array from MetricsService', async () => {
      const res = await listMetricsTool.handler({}, mockServices, context);
      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.metrics).toEqual([
        { metric_key: 'temperature', unit: '°C' },
        { metric_key: 'humidity', unit: '%' },
      ]);
    });
  });

  describe('list_devices tool', () => {
    it('returns devices array from DevicesService', async () => {
      const res = await listDevicesTool.handler({}, mockServices, context);
      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.devices).toEqual(['esp32c6', 'esp32s3']);
    });
  });

  describe('get_series tool', () => {
    it('returns time series with units and truncated: false for small ranges', async () => {
      const res = await getSeriesTool.handler(
        {
          metric_key: 'temperature',
          device_id: 'esp32c6',
          from: '2026-10-05T00:00:00Z',
          to: '2026-10-05T04:00:00Z',
          bucket: '5m',
        },
        mockServices,
        context
      );

      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.metric).toBe('temperature');
      expect(data.unit).toBe('°C');
      expect(data.bucket).toBe('5m');
      expect(data.truncated).toBe(false);
      expect(data.series).toHaveLength(1);
    });

    it('rejects unknown metric_key with actionable error message', async () => {
      const res = await getSeriesTool.handler(
        { metric_key: 'radiation' },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Unknown metric_key: 'radiation'");
      expect(res.content[0].text).toContain('temperature, humidity');
    });

    it('rejects unknown device with actionable error message', async () => {
      const res = await getSeriesTool.handler(
        { metric_key: 'temperature', device_id: 'unknown_board' },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Unknown device: 'unknown_board'");
      expect(res.content[0].text).toContain('esp32c6, esp32s3');
    });

    it('rejects zone-less timestamp lacking Z suffix', async () => {
      const res = await getSeriesTool.handler(
        { metric_key: 'temperature', from: '2026-10-05T08:00:00' },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('ISO-8601 UTC timestamp ending in Z');
    });

    it('rejects from timestamp after to timestamp', async () => {
      const res = await getSeriesTool.handler(
        {
          metric_key: 'temperature',
          from: '2026-10-06T00:00:00Z',
          to: '2026-10-05T00:00:00Z',
        },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("'from' timestamp must be before or equal to 'to' timestamp");
    });

    it('promotes bucket interval and sets truncated: true when range exceeds point cap', async () => {
      // 7 days @ 5m = 7 * 288 = 2016 points > 500 cap
      // @ 15m = 7 * 96 = 672 > 500 cap
      // @ 1h = 7 * 24 = 168 <= 500 cap => Promoted to 1h
      const res = await getSeriesTool.handler(
        {
          metric_key: 'temperature',
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-08T00:00:00Z',
          bucket: '5m',
        },
        mockServices,
        context
      );

      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.bucket).toBe('1h');
      expect(data.truncated).toBe(true);
      expect(mockServices.seriesService.getSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: '1h',
        })
      );
    });

    it('resolves range_preset (e.g. last_24h)', async () => {
      await getSeriesTool.handler(
        {
          metric_key: 'temperature',
          range_preset: 'last_24h',
        },
        mockServices,
        context
      );

      expect(mockServices.seriesService.getSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2026-10-17T12:00:00.000Z',
          to: '2026-10-18T12:00:00.000Z',
        })
      );
    });
  });

  describe('get_stats tool', () => {
    it('returns statistics for a valid metric and device', async () => {
      const res = await getStatsTool.handler(
        {
          metric_key: 'temperature',
          device_id: 'esp32c6',
          range_preset: 'last_24h',
        },
        mockServices,
        context
      );

      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.metric).toBe('temperature');
      expect(data.unit).toBe('°C');
      expect(data.stats).toHaveLength(1);
      expect(data.stats[0].device_id).toBe('esp32c6');
    });

    it('rejects unknown metric', async () => {
      const res = await getStatsTool.handler(
        { metric_key: 'voltage' },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Unknown metric_key: 'voltage'");
    });

    it('rejects zone-less timestamp', async () => {
      const res = await getStatsTool.handler(
        { metric_key: 'temperature', to: '2026-10-18 12:00:00' },
        mockServices,
        context
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('ISO-8601 UTC timestamp ending in Z');
    });
  });

  describe('compare_devices tool', () => {
    it('returns multi-device statistical comparison', async () => {
      const res = await compareDevicesTool.handler(
        {
          metric_key: 'temperature',
          range_preset: 'last_7d',
        },
        mockServices,
        context
      );

      expect(res.isError).toBeFalsy();
      const data = JSON.parse(res.content[0].text);
      expect(data.metric).toBe('temperature');
      expect(data.unit).toBe('°C');
      expect(data.devices_count).toBe(1);
      expect(data.devices[0].device_id).toBe('esp32c6');
      expect(data.window.from).toBe('2026-10-11T12:00:00.000Z');
      expect(data.window.to).toBe('2026-10-18T12:00:00.000Z');
    });
  });
});
