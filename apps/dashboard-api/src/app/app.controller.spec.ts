import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;
  const mockAppService = {
    getData: vi.fn().mockReturnValue({ message: 'Hello API' }),
    getDatabaseStatus: vi.fn().mockResolvedValue({
      isDemo: true,
      readingCount: 6174,
      deviceCount: 3,
      lastImportedAt: '2026-10-16T16:39:00Z',
    }),
  };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'Hello API' });
    });
  });

  describe('getDatabaseStatus', () => {
    it('should return database provenance and statistics', async () => {
      const appController = app.get<AppController>(AppController);
      const status = await appController.getDatabaseStatus();
      expect(status).toEqual({
        isDemo: true,
        readingCount: 6174,
        deviceCount: 3,
        lastImportedAt: '2026-10-16T16:39:00Z',
      });
      expect(mockAppService.getDatabaseStatus).toHaveBeenCalled();
    });
  });
});
