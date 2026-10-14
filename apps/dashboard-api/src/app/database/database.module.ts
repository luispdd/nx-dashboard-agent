import { Global, Module } from '@nestjs/common';
import { MEASUREMENTS_REPOSITORY } from './measurements.repository.interface';
import { KyselyMeasurementsRepository } from './kysely-measurements.repository';

@Global()
@Module({
  providers: [
    {
      provide: MEASUREMENTS_REPOSITORY,
      useClass: KyselyMeasurementsRepository,
    },
    KyselyMeasurementsRepository,
  ],
  exports: [MEASUREMENTS_REPOSITORY, KyselyMeasurementsRepository],
})
export class DatabaseModule {}
