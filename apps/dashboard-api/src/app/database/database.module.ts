import { Global, Module } from '@nestjs/common';
import { MEASUREMENTS_REPOSITORY } from './measurements.repository.interface';
import { KyselyMeasurementsRepository } from './kysely-measurements.repository';
import { EtlService } from './etl.service';
import { SeedService } from './seed.service';

@Global()
@Module({
  providers: [
    {
      provide: MEASUREMENTS_REPOSITORY,
      useClass: KyselyMeasurementsRepository,
    },
    KyselyMeasurementsRepository,
    EtlService,
    SeedService,
  ],
  exports: [
    MEASUREMENTS_REPOSITORY,
    KyselyMeasurementsRepository,
    EtlService,
    SeedService,
  ],
})
export class DatabaseModule {}
