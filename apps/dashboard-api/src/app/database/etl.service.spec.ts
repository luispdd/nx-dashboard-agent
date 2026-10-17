import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  EtlService,
  buildCatalogAndValidateUnits,
  mapSampling,
  validateAndNormalizeTimestamp,
} from './etl.service';

describe('EtlService', () => {
  let tempDir: string;
  let service: EtlService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'etl-test-'));
    service = new EtlService();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateAndNormalizeTimestamp', () => {
    it('normalizes valid naive UTC timestamp to ISO-8601 with Z', () => {
      expect(validateAndNormalizeTimestamp('2026-10-05T08:36:23')).toBe(
        '2026-10-05T08:36:23Z'
      );
    });

    it('preserves timestamp already ending with Z', () => {
      expect(validateAndNormalizeTimestamp('2026-10-05T08:36:23Z')).toBe(
        '2026-10-05T08:36:23Z'
      );
    });

    it('rejects malformed date strings', () => {
      expect(() => validateAndNormalizeTimestamp('invalid-date-string')).toThrow(
        /Malformed ISO-8601 timestamp string/
      );
    });

    it('rejects empty or null timestamps', () => {
      expect(() => validateAndNormalizeTimestamp('')).toThrow(
        /Invalid timestamp value/
      );
    });
  });

  describe('mapSampling', () => {
    it('maps 0 or false to scheduled', () => {
      expect(mapSampling(0)).toBe('scheduled');
      expect(mapSampling(false)).toBe('scheduled');
    });

    it('maps 1, true, or strings to on_demand', () => {
      expect(mapSampling(1)).toBe('on_demand');
      expect(mapSampling(true)).toBe('on_demand');
      expect(mapSampling('1')).toBe('on_demand');
      expect(mapSampling('true')).toBe('on_demand');
    });
  });

  describe('buildCatalogAndValidateUnits', () => {
    it('detects conflicting units across devices', () => {
      const dbPath = join(tempDir, 'conflicting_units.db');
      const conn = new Database(dbPath);
      conn.exec(`
        CREATE TABLE sensor_capabilities (
          device_id TEXT,
          metric_key TEXT,
          unit TEXT,
          PRIMARY KEY (device_id, metric_key)
        );
      `);

      conn
        .prepare(
          "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES ('esp1', 'temperature', '°C')"
        )
        .run();
      conn
        .prepare(
          "INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES ('esp2', 'temperature', '°F')"
        )
        .run();

      expect(() => buildCatalogAndValidateUnits(conn)).toThrow(
        /Conflicting unit for metric 'temperature'/
      );
      conn.close();
    });
  });

  describe('runEtl end-to-end', () => {
    function createMockSourceDb(
      path: string,
      options: { isDemo?: boolean } = {}
    ): void {
      const conn = new Database(path);
      conn.exec(`
        CREATE TABLE nodes (device_id TEXT PRIMARY KEY, ip_address TEXT, capabilities TEXT, last_seen TEXT);
        CREATE TABLE sensor_capabilities (device_id TEXT, metric_key TEXT, unit TEXT, PRIMARY KEY (device_id, metric_key));
        CREATE TABLE readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          device_id TEXT NOT NULL,
          metrics TEXT NOT NULL,
          ingested_at TEXT NOT NULL,
          is_fine_tuned INTEGER DEFAULT 0,
          UNIQUE(timestamp, device_id)
        );
      `);

      if (options.isDemo !== undefined) {
        conn.exec(`CREATE TABLE source_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        conn
          .prepare('INSERT INTO source_metadata (key, value) VALUES (?, ?)')
          .run('is_demo', options.isDemo ? 'true' : 'false');
      }

      conn
        .prepare("INSERT INTO sensor_capabilities VALUES ('esp32c6', 'temp', 'Cel')")
        .run();
      conn
        .prepare("INSERT INTO sensor_capabilities VALUES ('esp32c6', 'hum', '%RH')")
        .run();
      conn
        .prepare("INSERT INTO sensor_capabilities VALUES ('esp32s3', 'temperature', '°C')")
        .run();
      conn
        .prepare("INSERT INTO sensor_capabilities VALUES ('esp32s3', 'humidity', '%')")
        .run();

      const insertReading = conn.prepare(
        'INSERT INTO readings (timestamp, device_id, metrics, ingested_at, is_fine_tuned) VALUES (?, ?, ?, ?, ?)'
      );

      insertReading.run(
        '2026-10-05T08:00:00',
        'esp32c6',
        JSON.stringify({ temp: 22.4, hum: 55.1 }),
        '2026-10-05T08:00:05',
        0
      );
      insertReading.run(
        '2026-10-05T08:05:00',
        'esp32s3',
        JSON.stringify({ temperature: 23.1, humidity: 54.8 }),
        '2026-10-05T08:05:05',
        1
      );

      conn.close();
    }

    it('transforms source database to derived measurements.db with normalized timestamps and indexes', () => {
      const sourceDb = join(tempDir, 'source.db');
      const targetDb = join(tempDir, 'derived', 'measurements.db');
      createMockSourceDb(sourceDb, { isDemo: true });

      const summary = service.runEtl({
        sourceDbPath: sourceDb,
        targetDbPath: targetDb,
      });

      expect(summary.readingsProcessed).toBe(2);
      expect(summary.measurementsInserted).toBe(4);
      expect(summary.catalogEntries).toBe(2); // temperature and humidity
      expect(summary.devicesCount).toBe(2);
      expect(summary.isDemo).toBe(true);
      expect(summary.importedAt.endsWith('Z')).toBe(true);
      expect(existsSync(targetDb)).toBe(true);

      const targetConn = new Database(targetDb, { readonly: true });

      // Verify catalog
      const catalog = new Map(
        (targetConn.prepare('SELECT metric_key, unit FROM metrics_catalog').all() as {
          metric_key: string;
          unit: string;
        }[]).map((r) => [r.metric_key, r.unit])
      );
      expect(catalog.get('temperature')).toBe('°C');
      expect(catalog.get('humidity')).toBe('%');

      // Verify index
      const indexes = targetConn
        .prepare("PRAGMA index_list('measurements')")
        .all() as { name: string }[];
      expect(indexes.some((idx) => idx.name === 'idx_measurements_series')).toBe(true);

      // Verify measurements rows
      const rows = targetConn
        .prepare('SELECT ts, device_id, metric_key, value, sampling FROM measurements ORDER BY ts')
        .all() as {
        ts: string;
        device_id: string;
        metric_key: string;
        value: number;
        sampling: string;
      }[];

      expect(rows.length).toBe(4);
      const tempScheduled = rows.find(
        (r) => r.metric_key === 'temperature' && r.sampling === 'scheduled'
      );
      expect(tempScheduled).toBeDefined();
      expect(tempScheduled?.ts).toBe('2026-10-05T08:00:00Z');
      expect(tempScheduled?.value).toBe(22.4);

      const onDemandReading = rows.find((r) => r.sampling === 'on_demand');
      expect(onDemandReading).toBeDefined();
      expect(onDemandReading?.device_id).toBe('esp32s3');

      // Verify etl_metadata
      const metadata = new Map(
        (targetConn.prepare('SELECT key, value FROM etl_metadata').all() as {
          key: string;
          value: string;
        }[]).map((r) => [r.key, r.value])
      );
      expect(metadata.get('is_demo')).toBe('true');
      expect(metadata.get('reading_count')).toBe('2');
      expect(metadata.get('device_count')).toBe('2');

      targetConn.close();
    });

    it('rejects readings with undeclared metrics', () => {
      const sourceDb = join(tempDir, 'undeclared.db');
      const targetDb = join(tempDir, 'derived.db');

      const conn = new Database(sourceDb);
      conn.exec(`
        CREATE TABLE sensor_capabilities (device_id TEXT, metric_key TEXT, unit TEXT, PRIMARY KEY (device_id, metric_key));
        CREATE TABLE readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          device_id TEXT NOT NULL,
          metrics TEXT NOT NULL,
          ingested_at TEXT NOT NULL,
          is_fine_tuned INTEGER DEFAULT 0
        );
      `);
      conn.prepare("INSERT INTO sensor_capabilities VALUES ('esp1', 'temp', '°C')").run();
      conn
        .prepare(
          'INSERT INTO readings (timestamp, device_id, metrics, ingested_at, is_fine_tuned) VALUES (?, ?, ?, ?, ?)'
        )
        .run('2026-10-05T08:00:00', 'esp1', JSON.stringify({ temp: 22.0, light_level: 450 }), 'now', 0);
      conn.close();

      expect(() => service.runEtl({ sourceDbPath: sourceDb, targetDbPath: targetDb })).toThrow(
        /contains undeclared metric 'light_level'/
      );
    });

    it('identifies authentic non-demo source database', () => {
      const sourceDb = join(tempDir, 'authentic.db');
      const targetDb = join(tempDir, 'derived.db');
      createMockSourceDb(sourceDb); // no source_metadata table

      const summary = service.runEtl({ sourceDbPath: sourceDb, targetDbPath: targetDb });
      expect(summary.isDemo).toBe(false);

      const conn = new Database(targetDb, { readonly: true });
      const metadata = new Map(
        (conn.prepare('SELECT key, value FROM etl_metadata').all() as {
          key: string;
          value: string;
        }[]).map((r) => [r.key, r.value])
      );
      expect(metadata.get('is_demo')).toBe('false');
      conn.close();
    });

    it('supports explicit isDemo override', () => {
      const sourceDb = join(tempDir, 'demo_source.db');
      const targetDb = join(tempDir, 'derived.db');
      createMockSourceDb(sourceDb, { isDemo: true });

      const summary = service.runEtl({
        sourceDbPath: sourceDb,
        targetDbPath: targetDb,
        isDemo: false,
      });
      expect(summary.isDemo).toBe(false);

      const conn = new Database(targetDb, { readonly: true });
      const metadata = new Map(
        (conn.prepare('SELECT key, value FROM etl_metadata').all() as {
          key: string;
          value: string;
        }[]).map((r) => [r.key, r.value])
      );
      expect(metadata.get('is_demo')).toBe('false');
      conn.close();
    });
  });
});
