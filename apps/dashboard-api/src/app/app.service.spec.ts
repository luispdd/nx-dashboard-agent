import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AppService } from './app.service';
import { MEASUREMENTS_REPOSITORY } from './database/measurements.repository.interface';

describe('AppService', () => {
  let service: AppService;
  const mockRepo = {
    getDatabaseStatus: vi.fn().mockResolvedValue({
      isDemo: true,
      readingCount: 100,
      deviceCount: 2,
      lastImportedAt: '2026-10-16T12:00:00Z',
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
});
