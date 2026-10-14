import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MEASUREMENTS_REPOSITORY } from '../database/measurements.repository.interface';

describe('DevicesController', () => {
  let controller: DevicesController;

  const mockRepo = {
    getDevices: vi
      .fn()
      .mockResolvedValue(['esp32c6', 'esp32node1', 'esp32s3']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        DevicesService,
        {
          provide: MEASUREMENTS_REPOSITORY,
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('should return distinct sorted device IDs', async () => {
    const result = await controller.getDevices();
    expect(result).toEqual(['esp32c6', 'esp32node1', 'esp32s3']);
  });
});
