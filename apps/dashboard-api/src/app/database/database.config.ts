import { resolve } from 'path';
import { existsSync } from 'fs';

export interface DatabaseConfig {
  dbPath: string;
  readonly: boolean;
}

export function getDatabaseConfig(): DatabaseConfig {
  if (process.env.DERIVED_DB_PATH) {
    return {
      dbPath: resolve(process.cwd(), process.env.DERIVED_DB_PATH),
      readonly: true,
    };
  }

  // Walk up from current working directory to locate data/derived/measurements.db
  let currentDir = process.cwd();
  while (
    currentDir !== '/' &&
    !existsSync(resolve(currentDir, 'data/derived/measurements.db'))
  ) {
    const parent = resolve(currentDir, '..');
    if (parent === currentDir) break;
    currentDir = parent;
  }

  const dbPath = resolve(currentDir, 'data/derived/measurements.db');
  return {
    dbPath,
    readonly: true,
  };
}
