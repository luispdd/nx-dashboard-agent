import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AppService } from './app.service';
import { MEASUREMENTS_REPOSITORY } from './database/measurements.repository.interface';
import { EtlService } from './database/etl.service';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';

describe('AppService', () => {
  let service: AppService;
  const mockRepo = {
    getDatabaseStatus: vi.fn().mockResolvedValue({
      isDemo: true,
      readingCount: 100,
      deviceCount: 2,
      lastImportedAt: '2026-10-16T12:00:00Z',
    }),
    reconnect: vi.fn(),
  };

  const mockEtlService = {
    runEtl: vi.fn().mockReturnValue({
      sourcePath: 'source.db',
      targetPath: 'measurements.db',
      readingsProcessed: 100,
      measurementsInserted: 300,
      catalogEntries: 3,
      devicesCount: 2,
      isDemo: false,
      importedAt: '2026-10-17T10:00:00Z',
    }),
  };

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: MEASUREMENTS_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: EtlService,
          useValue: mockEtlService,
        },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      expect(service.getData()).toEqual({ message: 'Hello API' });
    });
  });

  describe('getDatabaseStatus', () => {
    it('should delegate to repository and return database status', async () => {
      const status = await service.getDatabaseStatus();
      expect(status).toEqual({
        isDemo: true,
        readingCount: 100,
        deviceCount: 2,
        lastImportedAt: '2026-10-16T12:00:00Z',
      });
      expect(mockRepo.getDatabaseStatus).toHaveBeenCalled();
    });
  });

  describe('importDatabase', () => {
    it('should reject files with unsupported extensions', async () => {
      const stream = Readable.from(['fake content']);
      await expect(service.importDatabase(stream, 'document.pdf')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should accept valid sqlite file, execute ETL and reconnect', async () => {
      const stream = Readable.from(['sqlite content']);
      const result = await service.importDatabase(stream, 'test-import.db');
      expect(mockEtlService.runEtl).toHaveBeenCalled();
      expect(mockRepo.reconnect).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
