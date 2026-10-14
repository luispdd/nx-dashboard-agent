import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { DatabaseSchema } from './database.schema';
import {
  MeasurementsRepository,
  MetricCatalogItem,
  SeriesPointRow,
  SeriesQueryOptions,
  StatsQueryOptions,
  StatsRow,
} from './measurements.repository.interface';
import { getDatabaseConfig } from './database.config';

@Injectable()
export class KyselyMeasurementsRepository
  implements MeasurementsRepository, OnModuleDestroy
{
  private readonly db: Kysely<DatabaseSchema>;
  private readonly sqlite: Database.Database;

  constructor(@Optional() sqliteInstance?: Database.Database) {
    if (sqliteInstance) {
      this.sqlite = sqliteInstance;
    } else {
      const config = getDatabaseConfig();
      this.sqlite = new Database(config.dbPath, {
        readonly: config.readonly,
        fileMustExist: true,
      });
    }

    this.db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: this.sqlite,
      }),
    });
  }

  onModuleDestroy() {
    this.sqlite.close();
  }

  async getMetrics(): Promise<MetricCatalogItem[]> {
    return await this.db
      .selectFrom('metrics_catalog')
      .select(['metric_key', 'unit'])
      .orderBy('metric_key', 'asc')
      .execute();
  }

  async getDevices(): Promise<string[]> {
    const rows = await this.db
      .selectFrom('measurements')
      .select('device_id')
      .distinct()
      .orderBy('device_id', 'asc')
      .execute();

    return rows.map((r) => r.device_id);
  }

  async getSeries(options: SeriesQueryOptions): Promise<SeriesPointRow[]> {
    const bucketSeconds = options.bucketSeconds ?? 300; // default 5m

    let query = this.db
      .selectFrom('measurements')
      .where('metric_key', '=', options.metric);

    if (options.devices && options.devices.length > 0) {
      query = query.where('device_id', 'in', options.devices);
    }

    if (options.from) {
      query = query.where('ts', '>=', options.from);
    }

    if (options.to) {
      query = query.where('ts', '<=', options.to);
    }

    if (!options.includeOnDemand) {
      query = query.where('sampling', '=', 'scheduled');
    }

    // Downsampling with SQLite unixepoch integer math
    // replace(datetime((unixepoch(ts) / :bucketSeconds) * :bucketSeconds, 'unixepoch'), ' ', 'T') || 'Z'
    const bucketTsExpr = sql<string>`replace(datetime((unixepoch(ts) / ${sql.raw(
      bucketSeconds.toString()
    )}) * ${sql.raw(bucketSeconds.toString())}, 'unixepoch'), ' ', 'T') || 'Z'`;
    const avgValueExpr = sql<number>`round(avg(value), 2)`;

    if (options.limit && options.limit > 0) {
      const bucketedQuery = query
        .select([
          'device_id',
          bucketTsExpr.as('ts'),
          avgValueExpr.as('value'),
        ])
        .groupBy(['device_id', bucketTsExpr]);

      const rankedQuery = this.db
        .selectFrom(bucketedQuery.as('b'))
        .select([
          'device_id',
          'ts',
          'value',
          sql<number>`row_number() over (partition by device_id order by ts desc)`.as('rk'),
        ]);

      const rows = await this.db
        .selectFrom(rankedQuery.as('r'))
        .select(['device_id', 'ts', 'value'])
        .where('rk', '<=', options.limit)
        .orderBy('device_id', 'asc')
        .orderBy('ts', 'asc')
        .execute();

      return rows.map((r) => ({
        device_id: r.device_id,
        ts: r.ts,
        value: Number(r.value),
      }));
    }

    const rows = await query
      .select([
        'device_id',
        bucketTsExpr.as('ts'),
        avgValueExpr.as('value'),
      ])
      .groupBy(['device_id', bucketTsExpr])
      .orderBy('device_id', 'asc')
      .orderBy(bucketTsExpr, 'asc')
      .execute();

    return rows.map((r) => ({
      device_id: r.device_id,
      ts: r.ts,
      value: Number(r.value),
    }));
  }

  async getStats(options: StatsQueryOptions): Promise<StatsRow[]> {
    let query = this.db
      .selectFrom('measurements')
      .where('metric_key', '=', options.metric);

    if (options.devices && options.devices.length > 0) {
      query = query.where('device_id', 'in', options.devices);
    }

    if (options.from) {
      query = query.where('ts', '>=', options.from);
    }

    if (options.to) {
      query = query.where('ts', '<=', options.to);
    }

    if (!options.includeOnDemand) {
      query = query.where('sampling', '=', 'scheduled');
    }

    // SQLite standard deviation via variance formula:
    // SQRT((SUM(value * value) - (SUM(value) * SUM(value)) / COUNT(value)) / (COUNT(value) - 1))
    const stdExpr = sql<number | null>`
      CASE 
        WHEN count(value) > 1 THEN
          round(sqrt((sum(value * value) - (sum(value) * sum(value)) / count(value)) / (count(value) - 1)), 2)
        ELSE 0.0
      END
    `;

    const rawStats = await query
      .select([
        'device_id',
        sql<number | null>`round(min(value), 2)`.as('min'),
        sql<number | null>`round(max(value), 2)`.as('max'),
        sql<number | null>`round(avg(value), 2)`.as('mean'),
        stdExpr.as('std'),
        sql<number>`count(value)`.as('count'),
      ])
      .groupBy('device_id')
      .orderBy('device_id', 'asc')
      .execute();

    // Calculate expected reading count based on 5-minute cadence
    let expectedCount = 1;
    if (options.from && options.to) {
      const fromMs = new Date(options.from).getTime();
      const toMs = new Date(options.to).getTime();
      if (!isNaN(fromMs) && !isNaN(toMs) && toMs > fromMs) {
        expectedCount = Math.max(1, Math.floor((toMs - fromMs) / (300 * 1000)));
      }
    }

    const statsMap = new Map<string, StatsRow>();
    for (const r of rawStats) {
      const count = Number(r.count);
      const missingRatio =
        count === 0
          ? 1.0
          : Math.max(0, Math.min(1.0, Number((1 - count / expectedCount).toFixed(4))));

      statsMap.set(r.device_id, {
        device_id: r.device_id,
        min: r.min !== null ? Number(r.min) : null,
        max: r.max !== null ? Number(r.max) : null,
        mean: r.mean !== null ? Number(r.mean) : null,
        std: r.std !== null ? Number(r.std) : null,
        count,
        missing_ratio: missingRatio,
      });
    }

    // Ensure all requested devices are present in result even if 0 readings found
    const targetDevices =
      options.devices && options.devices.length > 0
        ? options.devices
        : Array.from(statsMap.keys());

    const result: StatsRow[] = [];
    for (const dev of targetDevices) {
      const existing = statsMap.get(dev);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          device_id: dev,
          min: null,
          max: null,
          mean: null,
          std: null,
          count: 0,
          missing_ratio: 1.0,
        });
      }
    }

    return result;
  }
}
