import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { autoBootstrapDatabase } from './database.module';
import { SeedService } from './seed.service';
import { EtlService } from './etl.service';
import fs from 'node:fs';

describe('autoBootstrapDatabase', () => {
  let mockSeedService: SeedService;
  let mockEtlService: EtlService;
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let mkdirSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);

    mockSeedService = {
      generateSyntheticDatabase: vi.fn().mockReturnValue({
        nodes: 3,
        sensorCapabilities: 3,
        readings: 100,
      }),
    } as unknown as SeedService;

    mockEtlService = {
      runEtl: vi.fn().mockReturnValue({
        sourcePath: '/tmp/source.db',
        targetPath: '/tmp/derived.db',
        readingsProcessed: 100,
        measurementsInserted: 300,
        catalogEntries: 3,
        devicesCount: 3,
        isDemo: true,
        importedAt: '2026-10-17T00:00:00Z',
      }),
    } as unknown as EtlService;
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    mkdirSyncSpy.mockRestore();
  });

  it('bypasses bootstrapping when derived database already exists', () => {
    existsSyncSpy.mockImplementation((p) => {
      return String(p) === '/custom/derived.db';
    });

    const result = autoBootstrapDatabase({
      derivedDbPath: '/custom/derived.db',
      sourceDbPath: '/custom/source.db',
      seedService: mockSeedService,
      etlService: mockEtlService,
    });

    expect(result.bootstrapped).toBe(false);
    expect(result.seeded).toBe(false);
    expect(mockSeedService.generateSyntheticDatabase).not.toHaveBeenCalled();
    expect(mockEtlService.runEtl).not.toHaveBeenCalled();
    expect(mkdirSyncSpy).not.toHaveBeenCalled();
  });

  it('generates seed and runs ETL when both derived and source databases are missing', () => {
    existsSyncSpy.mockReturnValue(false);

    const result = autoBootstrapDatabase({
      derivedDbPath: '/custom/derived.db',
      sourceDbPath: '/custom/source.db',
      seedService: mockSeedService,
      etlService: mockEtlService,
    });

    expect(result.bootstrapped).toBe(true);
    expect(result.seeded).toBe(true);
    expect(mkdirSyncSpy).toHaveBeenCalled();
    expect(mockSeedService.generateSyntheticDatabase).toHaveBeenCalledWith(
      '/custom/source.db',
      expect.objectContaining({
        durationDays: 7,
        intervalMinutes: 5,
        isDemo: true,
      })
    );
    expect(mockEtlService.runEtl).toHaveBeenCalledWith({
      sourceDbPath: '/custom/source.db',
      targetDbPath: '/custom/derived.db',
      isDemo: true,
    });
  });

  it('runs ETL without seed generation when derived is missing but source exists', () => {
    existsSyncSpy.mockImplementation((p) => {
      return String(p) === '/custom/source.db';
    });

    const result = autoBootstrapDatabase({
      derivedDbPath: '/custom/derived.db',
      sourceDbPath: '/custom/source.db',
      seedService: mockSeedService,
      etlService: mockEtlService,
    });

    expect(result.bootstrapped).toBe(true);
    expect(result.seeded).toBe(false);
    expect(mockSeedService.generateSyntheticDatabase).not.toHaveBeenCalled();
    expect(mockEtlService.runEtl).toHaveBeenCalledWith({
      sourceDbPath: '/custom/source.db',
      targetDbPath: '/custom/derived.db',
      isDemo: true,
    });
  });
});
