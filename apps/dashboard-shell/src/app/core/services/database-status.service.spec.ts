import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DatabaseService, DatabaseStatusDto } from 'shared-contracts';
import { DatabaseStatusService } from './database-status.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DatabaseStatusService', () => {
  let service: DatabaseStatusService;

  const mockDatabaseStatus: DatabaseStatusDto = {
    isDemo: true,
    readingCount: 1500,
    deviceCount: 2,
    lastImportedAt: '2026-10-16T12:00:00Z',
  };

  const mockDatabaseService = {
    appControllerGetDatabaseStatus: vi.fn().mockReturnValue(of(mockDatabaseStatus)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabaseService.appControllerGetDatabaseStatus.mockReturnValue(of(mockDatabaseStatus));

    TestBed.configureTestingModule({
      providers: [
        DatabaseStatusService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    });

    service = TestBed.inject(DatabaseStatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch database status on load and update isDemo signal', async () => {
    await service.loadStatus();

    expect(service.status()).toEqual(mockDatabaseStatus);
    expect(service.isDemo()).toBe(true);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should update isDemo to false when database status is not demo', async () => {
    mockDatabaseService.appControllerGetDatabaseStatus.mockReturnValue(
      of({ ...mockDatabaseStatus, isDemo: false })
    );

    await service.loadStatus();

    expect(service.isDemo()).toBe(false);
  });

  it('should handle errors gracefully without throwing', async () => {
    mockDatabaseService.appControllerGetDatabaseStatus.mockReturnValue(
      throwError(() => new Error('Network error'))
    );

    await service.loadStatus();

    expect(service.error()).toBe('Network error');
    expect(service.isDemo()).toBe(false);
    expect(service.isLoading()).toBe(false);
  });

  it('should allow setting mock status directly', () => {
    service.setMockStatus({
      isDemo: true,
      readingCount: 50,
      deviceCount: 1,
      lastImportedAt: null,
    });

    expect(service.isDemo()).toBe(true);
    expect(service.status()?.readingCount).toBe(50);
  });
});
