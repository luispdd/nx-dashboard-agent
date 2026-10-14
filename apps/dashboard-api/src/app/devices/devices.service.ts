import { Injectable, Inject } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
} from '../database/measurements.repository.interface';

@Injectable()
export class DevicesService {
  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repository: MeasurementsRepository
  ) {}

  async getDevices(): Promise<string[]> {
    return this.repository.getDevices();
  }
}
