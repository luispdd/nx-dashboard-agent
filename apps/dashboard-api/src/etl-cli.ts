import { EtlService } from './app/database/etl.service';

const service = new EtlService();
console.log('Starting ETL migration...');
try {
  const summary = service.runEtl();
  console.log('ETL Migration Complete!');
  console.log(`  Is Demo:               ${summary.isDemo}`);
  console.log(`  Imported At:           ${summary.importedAt}`);
  console.log(`  Readings processed:    ${summary.readingsProcessed}`);
  console.log(`  Measurements inserted: ${summary.measurementsInserted}`);
  console.log(`  Catalog entries:       ${summary.catalogEntries}`);
  console.log(`  Devices represented:   ${summary.devicesCount}`);
  console.log(`  Derived Database:      ${summary.targetPath}`);
} catch (err) {
  console.error('ETL Migration Failed:', err);
  process.exit(1);
}
