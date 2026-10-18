import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

function getFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('MCP Architectural Boundary Enforcer', () => {
  const mcpDir = resolve(__dirname);
  const mcpFiles = getFilesRecursively(mcpDir);

  it('scans at least 5 MCP source files', () => {
    expect(mcpFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of mcpFiles) {
    const relativeName = file.replace(mcpDir, '');

    it(`file ${relativeName} has no forbidden database or Kysely imports`, () => {
      const content = readFileSync(file, 'utf-8');

      // Assert forbidden packages
      expect(content).not.toMatch(/from\s+['"]kysely['"]/);
      expect(content).not.toMatch(/from\s+['"]better-sqlite3['"]/);

      // Assert forbidden database directory imports
      expect(content).not.toMatch(/from\s+['"].*\/database\/.*/);

      // Assert no raw repository or db connection tokens
      expect(content).not.toContain('MEASUREMENTS_REPOSITORY');
      expect(content).not.toContain('KyselyMeasurementsRepository');
    });
  }
});
