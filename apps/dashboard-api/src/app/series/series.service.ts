import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
} from '../database/measurements.repository.interface';
import {
  SeriesQueryDto,
  SeriesResponseDto,
  DeviceSeriesDto,
  SeriesPointDto,
  bucketToSeconds,
} from './dto/series-query.dto';

@Injectable()
export class SeriesService {
  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repository: MeasurementsRepository
  ) {}

  async getSeries(query: SeriesQueryDto): Promise<SeriesResponseDto> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from timestamp must be before or equal to to timestamp');
    }

    // Verify metric exists in the catalogue to get its unit
    const metrics = await this.repository.getMetrics();
    const metricEntry = metrics.find((m) => m.metric_key === query.metric);
    if (!metricEntry) {
      throw new BadRequestException(
        `Unknown metric: '${query.metric}'. Must be one of: ${metrics
          .map((m) => m.metric_key)
          .join(', ')}`
      );
    }

    const bucketSeconds = bucketToSeconds(query.bucket);

    const rows = await this.repository.getSeries({
      metric: query.metric,
      devices: query.devices,
      from: query.from,
      to: query.to,
      bucketSeconds,
      includeOnDemand: query.include_on_demand,
    });

    // Group points by device_id
    const deviceMap = new Map<string, SeriesPointDto[]>();

    if (query.devices && query.devices.length > 0) {
      for (const dev of query.devices) {
        deviceMap.set(dev, []);
      }
    }

    for (const row of rows) {
      let points = deviceMap.get(row.device_id);
      if (!points) {
        points = [];
        deviceMap.set(row.device_id, points);
      }
      points.push({
        ts: row.ts,
        value: row.value,
      });
    }

    const series: DeviceSeriesDto[] = Array.from(deviceMap.entries()).map(
      ([device_id, points]) => ({
        device_id,
        points,
      })
    );

    return {
      metric: query.metric,
      unit: metricEntry.unit,
      bucket: query.bucket || '5m',
      series,
    };
  }
}
