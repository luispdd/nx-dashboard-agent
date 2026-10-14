import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SettingsViewComponent,
  SETTINGS_STORAGE_KEY,
  DEFAULT_LLM_SETTINGS,
} from './settings-view.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SettingsViewComponent', () => {
  let component: SettingsViewComponent;
  let fixture: ComponentFixture<SettingsViewComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SettingsViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create settings view component', () => {
    expect(component).toBeTruthy();
  });

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
