import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { HeaderComponent } from './header.component';
import { DatabaseStatusService } from '../../core/services/database-status.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  const mockIsDemoSignal = signal<boolean>(false);

  const mockDatabaseStatusService = {
    isDemo: mockIsDemoSignal,
  };

  beforeEach(async () => {
    mockIsDemoSignal.set(false);

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: DatabaseStatusService, useValue: mockDatabaseStatusService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create header component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleChat event on button click', () => {
    let emitted = false;
    component.toggleChat.subscribe(() => {
      emitted = true;
    });

    const button = fixture.nativeElement.querySelector('[data-testid="toggle-chat-button"]');
    button.click();

    expect(emitted).toBe(true);
  });

  it('should not render the Demo Data badge when isDemo is false', () => {
    mockIsDemoSignal.set(false);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="demo-data-badge"]');
    expect(badge).toBeNull();
  });

  it('should render the Demo Data badge with pulse indicator when isDemo is true', () => {
    mockIsDemoSignal.set(true);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="demo-data-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Demo Data');

    const pulseDot = badge.querySelector('.animate-pulse');
    expect(pulseDot).not.toBeNull();
  });
});
