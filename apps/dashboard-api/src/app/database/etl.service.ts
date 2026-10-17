import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';

export interface ETLSummary {
  sourcePath: string;
  targetPath: string;
  readingsProcessed: number;
  measurementsInserted: number;
  catalogEntries: number;
  devicesCount: number;
  isDemo: boolean;
  importedAt: string;
}

export interface RunEtlOptions {
  sourceDbPath?: string;
  targetDbPath?: string;
  isDemo?: boolean;
}

export const UNIT_NORMALIZATIONS: Record<string, string> = {
  '%RH': '%',
  Cel: '°C',
};

export const METRIC_KEY_NORMALIZATIONS: Record<string, string> = {
  temp: 'temperature',
  hum: 'humidity',
};

export function findRepoRoot(): string {
  let current = process.cwd();
  while (
    current !== '/' &&
    !existsSync(resolve(current, 'nx.json')) &&
    !existsSync(resolve(current, '.git'))
  ) {
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return current;
}

export function resolveDefaultPaths(): { source: string; derived: string } {
  const root = findRepoRoot();
  return {
    source: resolve(root, 'data/migrations/source.db'),
    derived: resolve(root, 'data/derived/measurements.db'),
  };
}

export function validateAndNormalizeTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'string') {
    throw new Error(`Invalid timestamp value: ${JSON.stringify(ts)}`);
  }

  const cleaned = ts.trim();
  const base = cleaned.endsWith('Z') ? cleaned.slice(0, -1) : cleaned;

  // Basic ISO-8601 UTC regex check: YYYY-MM-DDTHH:MM:SS(.sss)?
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  if (!isoRegex.test(base)) {
    throw new Error(`Malformed ISO-8601 timestamp string: '${ts}'`);
  }

  const d = new Date(`${base}Z`);
  if (isNaN(d.getTime())) {
    throw new Error(`Malformed ISO-8601 timestamp string: '${ts}'`);
  }

  return `${base}Z`;
}

export function mapSampling(isFineTuned: unknown): 'scheduled' | 'on_demand' {
  if (
    isFineTuned === 1 ||
    isFineTuned === true ||
    isFineTuned === '1' ||
    isFineTuned === 'true'
  ) {
    return 'on_demand';
  }
  return 'scheduled';
}

export function buildCatalogAndValidateUnits(
  sourceDb: Database.Database
): Map<string, string> {
  const tableCheck = sourceDb
    .prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='sensor_capabilities'"
    )
    .get() as { count: number };

  if (!tableCheck || tableCheck.count === 0) {
    throw new Error('Missing required table: sensor_capabilities');
  }

  const rows = sourceDb
    .prepare(
      'SELECT device_id, metric_key, unit FROM sensor_capabilities ORDER BY metric_key'
    )
    .all() as { device_id: string; metric_key: string; unit: string }[];

  const catalog = new Map<string, string>();

  for (const { device_id, metric_key, unit } of rows) {
    if (!metric_key || !unit) continue;
    const mKeyRaw = metric_key.trim();
    const unitRaw = unit.trim();
    const mKey = METRIC_KEY_NORMALIZATIONS[mKeyRaw] || mKeyRaw;
    const normUnit = UNIT_NORMALIZATIONS[unitRaw] || unitRaw;

    if (catalog.has(mKey) && catalog.get(mKey) !== normUnit) {
      throw new Error(
        `Conflicting unit for metric '${mKey}': device '${device_id}' reports '${normUnit}' while another device reports '${catalog.get(
          mKey
        )}'.`
      );
    }
    catalog.set(mKey, normUnit);
  }

  return catalog;
}

export function createDerivedSchema(destDb: Database.Database): void {
  destDb.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS metrics_catalog (
      metric_key TEXT PRIMARY KEY,
      unit TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS etl_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS measurements (
      ts TEXT NOT NULL,
      device_id TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      value REAL,
      sampling TEXT NOT NULL CHECK (sampling IN ('scheduled', 'on_demand')),
      PRIMARY KEY (ts, device_id, metric_key),
      FOREIGN KEY (metric_key) REFERENCES metrics_catalog(metric_key)
    );
  `);
}

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  runEtl(options?: RunEtlOptions): ETLSummary {
    const defaults = resolveDefaultPaths();
    const sourcePath = resolve(options?.sourceDbPath || defaults.source);
    const targetPath = resolve(options?.targetDbPath || defaults.derived);
    let isDemo = options?.isDemo;

    if (!existsSync(sourcePath)) {
      throw new Error(`Source database not found at ${sourcePath}`);
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    const tempTargetPath = `${targetPath}.tmp.${process.pid}_${Date.now()}`;

    if (existsSync(tempTargetPath)) {
      try {
        unlinkSync(tempTargetPath);
      } catch {
        // ignore
      }
    }

    const sourceDb = new Database(sourcePath, {
      readonly: true,
      fileMustExist: true,
    });
    const destDb = new Database(tempTargetPath);

    try {
      if (isDemo === undefined) {
        try {
          const row = sourceDb
            .prepare(
              "SELECT value FROM source_metadata WHERE key = 'is_demo'"
            )
            .get() as { value: string } | undefined;
          isDemo =
            !!row &&
            ['true', '1'].includes(String(row.value).trim().toLowerCase());
        } catch {
          isDemo = false;
        }
      }

      destDb.pragma('foreign_keys = ON');
      createDerivedSchema(destDb);

      const catalog = buildCatalogAndValidateUnits(sourceDb);
      const insertCatalog = destDb.prepare(
        'INSERT INTO metrics_catalog (metric_key, unit) VALUES (?, ?)'
      );
      const insertCatalogTx = destDb.transaction((entries: [string, string][]) => {
        for (const [k, v] of entries) {
          insertCatalog.run(k, v);
        }
      });
      insertCatalogTx(Array.from(catalog.entries()));

      const readingsTableCheck = sourceDb
        .prepare(
          "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='readings'"
        )
        .get() as { count: number };

      if (!readingsTableCheck || readingsTableCheck.count === 0) {
        throw new Error('Missing required table: readings');
      }

      const readings = sourceDb
        .prepare(
          'SELECT timestamp, device_id, metrics, is_fine_tuned FROM readings ORDER BY timestamp'
        )
        .all() as {
        timestamp: string;
        device_id: string;
        metrics: string | Record<string, unknown>;
        is_fine_tuned: unknown;
      }[];

      const insertMeasurement = destDb.prepare(`
        INSERT OR REPLACE INTO measurements (ts, device_id, metric_key, value, sampling)
        VALUES (?, ?, ?, ?, ?)
      `);

      let readingsCount = 0;
      let measurementsCount = 0;
      const devicesSeen = new Set<string>();

      const insertAllMeasurements = destDb.transaction(
        (
          rows: {
            timestamp: string;
            device_id: string;
            metrics: string | Record<string, unknown>;
            is_fine_tuned: unknown;
          }[]
        ) => {
          for (const row of rows) {
            readingsCount++;
            devicesSeen.add(row.device_id);
            const tsNorm = validateAndNormalizeTimestamp(row.timestamp);
            const sampling = mapSampling(row.is_fine_tuned);

            let metricsDict: Record<string, unknown>;
            try {
              metricsDict =
                typeof row.metrics === 'string'
                  ? JSON.parse(row.metrics)
                  : row.metrics;
            } catch (err: unknown) {
              throw new Error(
                `Malformed JSON in reading id at ${row.timestamp}: ${row.metrics}`
              );
            }

            for (const [mKeyRaw, val] of Object.entries(metricsDict)) {
              const normMKey =
                METRIC_KEY_NORMALIZATIONS[mKeyRaw.trim()] || mKeyRaw.trim();
              if (!catalog.has(normMKey)) {
                throw new Error(
                  `Reading at ${row.timestamp} for device '${row.device_id}' contains undeclared metric '${mKeyRaw}'`
                );
              }

              const numVal =
                val !== null && val !== undefined ? Number(val) : null;
              insertMeasurement.run(
                tsNorm,
                row.device_id,
                normMKey,
                numVal,
                sampling
              );
              measurementsCount++;
            }
          }
        }
      );

      insertAllMeasurements(readings);

      destDb.exec(
        'CREATE INDEX IF NOT EXISTS idx_measurements_series ON measurements (device_id, metric_key, ts)'
      );

      const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      const metadataRecords: [string, string][] = [
        ['is_demo', isDemo ? 'true' : 'false'],
        ['imported_at', nowIso],
        ['reading_count', readingsCount.toString()],
        ['measurement_count', measurementsCount.toString()],
        ['device_count', devicesSeen.size.toString()],
      ];

      const insertMeta = destDb.prepare(
        'INSERT OR REPLACE INTO etl_metadata (key, value) VALUES (?, ?)'
      );
      for (const [k, v] of metadataRecords) {
        insertMeta.run(k, v);
      }

      sourceDb.close();
      destDb.close();

      renameSync(tempTargetPath, targetPath);

      this.logger.log(`ETL migration successfully completed to ${targetPath}`);

      return {
        sourcePath,
        targetPath,
        readingsProcessed: readingsCount,
        measurementsInserted: measurementsCount,
        catalogEntries: catalog.size,
        devicesCount: devicesSeen.size,
        isDemo: !!isDemo,
        importedAt: nowIso,
      };
    } catch (err) {
      try {
        sourceDb.close();
      } catch {
        // ignore
      }
      try {
        destDb.close();
      } catch {
        // ignore
      }
      if (existsSync(tempTargetPath)) {
        try {
          unlinkSync(tempTargetPath);
        } catch {
          // ignore
        }
      }
      throw err;
    }
  }
}
