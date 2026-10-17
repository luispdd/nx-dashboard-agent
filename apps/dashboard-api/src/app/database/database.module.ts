import { Global, Module } from '@nestjs/common';
import { MEASUREMENTS_REPOSITORY } from './measurements.repository.interface';
import { KyselyMeasurementsRepository } from './kysely-measurements.repository';
import { EtlService } from './etl.service';

@Global()
@Module({
  providers: [
    {
      provide: MEASUREMENTS_REPOSITORY,
      useClass: KyselyMeasurementsRepository,
    },
    KyselyMeasurementsRepository,
    EtlService,
  ],
  exports: [MEASUREMENTS_REPOSITORY, KyselyMeasurementsRepository, EtlService],
})
export class DatabaseModule {}
