import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
} from '../database/measurements.repository.interface';
import { StatsQueryDto, StatsResponseDto, StatsItemDto } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repository: MeasurementsRepository
  ) {}

  async getStats(query: StatsQueryDto): Promise<StatsResponseDto> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from timestamp must be before or equal to to timestamp');
    }

    const metrics = await this.repository.getMetrics();
    const metricEntry = metrics.find((m) => m.metric_key === query.metric);
    if (!metricEntry) {
      throw new BadRequestException(
        `Unknown metric: '${query.metric}'. Must be one of: ${metrics
          .map((m) => m.metric_key)
          .join(', ')}`
      );
    }

    const rawStats = await this.repository.getStats({
      metric: query.metric,
      devices: query.devices,
      from: query.from,
      to: query.to,
      includeOnDemand: query.include_on_demand,
    });

    const stats: StatsItemDto[] = rawStats.map((r) => ({
      device_id: r.device_id,
      min: r.min,
      max: r.max,
      mean: r.mean,
      std: r.std,
      count: r.count,
      missing_ratio: r.missing_ratio,
    }));

    return {
      metric: query.metric,
      unit: metricEntry.unit,
      stats,
    };
  }
}
