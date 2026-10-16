import { Inject, Injectable } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
} from './database/measurements.repository.interface';
import { DatabaseStatusDto } from './database/database-status.dto';

@Injectable()
export class AppService {
  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repo: MeasurementsRepository
  ) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async getDatabaseStatus(): Promise<DatabaseStatusDto> {
    return await this.repo.getDatabaseStatus();
  }
}

