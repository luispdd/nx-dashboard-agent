import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { MEASUREMENTS_REPOSITORY } from '../database/measurements.repository.interface';

describe('SeriesController', () => {
  let controller: SeriesController;

  const mockRepo = {
    getMetrics: vi.fn().mockResolvedValue([
      { metric_key: 'temperature', unit: '°C' },
    ]),
    getSeries: vi.fn().mockResolvedValue([
      { device_id: 'esp32c6', ts: '2026-10-05T08:00:00Z', value: 21.4 },
      { device_id: 'esp32s3', ts: '2026-10-05T08:00:00Z', value: 22.1 },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeriesController],
      providers: [
        SeriesService,
        {
          provide: MEASUREMENTS_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get<SeriesController>(SeriesController);
  });

  it('should return grouped multi-device series', async () => {
    const res = await controller.getSeries({
      metric: 'temperature',
      devices: ['esp32c6', 'esp32s3'],
      bucket: '5m',
    });

    expect(res.metric).toBe('temperature');
    expect(res.unit).toBe('°C');
    expect(res.bucket).toBe('5m');
    expect(res.series).toHaveLength(2);
    expect(res.series[0].device_id).toBe('esp32c6');
    expect(res.series[0].points).toHaveLength(1);
    expect(res.series[0].points[0]).toEqual({
      ts: '2026-10-05T08:00:00Z',
      value: 21.4,
    });
  });

  it('should throw BadRequestException if metric is not in catalogue', async () => {
    await expect(
      controller.getSeries({ metric: 'unknown_metric' })
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if from > to', async () => {
    await expect(
      controller.getSeries({
        metric: 'temperature',
        from: '2026-10-06T00:00:00Z',
        to: '2026-10-05T00:00:00Z',
      })
    ).rejects.toThrow(BadRequestException);
  });
});
