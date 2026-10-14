import { Injectable, Inject } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
  MetricCatalogItem,
} from '../database/measurements.repository.interface';

@Injectable()
export class MetricsService {
  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repository: MeasurementsRepository
  ) {}

  async getMetrics(): Promise<MetricCatalogItem[]> {
    return this.repository.getMetrics();
  }
}
