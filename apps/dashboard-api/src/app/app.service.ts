import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  MEASUREMENTS_REPOSITORY,
  MeasurementsRepository,
} from './database/measurements.repository.interface';
import { DatabaseStatusDto } from './database/database-status.dto';
import { EtlService, findRepoRoot } from './database/etl.service';
import { createWriteStream, mkdirSync } from 'fs';
import { resolve } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject(MEASUREMENTS_REPOSITORY)
    private readonly repo: MeasurementsRepository,
    @Inject(EtlService)
    private readonly etlService: EtlService
  ) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async getDatabaseStatus(): Promise<DatabaseStatusDto> {
    return await this.repo.getDatabaseStatus();
  }

  async importDatabase(
    fileStream: Readable,
    filename: string
  ): Promise<DatabaseStatusDto> {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (!ext || !['db', 'sqlite', 'sqlite3'].includes(ext)) {
      throw new BadRequestException(
        'Only .db, .sqlite, and .sqlite3 files are supported.'
      );
    }

    const repoRoot = findRepoRoot();
    const migrationsDir = resolve(repoRoot, 'data/migrations');
    mkdirSync(migrationsDir, { recursive: true });
    const targetSourcePath = resolve(migrationsDir, 'source.db');

    try {
      await pipeline(fileStream, createWriteStream(targetSourcePath));
    } catch (err: unknown) {
      throw new BadRequestException(
        `Failed to write uploaded database to disk: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    try {
      this.etlService.runEtl({
        sourceDbPath: targetSourcePath,
        isDemo: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`ETL transformation failed: ${msg}`);
      throw new BadRequestException(`Database validation/ETL failed: ${msg}`);
    }

    if (this.repo.reconnect) {
      this.repo.reconnect();
    }

    return await this.repo.getDatabaseStatus();
  }
}
