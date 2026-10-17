import { Logger } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { EtlService, resolveDefaultPaths } from './etl.service';
import { SeedService } from './seed.service';
import { getDatabaseConfig } from './database.config';

export interface AutoBootstrapOptions {
  derivedDbPath?: string;
  sourceDbPath?: string;
  seedService?: SeedService;
  etlService?: EtlService;
}

export interface AutoBootstrapResult {
  bootstrapped: boolean;
  seeded: boolean;
  derivedDbPath: string;
}

export function autoBootstrapDatabase(
  options?: AutoBootstrapOptions
): AutoBootstrapResult {
  const config = getDatabaseConfig();
  const derivedDbPath = options?.derivedDbPath || config.dbPath;
  const defaultPaths = resolveDefaultPaths();
  const sourceDbPath = options?.sourceDbPath || defaultPaths.source;

  if (fs.existsSync(derivedDbPath)) {
    return {
      bootstrapped: false,
      seeded: false,
      derivedDbPath,
    };
  }

  const seed = options?.seedService || new SeedService();
  const etl = options?.etlService || new EtlService();

  let seeded = false;
  if (!fs.existsSync(sourceDbPath)) {
    Logger.log(
      `Derived database missing. Generating synthetic seed database at: ${sourceDbPath}`,
      'DatabaseModule'
    );
    fs.mkdirSync(path.dirname(sourceDbPath), { recursive: true });
    seed.generateSyntheticDatabase(sourceDbPath, {
      durationDays: 7,
      intervalMinutes: 5,
      isDemo: true,
    });
    seeded = true;
  }

  Logger.log(
    `Executing initial ETL pipeline to build: ${derivedDbPath}`,
    'DatabaseModule'
  );
  fs.mkdirSync(path.dirname(derivedDbPath), { recursive: true });
  etl.runEtl({
    sourceDbPath,
    targetDbPath: derivedDbPath,
    isDemo: true,
  });

  return {
    bootstrapped: true,
    seeded,
    derivedDbPath,
  };
}
