import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';

export interface LlmSettingsConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettingsConfig = {
  baseUrl: 'http://localhost:8000/v1',
  model: 'qwen2.5-coder-7b',
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
  readonly isApiKeyMasked = signal<boolean>(true);
  readonly saveStatus = signal<'idle' | 'saved' | 'error'>('idle');
  readonly statusMessage = signal<string>('');

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
}
