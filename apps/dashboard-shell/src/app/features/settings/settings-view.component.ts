import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DatabaseService, DatabaseStatusDto } from 'shared-contracts';
import { DatabaseStatusService } from '../../core/services/database-status.service';
import { CapabilitiesService } from '../../core/services/capabilities.service';

export interface LlmSettingsConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettingsConfig = {
  baseUrl: 'http://127.0.0.1:8888/v1',
  model: 'unsloth/Qwen3.5-4B-GGUF',
  apiKey: '',
};

export const SETTINGS_STORAGE_KEY = 'dashboard_llm_settings';

@Component({
  selector: 'app-settings-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings-view.component.html',
  styleUrl: './settings-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsViewComponent implements OnInit {
  private readonly databaseService = inject(DatabaseService);
  readonly databaseStatusService = inject(DatabaseStatusService);
  private readonly capabilitiesService = inject(CapabilitiesService);

  readonly isApiKeyMasked = signal<boolean>(true);
  readonly saveStatus = signal<'idle' | 'saved' | 'error'>('idle');
  readonly statusMessage = signal<string>('');

  // Database ingestion signals
  readonly selectedFile = signal<File | null>(null);
  readonly isDragging = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly isRestoringDemo = signal<boolean>(false);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<DatabaseStatusDto | null>(null);

  readonly settingsForm = new FormGroup({
    baseUrl: new FormControl<string>(DEFAULT_LLM_SETTINGS.baseUrl, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    model: new FormControl<string>(DEFAULT_LLM_SETTINGS.model, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    apiKey: new FormControl<string>(DEFAULT_LLM_SETTINGS.apiKey, {
      nonNullable: true,
    }),
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  toggleApiKeyMask(): void {
    this.isApiKeyMasked.update((masked) => !masked);
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.saveStatus.set('error');
      this.statusMessage.set('Please provide valid configuration values.');
      return;
    }

    try {
      const config: LlmSettingsConfig = this.settingsForm.getRawValue();
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
      this.saveStatus.set('saved');
      this.statusMessage.set('LLM runtime configuration saved successfully.');
    } catch {
      this.saveStatus.set('error');
      this.statusMessage.set('Failed to persist configuration to storage.');
    }
  }

  resetDefaults(): void {
    this.settingsForm.setValue({
      baseUrl: DEFAULT_LLM_SETTINGS.baseUrl,
      model: DEFAULT_LLM_SETTINGS.model,
      apiKey: DEFAULT_LLM_SETTINGS.apiKey,
    });
    this.saveStatus.set('idle');
    this.statusMessage.set('');
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<LlmSettingsConfig>;
        this.settingsForm.patchValue({
          baseUrl: parsed.baseUrl || DEFAULT_LLM_SETTINGS.baseUrl,
          model: parsed.model || DEFAULT_LLM_SETTINGS.model,
          apiKey: parsed.apiKey || DEFAULT_LLM_SETTINGS.apiKey,
        });
      }
    } catch {
      // Fallback to default form values on read failure
    }
  }

  // File Upload & ETL Actions
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.setFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
      input.value = '';
    }
  }

  private setFile(file: File): void {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.db', '.sqlite', '.sqlite3'].includes(ext)) {
      this.uploadError.set(`Invalid file extension "${ext}". Please upload a .db, .sqlite, or .sqlite3 file.`);
      return;
    }
    this.uploadError.set(null);
    this.uploadSuccess.set(null);
    this.selectedFile.set(file);
  }

  clearSelectedFile(): void {
    this.selectedFile.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async uploadDatabase(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.isUploading()) {
      return;
    }

    this.isUploading.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    try {
      const result = await firstValueFrom(
        this.databaseService.appControllerImportDatabase(file)
      );
      this.uploadSuccess.set(result);
      this.selectedFile.set(null);
      await Promise.all([
        this.databaseStatusService.loadStatus(),
        this.capabilitiesService.loadCatalog(),
      ]);
    } catch (err: unknown) {
      let msg = 'Failed to upload database and execute ETL.';
      if (err && typeof err === 'object') {
        const httpErr = err as { error?: { message?: string }; message?: string };
        msg = httpErr.error?.message || httpErr.message || msg;
      }
      this.uploadError.set(msg);
    } finally {
      this.isUploading.set(false);
    }
  }

  async restoreDemoData(): Promise<void> {
    if (this.isRestoringDemo() || this.isUploading()) {
      return;
    }

    this.isRestoringDemo.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    try {
      const result = await firstValueFrom(
        this.databaseService.appControllerResetDemoDatabase()
      );
      this.uploadSuccess.set(result);
      this.selectedFile.set(null);
      await Promise.all([
        this.databaseStatusService.loadStatus(),
        this.capabilitiesService.loadCatalog(),
      ]);
    } catch (err: unknown) {
      let msg = 'Failed to restore synthetic demo database.';
      if (err && typeof err === 'object') {
        const httpErr = err as { error?: { message?: string }; message?: string };
        msg = httpErr.error?.message || httpErr.message || msg;
      }
      this.uploadError.set(msg);
    } finally {
      this.isRestoringDemo.set(false);
    }
  }
}
