import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { DevicesModule } from './devices/devices.module';
import { MetricsController } from './metrics/metrics.controller';
import { DevicesController } from './devices/devices.controller';

describe('Metrics & Devices Integration (against derived DB)', () => {
  let module: TestingModule;
  let metricsController: MetricsController;
  let devicesController: DevicesController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, MetricsModule, DevicesModule],
    }).compile();

    metricsController = module.get<MetricsController>(MetricsController);
    devicesController = module.get<DevicesController>(DevicesController);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should return catalog metrics from derived DB', async () => {
    const metrics = await metricsController.getMetrics();
    expect(metrics.length).toBeGreaterThanOrEqual(3);
    const keys = metrics.map((m) => m.metric_key);
    expect(keys).toContain('temperature');
    expect(keys).toContain('humidity');
    expect(keys).toContain('pressure');
  });

  it('should return distinct device IDs from derived DB', async () => {
    const devices = await devicesController.getDevices();
    expect(devices.length).toBeGreaterThanOrEqual(3);
    expect(devices).toContain('esp32c6');
    expect(devices).toContain('esp32node1');
    expect(devices).toContain('esp32s3');
  });
});
