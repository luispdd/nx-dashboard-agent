import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { describe, it, expect, beforeEach } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  it('should create root app component', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isChatOpen()).toBe(false);
  });

  it('should toggle chat drawer open and closed', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.toggleChat();
    expect(app.isChatOpen()).toBe(true);

    app.closeChat();
    expect(app.isChatOpen()).toBe(false);
  });

  it('should persist chat drawer in DOM and toggle CSS translate classes on state change', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const drawer: HTMLElement = fixture.nativeElement.querySelector('[data-testid="chat-drawer"]');
    expect(drawer).toBeTruthy();
    expect(drawer.classList.contains('translate-x-full')).toBe(true);
    expect(drawer.getAttribute('aria-hidden')).toBe('true');

    fixture.componentInstance.toggleChat();
    fixture.detectChanges();
    expect(drawer.classList.contains('translate-x-0')).toBe(true);
    expect(drawer.getAttribute('aria-hidden')).toBe('false');

    fixture.componentInstance.closeChat();
    fixture.detectChanges();
    expect(drawer.classList.contains('translate-x-full')).toBe(true);
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    // Ensure drawer was never removed from DOM
    expect(fixture.nativeElement.querySelector('[data-testid="chat-drawer"]')).toBeTruthy();
  });
});
