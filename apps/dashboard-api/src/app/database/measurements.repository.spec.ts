import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { KyselyMeasurementsRepository } from './kysely-measurements.repository';

describe('KyselyMeasurementsRepository', () => {
  let sqlite: Database.Database;
  let repo: KyselyMeasurementsRepository;

  beforeEach(() => {
    sqlite = new Database(':memory:');

    // Create schema
    sqlite.exec(`
      CREATE TABLE metrics_catalog (
        metric_key TEXT PRIMARY KEY,
        unit TEXT NOT NULL
      );
      CREATE TABLE measurements (
        ts TEXT NOT NULL,
        device_id TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        value REAL,
        sampling TEXT NOT NULL CHECK (sampling IN ('scheduled', 'on_demand')),
        PRIMARY KEY (ts, device_id, metric_key),
        FOREIGN KEY (metric_key) REFERENCES metrics_catalog(metric_key)
      );
      CREATE INDEX idx_measurements_series ON measurements (device_id, metric_key, ts);
    `);

    // Seed test data
    sqlite.exec(`
      INSERT INTO metrics_catalog (metric_key, unit) VALUES
        ('temperature', '°C'),
        ('humidity', '%');

      INSERT INTO measurements (ts, device_id, metric_key, value, sampling) VALUES
        ('2026-10-05T08:00:00Z', 'esp32c6', 'temperature', 20.0, 'scheduled'),
        ('2026-10-05T08:02:00Z', 'esp32c6', 'temperature', 22.0, 'scheduled'),
        ('2026-10-05T08:03:00Z', 'esp32c6', 'temperature', 35.0, 'on_demand'),
        ('2026-10-05T08:05:00Z', 'esp32c6', 'temperature', 24.0, 'scheduled'),
        ('2026-10-05T08:00:00Z', 'esp32s3', 'temperature', 18.0, 'scheduled'),
        ('2026-10-05T08:00:00Z', 'esp32c6', 'humidity', 50.0, 'scheduled');
    `);

    repo = new KyselyMeasurementsRepository(sqlite);
  });

  afterEach(() => {
    repo.onModuleDestroy();
  });

  describe('getMetrics', () => {
    it('should return all metrics with units ordered by key', async () => {
      const metrics = await repo.getMetrics();
      expect(metrics).toEqual([
        { metric_key: 'humidity', unit: '%' },
        { metric_key: 'temperature', unit: '°C' },
      ]);
    });
  });

  describe('getDevices', () => {
    it('should return distinct sorted device identifiers', async () => {
      const devices = await repo.getDevices();
      expect(devices).toEqual(['esp32c6', 'esp32s3']);
    });
  });

  describe('getSeries', () => {
    it('should query downsampled measurements excluding on-demand by default', async () => {
      const series = await repo.getSeries({
        metric: 'temperature',
        devices: ['esp32c6'],
        bucketSeconds: 300, // 5m
      });

      // In the 08:00-08:05 bucket, values are 20.0 and 22.0 -> avg 21.0
      // 08:05 bucket has 24.0
      expect(series).toHaveLength(2);
      expect(series[0]).toEqual({
        device_id: 'esp32c6',
        ts: '2026-10-05T08:00:00Z',
        value: 21.0,
      });
      expect(series[1]).toEqual({
        device_id: 'esp32c6',
        ts: '2026-10-05T08:05:00Z',
        value: 24.0,
      });
    });

    it('should include on-demand readings when includeOnDemand is true', async () => {
      const series = await repo.getSeries({
        metric: 'temperature',
        devices: ['esp32c6'],
        bucketSeconds: 300,
        includeOnDemand: true,
      });

      // 08:00 bucket has 20.0, 22.0, 35.0 -> avg 25.67
      expect(series[0].value).toBe(25.67);
    });

    it('should support multiple devices', async () => {
      const series = await repo.getSeries({
        metric: 'temperature',
        devices: ['esp32c6', 'esp32s3'],
        bucketSeconds: 300,
      });

      const esp32c6Points = series.filter((s) => s.device_id === 'esp32c6');
      const esp32s3Points = series.filter((s) => s.device_id === 'esp32s3');

      expect(esp32c6Points.length).toBeGreaterThan(0);
      expect(esp32s3Points).toHaveLength(1);
      expect(esp32s3Points[0].value).toBe(18.0);
    });

    it('should limit series to latest N points per device in chronological order', async () => {
      // esp32c6 has 2 buckets for scheduled temperature: 08:00 (21.0) and 08:05 (24.0)
      // With limit=1, it should return only the latest bucket (08:05:00Z, 24.0)
      const series = await repo.getSeries({
        metric: 'temperature',
        devices: ['esp32c6'],
        bucketSeconds: 300,
        limit: 1,
      });

      expect(series).toHaveLength(1);
      expect(series[0]).toEqual({
        device_id: 'esp32c6',
        ts: '2026-10-05T08:05:00Z',
        value: 24.0,
      });
    });

    it('should apply limit per device across multiple devices', async () => {
      const series = await repo.getSeries({
        metric: 'temperature',
        devices: ['esp32c6', 'esp32s3'],
        bucketSeconds: 300,
        limit: 1,
      });

      // 1 latest point for esp32c6, 1 for esp32s3
      expect(series).toHaveLength(2);
      expect(series[0]).toEqual({
        device_id: 'esp32c6',
        ts: '2026-10-05T08:05:00Z',
        value: 24.0,
      });
      expect(series[1]).toEqual({
        device_id: 'esp32s3',
        ts: '2026-10-05T08:00:00Z',
        value: 18.0,
      });
    });
  });

  describe('getStats', () => {
    it('should compute deterministic stats (min, max, mean, std, count)', async () => {
      const stats = await repo.getStats({
        metric: 'temperature',
        devices: ['esp32c6'],
      });

      expect(stats).toHaveLength(1);
      const s = stats[0];
      expect(s.device_id).toBe('esp32c6');
      expect(s.count).toBe(3); // 20, 22, 24
      expect(s.min).toBe(20.0);
      expect(s.max).toBe(24.0);
      expect(s.mean).toBe(22.0);
      expect(s.std).toBe(2.0); // sample std of [20, 22, 24] is 2
    });

    it('should return null stats and 1.0 missing_ratio for devices with zero readings', async () => {
      const stats = await repo.getStats({
        metric: 'temperature',
        devices: ['unknown_device'],
      });

      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        device_id: 'unknown_device',
        min: null,
        max: null,
        mean: null,
        std: null,
        count: 0,
        missing_ratio: 1.0,
      });
    });
  });
});
