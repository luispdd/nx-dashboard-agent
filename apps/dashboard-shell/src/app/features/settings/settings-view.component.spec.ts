import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SettingsViewComponent,
  SETTINGS_STORAGE_KEY,
  DEFAULT_LLM_SETTINGS,
} from './settings-view.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { DatabaseService, DatabaseStatusDto } from 'shared-contracts';
import { DatabaseStatusService } from '../../core/services/database-status.service';
import { CapabilitiesService } from '../../core/services/capabilities.service';
import { signal } from '@angular/core';

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;
  let mockDatabaseService: {
    appControllerImportDatabase: ReturnType<typeof vi.fn>;
    appControllerResetDemoDatabase: ReturnType<typeof vi.fn>;
  };
  let mockDatabaseStatusService: {
    status: ReturnType<typeof signal<DatabaseStatusDto | null>>;
    loadStatus: ReturnType<typeof vi.fn>;
  };
  let mockCapabilitiesService: {
    loadCatalog: ReturnType<typeof vi.fn>;
  };

  const initialStatus: DatabaseStatusDto = {
    isDemo: true,
    readingCount: 1500,
    deviceCount: 3,
    lastImportedAt: '2026-10-15T10:00:00Z',
  };

  beforeEach(async () => {
    localStorage.clear();

    mockDatabaseService = {
      appControllerImportDatabase: vi.fn(),
      appControllerResetDemoDatabase: vi.fn(),
    };

    mockDatabaseStatusService = {
      status: signal<DatabaseStatusDto | null>(initialStatus),
      loadStatus: vi.fn().mockResolvedValue(undefined),
    };

    mockCapabilitiesService = {
      loadCatalog: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
      providers: [
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: DatabaseStatusService, useValue: mockDatabaseStatusService },
        { provide: CapabilitiesService, useValue: mockCapabilitiesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create settings view component', () => {
    expect(component).toBeTruthy();
  });

  describe('LLM Configuration', () => {
    it('should initialize with default settings values', () => {
      expect(component.settingsForm.value.baseUrl).toBe(DEFAULT_LLM_SETTINGS.baseUrl);
      expect(component.settingsForm.value.model).toBe(DEFAULT_LLM_SETTINGS.model);
      expect(component.settingsForm.value.apiKey).toBe('');
      expect(component.isApiKeyMasked()).toBe(true);
    });

    it('should toggle API key masking', () => {
      expect(component.isApiKeyMasked()).toBe(true);
      component.toggleApiKeyMask();
      expect(component.isApiKeyMasked()).toBe(false);
      component.toggleApiKeyMask();
      expect(component.isApiKeyMasked()).toBe(true);
    });

    it('should save valid settings to localStorage and set saved status', () => {
      component.settingsForm.setValue({
        baseUrl: 'http://custom-runner:8080/v1',
        model: 'custom-model-14b',
        apiKey: 'sk-secret-token',
      });

      component.saveSettings();
      fixture.detectChanges();

      expect(component.saveStatus()).toBe('saved');
      expect(component.statusMessage()).toContain('successfully');

      const storedRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      expect(storedRaw).toBeTruthy();
      const stored = JSON.parse(storedRaw ?? '{}');
      expect(stored.baseUrl).toBe('http://custom-runner:8080/v1');
      expect(stored.model).toBe('custom-model-14b');
      expect(stored.apiKey).toBe('sk-secret-token');
    });

    it('should reject invalid form submission', () => {
      component.settingsForm.controls.baseUrl.setValue('');
      component.saveSettings();
      fixture.detectChanges();

      expect(component.saveStatus()).toBe('error');
      expect(component.statusMessage()).toContain('valid');
    });

    it('should reset form to defaults', () => {
      component.settingsForm.setValue({
        baseUrl: 'http://custom:1234/v1',
        model: 'other-model',
        apiKey: 'xyz',
      });

      component.resetDefaults();
      fixture.detectChanges();

      expect(component.settingsForm.value.baseUrl).toBe(DEFAULT_LLM_SETTINGS.baseUrl);
      expect(component.settingsForm.value.model).toBe(DEFAULT_LLM_SETTINGS.model);
      expect(component.settingsForm.value.apiKey).toBe('');
      expect(component.saveStatus()).toBe('idle');
    });
  });

  describe('Database Upload & Ingestion', () => {
    it('should render active database status from DatabaseStatusService', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="database-upload-card"]')).toBeTruthy();
      expect(compiled.querySelector('[data-testid="active-db-status-badge"]')?.textContent).toContain('Demo Data');
      expect(compiled.querySelector('[data-testid="db-readings-count"]')?.textContent?.trim()).toBe('1,500');
      expect(compiled.querySelector('[data-testid="db-devices-count"]')?.textContent?.trim()).toBe('3');
    });

    it('should accept valid sqlite database files on input selection', () => {
      const file = new File(['dummy sqlite content'], 'test.db', { type: 'application/x-sqlite3' });
      const event = {
        target: {
          files: [file],
          value: '',
        },
      } as unknown as Event;

      component.onFileSelected(event);
      fixture.detectChanges();

      expect(component.selectedFile()).toBe(file);
      expect(component.uploadError()).toBeNull();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="selected-file-name"]')?.textContent).toBe('test.db');
      expect(compiled.querySelector('[data-testid="clear-file-btn"]')).toBeTruthy();
    });

    it('should reject non-sqlite file extensions and display error alert', () => {
      const file = new File(['text content'], 'invalid.txt', { type: 'text/plain' });
      const event = {
        target: {
          files: [file],
          value: '',
        },
      } as unknown as Event;

      component.onFileSelected(event);
      fixture.detectChanges();

      expect(component.selectedFile()).toBeNull();
      expect(component.uploadError()).toContain('Invalid file extension');

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="upload-error-alert"]')?.textContent).toContain('.txt');
    });

    it('should clear selected file when clear button is clicked', () => {
      const file = new File(['dummy sqlite content'], 'test.sqlite3', { type: 'application/x-sqlite3' });
      component['setFile'](file);
      fixture.detectChanges();

      expect(component.selectedFile()).toBe(file);

      component.clearSelectedFile();
      fixture.detectChanges();

      expect(component.selectedFile()).toBeNull();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="selected-file-preview"]')).toBeNull();
    });

    it('should format file sizes accurately', () => {
      expect(component.formatFileSize(500)).toBe('500 B');
      expect(component.formatFileSize(2048)).toBe('2.0 KB');
      expect(component.formatFileSize(15 * 1024 * 1024)).toBe('15.00 MB');
    });

    it('should handle drag-over and drag-leave events', () => {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      const dragEvent = { preventDefault, stopPropagation } as unknown as DragEvent;

      component.onDragOver(dragEvent);
      expect(component.isDragging()).toBe(true);
      expect(preventDefault).toHaveBeenCalled();

      component.onDragLeave(dragEvent);
      expect(component.isDragging()).toBe(false);
    });

    it('should handle file dropped via drag and drop', () => {
      const file = new File(['dummy content'], 'dropped.sqlite', { type: 'application/x-sqlite3' });
      const dragEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: [file],
        },
      } as unknown as DragEvent;

      component.onFileDropped(dragEvent);
      fixture.detectChanges();

      expect(component.isDragging()).toBe(false);
      expect(component.selectedFile()).toBe(file);
    });

    it('should upload file successfully and refresh status and catalog services', async () => {
      const file = new File(['sqlite db bytes'], 'telemetry.db', { type: 'application/x-sqlite3' });
      component['setFile'](file);
      fixture.detectChanges();

      const importedStatus: DatabaseStatusDto = {
        isDemo: false,
        readingCount: 8420,
        deviceCount: 5,
        lastImportedAt: '2026-10-17T12:00:00Z',
      };

      mockDatabaseService.appControllerImportDatabase.mockReturnValue(of(importedStatus));

      await component.uploadDatabase();
      fixture.detectChanges();

      expect(mockDatabaseService.appControllerImportDatabase).toHaveBeenCalledWith(file);
      expect(component.uploadSuccess()).toEqual(importedStatus);
      expect(component.selectedFile()).toBeNull();
      expect(component.isUploading()).toBe(false);
      expect(mockDatabaseStatusService.loadStatus).toHaveBeenCalled();
      expect(mockCapabilitiesService.loadCatalog).toHaveBeenCalled();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="upload-success-alert"]')).toBeTruthy();
      expect(compiled.querySelector('[data-testid="upload-success-alert"]')?.textContent).toContain('8,420');
      expect(compiled.querySelector('[data-testid="upload-success-alert"]')?.textContent).toContain('5');
    });

    it('should handle upload error and display failure alert', async () => {
      const file = new File(['bad db'], 'bad.db', { type: 'application/x-sqlite3' });
      component['setFile'](file);
      fixture.detectChanges();

      mockDatabaseService.appControllerImportDatabase.mockReturnValue(
        throwError(() => ({ error: { message: 'Incompatible units detected for metric temp: °C vs F' } }))
      );

      await component.uploadDatabase();
      fixture.detectChanges();

      expect(component.uploadError()).toContain('Incompatible units detected');
      expect(component.uploadSuccess()).toBeNull();
      expect(component.isUploading()).toBe(false);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="upload-error-alert"]')?.textContent).toContain('Incompatible units');
    });
  });

  describe('restoreDemoData', () => {
    it('should call resetDemoDatabase, reload status and catalog, and display success message', async () => {
      const demoStatus: DatabaseStatusDto = {
        isDemo: true,
        readingCount: 6238,
        deviceCount: 3,
        lastImportedAt: '2026-10-17T14:00:00Z',
      };

      mockDatabaseService.appControllerResetDemoDatabase.mockReturnValue(of(demoStatus));

      await component.restoreDemoData();
      fixture.detectChanges();

      expect(mockDatabaseService.appControllerResetDemoDatabase).toHaveBeenCalled();
      expect(component.uploadSuccess()).toEqual(demoStatus);
      expect(component.isRestoringDemo()).toBe(false);
      expect(mockDatabaseStatusService.loadStatus).toHaveBeenCalled();
      expect(mockCapabilitiesService.loadCatalog).toHaveBeenCalled();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="upload-success-alert"]')?.textContent).toContain('Synthetic Demo Data Restored');
    });

    it('should handle reset failure and display error alert', async () => {
      mockDatabaseService.appControllerResetDemoDatabase.mockReturnValue(
        throwError(() => ({ error: { message: 'Database reset failed' } }))
      );

      await component.restoreDemoData();
      fixture.detectChanges();

      expect(component.uploadError()).toContain('Database reset failed');
      expect(component.isRestoringDemo()).toBe(false);
    });
  });
});
