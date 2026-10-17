import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AnomalySpec {
  anomalyType: 'peer_deviation' | 'spike' | 'flatline' | 'gap';
  deviceId: string;
  metricKey: string;
  startOffsetMinutes: number;
  durationMinutes: number;
  magnitude?: number;
}

export interface SeedGeneratorConfig {
  devices?: string[];
  metricCapabilities?: Record<string, string>;
  durationDays?: number;
  intervalMinutes?: number;
  onDemandRate?: number;
  anomalies?: AnomalySpec[];
  startTime?: Date;
  isDemo?: boolean;
}

export interface SeedSummary {
  nodes: number;
  sensorCapabilities: number;
  readings: number;
}

export class SeededRandom {
  private s: number;

  constructor(seed = 42) {
    this.s = seed >>> 0;
  }

  // Mulberry32 32-bit PRNG
  random(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randint(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  // Box-Muller transform for Gaussian distribution
  gauss(mean = 0, std = 1): number {
    let u1 = this.random();
    const u2 = this.random();
    while (u1 === 0) u1 = this.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * std;
  }
}

export function formatUtcNaive(d: Date): string {
  return d.toISOString().slice(0, 19);
}

@Injectable()
export class SeedService {
  generateSyntheticDatabase(
    targetPath: string,
    config?: SeedGeneratorConfig,
    seed = 42
  ): SeedSummary {
    const devices = config?.devices ?? ['esp32c6', 'esp32s3', 'esp32node1'];
    const metricCapabilities = config?.metricCapabilities ?? {
      temperature: '°C',
      humidity: '%',
      pressure: 'hPa',
    };
    const durationDays = config?.durationDays ?? 3;
    const intervalMinutes = config?.intervalMinutes ?? 5;
    const onDemandRate = config?.onDemandRate ?? 0.03;
    const anomalies = config?.anomalies ?? [];
    const startTime =
      config?.startTime ?? new Date(Date.UTC(2026, 9, 5, 0, 0, 0)); // 2026-10-05T00:00:00Z
    const isDemo = config?.isDemo ?? true;

    const rng = new SeededRandom(seed);

    mkdirSync(dirname(targetPath), { recursive: true });
    if (existsSync(targetPath)) {
      rmSync(targetPath);
    }

    const db = new Database(targetPath);

    try {
      // 1. Schema setup
      db.exec(`
        CREATE TABLE IF NOT EXISTS source_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nodes (
            device_id TEXT PRIMARY KEY,
            ip_address TEXT,
            capabilities TEXT,
            last_seen TEXT
        );
        CREATE TABLE IF NOT EXISTS sensor_capabilities (
            device_id TEXT,
            metric_key TEXT,
            unit TEXT,
            PRIMARY KEY (device_id, metric_key)
        );
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL,
            metrics TEXT NOT NULL,
            ingested_at TEXT NOT NULL,
            is_fine_tuned INTEGER DEFAULT 0,
            UNIQUE(timestamp, device_id)
        );
        CREATE TABLE IF NOT EXISTS sync_state (
            logger_id TEXT PRIMARY KEY,
            last_cursor INTEGER,
            last_synced_at TEXT
        );
      `);

      // 2. Insert metadata
      const insertMeta = db.prepare(
        'INSERT INTO source_metadata (key, value) VALUES (?, ?)'
      );
      insertMeta.run('is_demo', isDemo ? 'true' : 'false');

      // 3. Populate nodes and capabilities
      const insertNode = db.prepare(
        'INSERT INTO nodes (device_id, ip_address, capabilities, last_seen) VALUES (?, ?, ?, ?)'
      );
      const insertCap = db.prepare(
        'INSERT INTO sensor_capabilities (device_id, metric_key, unit) VALUES (?, ?, ?)'
      );

      const capabilitiesJson = JSON.stringify(Object.keys(metricCapabilities));
      const lastSeenStr = formatUtcNaive(startTime);

      for (const devId of devices) {
        insertNode.run(
          devId,
          `192.168.1.${rng.randint(10, 200)}`,
          capabilitiesJson,
          lastSeenStr
        );
        for (const [mKey, unit] of Object.entries(metricCapabilities)) {
          insertCap.run(devId, mKey, unit);
        }
      }

      // 4. Generate time series readings
      const totalIntervals = Math.floor(
        (durationDays * 24 * 60) / intervalMinutes
      );
      const insertReading = db.prepare(`
        INSERT OR IGNORE INTO readings (timestamp, device_id, metrics, ingested_at, is_fine_tuned)
        VALUES (?, ?, ?, ?, ?)
      `);

      const flatlineValues = new Map<string, number>();

      const insertBatch = db.transaction(() => {
        let count = 0;
        for (let step = 0; step < totalIntervals; step++) {
          const currentTime = new Date(
            startTime.getTime() + step * intervalMinutes * 60000
          );
          const tsStr = formatUtcNaive(currentTime);
          const minutesFromStart = step * intervalMinutes;

          const timeOfDaySeconds =
            currentTime.getUTCHours() * 3600 +
            currentTime.getUTCMinutes() * 60 +
            currentTime.getUTCSeconds();

          // Base diurnal cycle: sinusoidal variation over 24h
          const diurnalRad = 2 * Math.PI * (timeOfDaySeconds / 86400.0);
          const baseTemp =
            20.0 + 5.0 * Math.sin(diurnalRad - Math.PI / 2); // Peak in afternoon
          const baseHumidity =
            55.0 - 15.0 * Math.sin(diurnalRad - Math.PI / 2); // Inverted with temp
          const basePressure = 1013.25 + 2.0 * Math.cos(diurnalRad);

          for (const devId of devices) {
            // Gap anomaly check
            const isGap = anomalies.some(
              (a) =>
                a.anomalyType === 'gap' &&
                a.deviceId === devId &&
                a.startOffsetMinutes <= minutesFromStart &&
                minutesFromStart < a.startOffsetMinutes + a.durationMinutes
            );
            if (isGap) {
              continue;
            }

            // Device-specific slight natural offset
            let devHash = 0;
            for (let i = 0; i < devId.length; i++) {
              devHash += devId.charCodeAt(i);
            }
            const devOffset = ((devHash % 5) - 2) * 0.4;

            let tempVal = Math.round((baseTemp + devOffset + rng.gauss(0, 0.3)) * 100) / 100;
            let humVal = Math.round((baseHumidity - devOffset + rng.gauss(0, 0.5)) * 100) / 100;
            const pressVal = Math.round((basePressure + rng.gauss(0, 0.2)) * 100) / 100;

            // Apply anomalies
            for (const anom of anomalies) {
              if (
                anom.deviceId === devId &&
                anom.startOffsetMinutes <= minutesFromStart &&
                minutesFromStart < anom.startOffsetMinutes + anom.durationMinutes
              ) {
                const mag = anom.magnitude ?? 0.0;
                if (anom.anomalyType === 'peer_deviation') {
                  if (anom.metricKey === 'temperature') {
                    tempVal = Math.round((tempVal + mag) * 100) / 100;
                  } else if (anom.metricKey === 'humidity') {
                    humVal = Math.round((humVal + mag) * 100) / 100;
                  }
                } else if (anom.anomalyType === 'spike') {
                  if (minutesFromStart === anom.startOffsetMinutes) {
                    if (anom.metricKey === 'temperature') {
                      tempVal = Math.round((tempVal + mag) * 100) / 100;
                    } else if (anom.metricKey === 'humidity') {
                      humVal = Math.round((humVal + mag) * 100) / 100;
                    }
                  }
                } else if (anom.anomalyType === 'flatline') {
                  const fKey = `${anom.deviceId}:${anom.metricKey}`;
                  if (!flatlineValues.has(fKey)) {
                    flatlineValues.set(
                      fKey,
                      anom.metricKey === 'temperature' ? tempVal : humVal
                    );
                  }
                  const fallbackVal =
                    anom.metricKey === 'temperature' ? tempVal : humVal;
                  const stuckVal = flatlineValues.get(fKey) ?? fallbackVal;
                  if (anom.metricKey === 'temperature') {
                    tempVal = stuckVal;
                  } else if (anom.metricKey === 'humidity') {
                    humVal = stuckVal;
                  }
                }
              }
            }

            const metricsDict: Record<string, number> = {
              temperature: tempVal,
              humidity: humVal,
              pressure: pressVal,
            };

            const ingestedTime = new Date(
              currentTime.getTime() + rng.randint(1, 15) * 1000
            );
            const ingestedAt = formatUtcNaive(ingestedTime);

            insertReading.run(
              tsStr,
              devId,
              JSON.stringify(metricsDict),
              ingestedAt,
              0
            );
            count++;

            // Occasional on-demand reading
            if (rng.random() < onDemandRate) {
              const odTime = new Date(
                currentTime.getTime() + rng.randint(30, 90) * 1000
              );
              const odTsStr = formatUtcNaive(odTime);
              const odMetrics: Record<string, number> = {
                temperature:
                  Math.round((tempVal + rng.gauss(0, 0.1)) * 100) / 100,
                humidity: Math.round((humVal + rng.gauss(0, 0.2)) * 100) / 100,
                pressure: pressVal,
              };

              insertReading.run(
                odTsStr,
                devId,
                JSON.stringify(odMetrics),
                odTsStr,
                1
              );
              count++;
            }
          }
        }
        return count;
      });

      const totalReadings = insertBatch();

      // 5. Populate sync_state
      const insertSync = db.prepare(
        'INSERT INTO sync_state (logger_id, last_cursor, last_synced_at) VALUES (?, ?, ?)'
      );
      insertSync.run('main_syncer', totalReadings, lastSeenStr);

      const nodeCount = (
        db.prepare('SELECT count(*) as count FROM nodes').get() as {
          count: number;
        }
      ).count;
      const capCount = (
        db.prepare('SELECT count(*) as count FROM sensor_capabilities').get() as {
          count: number;
        }
      ).count;
      const readCount = (
        db.prepare('SELECT count(*) as count FROM readings').get() as {
          count: number;
        }
      ).count;

      return {
        nodes: nodeCount,
        sensorCapabilities: capCount,
        readings: readCount,
      };
    } finally {
      db.close();
    }
  }
}
