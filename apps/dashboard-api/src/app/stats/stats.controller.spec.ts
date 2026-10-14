import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { MEASUREMENTS_REPOSITORY } from '../database/measurements.repository.interface';

describe('StatsController', () => {
  let controller: StatsController;

  const mockRepo = {
    getMetrics: vi.fn().mockResolvedValue([
      { metric_key: 'temperature', unit: '°C' },
    ]),
    getStats: vi.fn().mockResolvedValue([
      {
        device_id: 'esp32c6',
        min: 14.5,
        max: 28.2,
        mean: 21.3,
        std: 2.15,
        count: 288,
        missing_ratio: 0.0,
      },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        StatsService,
        {
          provide: MEASUREMENTS_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  it('should return statistical summaries', async () => {
    const res = await controller.getStats({ metric: 'temperature' });
    expect(res.metric).toBe('temperature');
    expect(res.unit).toBe('°C');
    expect(res.stats).toHaveLength(1);
    expect(res.stats[0].device_id).toBe('esp32c6');
    expect(res.stats[0].count).toBe(288);
  });
});
