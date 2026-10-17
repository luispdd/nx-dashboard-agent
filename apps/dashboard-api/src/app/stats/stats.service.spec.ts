import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { IMeasurementsRepository } from '../database/measurements.repository.interface';

describe('StatsService', () => {
  let service: StatsService;

  const mockRepo = {
    getMetrics: vi.fn().mockResolvedValue([
      { metric_key: 'temperature', unit: '°C' },
    ]),
    getStats: vi.fn().mockResolvedValue([
      {
        device_id: 'esp32c6',
        min: 15.2,
        max: 27.8,
        mean: 21.5,
        std: 2.14,
        count: 288,
        missing_ratio: 0.0,
      },
      {
        device_id: 'empty_device',
        min: null,
        max: null,
        mean: null,
        std: null,
        count: 0,
        missing_ratio: 1.0,
      },
    ]),
  };

  beforeEach(() => {
    service = new StatsService(mockRepo as unknown as IMeasurementsRepository);
  });

  it('should return stats with unit and device breakdown', async () => {
    const res = await service.getStats({ metric: 'temperature' });
    expect(res.metric).toBe('temperature');
    expect(res.unit).toBe('°C');
    expect(res.stats).toHaveLength(2);
    expect(res.stats[0].device_id).toBe('esp32c6');
    expect(res.stats[0].count).toBe(288);
    expect(res.stats[0].mean).toBe(21.5);
  });

  it('should handle zero-reading devices with null values and 1.0 missing_ratio', async () => {
    const res = await service.getStats({ metric: 'temperature' });
    const empty = res.stats.find((s) => s.device_id === 'empty_device');
    expect(empty).toBeDefined();
    expect(empty?.count).toBe(0);
    expect(empty?.min).toBeNull();
    expect(empty?.max).toBeNull();
    expect(empty?.mean).toBeNull();
    expect(empty?.std).toBeNull();
    expect(empty?.missing_ratio).toBe(1.0);
  });

  it('should throw BadRequestException if metric is unknown', async () => {
    await expect(service.getStats({ metric: 'nonexistent' })).rejects.toThrow(
      BadRequestException
    );
  });

  it('should throw BadRequestException if from > to', async () => {
    await expect(
      service.getStats({
        metric: 'temperature',
        from: '2026-10-06T00:00:00Z',
        to: '2026-10-05T00:00:00Z',
      })
    ).rejects.toThrow(BadRequestException);
  });
});
