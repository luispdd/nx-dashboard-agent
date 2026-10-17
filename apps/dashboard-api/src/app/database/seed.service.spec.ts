import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SeedService, AnomalySpec } from './seed.service';

describe('SeedService', () => {
  let service: SeedService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'seed-test-'));
    service = new SeedService();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates synthetic database matching source schema and counts', () => {
    const targetPath = join(tempDir, 'source.db');
    const counts = service.generateSyntheticDatabase(
      targetPath,
      {
        durationDays: 1,
        intervalMinutes: 15,
      },
      42
    );

    expect(counts.nodes).toBe(3);
    expect(counts.sensorCapabilities).toBe(9); // 3 devices * 3 metrics
    expect(counts.readings).toBeGreaterThan(0);

    const db = new Database(targetPath);
    try {
      const tables = (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          )
          .all() as { name: string }[]
      ).map((r) => r.name);

      expect(tables).toContain('nodes');
      expect(tables).toContain('sensor_capabilities');
      expect(tables).toContain('readings');
      expect(tables).toContain('sync_state');
      expect(tables).toContain('source_metadata');

      const meta = db
        .prepare("SELECT value FROM source_metadata WHERE key = 'is_demo'")
        .get() as { value: string };
      expect(meta.value).toBe('true');

      // Check timestamp format in readings: YYYY-MM-DDTHH:MM:SS (naive UTC string without Z)
      const firstRow = db
        .prepare('SELECT timestamp, metrics, is_fine_tuned FROM readings LIMIT 1')
        .get() as { timestamp: string; metrics: string; is_fine_tuned: number };

      expect(firstRow.timestamp).toContain('T');
      expect(firstRow.timestamp.endsWith('Z')).toBe(false);
      expect(firstRow.timestamp.length).toBe(19);

      const metrics = JSON.parse(firstRow.metrics);
      expect(metrics).toHaveProperty('temperature');
      expect(metrics).toHaveProperty('humidity');
      expect(metrics).toHaveProperty('pressure');
      expect([0, 1]).toContain(firstRow.is_fine_tuned);
    } finally {
      db.close();
    }
  });

  it('injects anomalies (peer deviation, spike, flatline, gap) deterministically', () => {
    const targetPath = join(tempDir, 'source_anomaly.db');
    const anomalies: AnomalySpec[] = [
      {
        anomalyType: 'peer_deviation',
        deviceId: 'esp32c6',
        metricKey: 'temperature',
        startOffsetMinutes: 120,
        durationMinutes: 60,
        magnitude: 10.0,
      },
      {
        anomalyType: 'spike',
        deviceId: 'esp32s3',
        metricKey: 'humidity',
        startOffsetMinutes: 240,
        durationMinutes: 5,
        magnitude: 50.0,
      },
      {
        anomalyType: 'flatline',
        deviceId: 'esp32node1',
        metricKey: 'temperature',
        startOffsetMinutes: 300,
        durationMinutes: 120,
      },
      {
        anomalyType: 'gap',
        deviceId: 'esp32c6',
        metricKey: 'temperature',
        startOffsetMinutes: 500,
        durationMinutes: 60,
      },
    ];

    service.generateSyntheticDatabase(
      targetPath,
      {
        devices: ['esp32c6', 'esp32s3', 'esp32node1'],
        durationDays: 1,
        intervalMinutes: 10,
        anomalies,
      },
      123
    );

    const db = new Database(targetPath);
    try {
      // 1. Verify gap exists for esp32c6 between 500 and 560 minutes
      const gapRows = db
        .prepare(`
          SELECT timestamp FROM readings 
          WHERE device_id = 'esp32c6' 
            AND timestamp >= '2026-10-05T08:20:00' 
            AND timestamp < '2026-10-05T09:20:00'
        `)
        .all();
      expect(gapRows.length).toBe(0);

      // 2. Verify flatline for esp32node1
      const flatlineRows = db
        .prepare(`
          SELECT metrics FROM readings
          WHERE device_id = 'esp32node1'
            AND is_fine_tuned = 0
            AND timestamp >= '2026-10-05T05:00:00' 
            AND timestamp < '2026-10-05T07:00:00'
        `)
        .all() as { metrics: string }[];

      expect(flatlineRows.length).toBeGreaterThan(5);
      const temps = flatlineRows.map((r) => JSON.parse(r.metrics).temperature);
      const firstTemp = temps[0];
      expect(temps.every((t) => t === firstTemp)).toBe(true);
    } finally {
      db.close();
    }
  });

  it('supports explicit isDemo: false', () => {
    const targetPath = join(tempDir, 'source_real.db');
    service.generateSyntheticDatabase(
      targetPath,
      {
        durationDays: 1,
        intervalMinutes: 60,
        isDemo: false,
      },
      42
    );

    const db = new Database(targetPath);
    try {
      const meta = db
        .prepare("SELECT value FROM source_metadata WHERE key = 'is_demo'")
        .get() as { value: string };
      expect(meta.value).toBe('false');
    } finally {
      db.close();
    }
  });
});
