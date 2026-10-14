import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MEASUREMENTS_REPOSITORY } from '../database/measurements.repository.interface';

describe('MetricsController', () => {
  let controller: MetricsController;

  const mockRepo = {
    getMetrics: vi.fn().mockResolvedValue([
      { metric_key: 'humidity', unit: '%' },
      { metric_key: 'pressure', unit: 'hPa' },
      { metric_key: 'temperature', unit: '°C' },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsService,
        {
          provide: MEASUREMENTS_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('should return metrics catalogue from service', async () => {
    const result = await controller.getMetrics();
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ metric_key: 'humidity', unit: '%' });
    expect(result[2]).toEqual({ metric_key: 'temperature', unit: '°C' });
  });
});
