import { resolve } from 'path';
import { existsSync } from 'fs';

export interface DatabaseConfig {
  dbPath: string;
  readonly: boolean;
}

export function findWorkspaceRoot(): string {
  let current = process.cwd();
  while (current !== '/') {
    if (
      existsSync(resolve(current, 'nx.json')) ||
      existsSync(resolve(current, '.git'))
    ) {
      return current;
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

export function getDatabaseConfig(): DatabaseConfig {
  if (process.env.DERIVED_DB_PATH) {
    return {
      dbPath: resolve(process.cwd(), process.env.DERIVED_DB_PATH),
      readonly: true,
    };
  }

  const root = findWorkspaceRoot();
  const dbPath = resolve(root, 'data/derived/measurements.db');
  return {
    dbPath,
    readonly: true,
  };
}
