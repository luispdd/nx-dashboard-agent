import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';

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
    importDatabase: vi.fn().mockResolvedValue({
      isDemo: false,
      readingCount: 500,
      deviceCount: 2,
      lastImportedAt: '2026-10-17T11:00:00Z',
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

  describe('importDatabase', () => {
    it('should throw BadRequestException if no file is uploaded', async () => {
      const appController = app.get<AppController>(AppController);
      const req = {
        file: vi.fn().mockResolvedValue(null),
      } as any;

      await expect(appController.importDatabase(req)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should stream file and return updated status', async () => {
      const appController = app.get<AppController>(AppController);
      const mockStream = Readable.from(['mock data']);
      const req = {
        file: vi.fn().mockResolvedValue({
          file: mockStream,
          filename: 'uploaded.db',
        }),
      } as any;

      const result = await appController.importDatabase(req);
      expect(mockAppService.importDatabase).toHaveBeenCalledWith(
        mockStream,
        'uploaded.db'
      );
      expect(result.isDemo).toBe(false);
      expect(result.readingCount).toBe(500);
    });
  });
});
