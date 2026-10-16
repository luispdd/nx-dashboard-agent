import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App, MIN_DRAWER_WIDTH, DRAWER_WIDTH_STORAGE_KEY } from './app';
import { appRoutes } from './app.routes';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create root app component', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isChatOpen()).toBe(false);
    expect(app.drawerWidth()).toBeGreaterThanOrEqual(MIN_DRAWER_WIDTH);
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

  it('should clamp drawer width between MIN_DRAWER_WIDTH and 50% window width during resize move', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Simulate window.innerWidth = 1000 => 50% max = 500
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);

    // ClientX at 600 => rawWidth = 1000 - 600 = 400 (valid between 360 and 500)
    app.onResizeMove(600);
    expect(app.drawerWidth()).toBe(400);

    // ClientX at 200 => rawWidth = 1000 - 200 = 800 => clamped to 500 (50vw)
    app.onResizeMove(200);
    expect(app.drawerWidth()).toBe(500);

    // ClientX at 900 => rawWidth = 1000 - 900 = 100 => clamped to 360 (MIN_DRAWER_WIDTH)
    app.onResizeMove(900);
    expect(app.drawerWidth()).toBe(MIN_DRAWER_WIDTH);
  });

  it('should persist width in localStorage on stopResize and initialize from stored width', () => {
    localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, '420');
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.drawerWidth()).toBe(420);

    // Resize to 450 and stop
    app.onResizeMove(1200 - 450);
    const resizeHandle: HTMLElement = fixture.nativeElement.querySelector('[data-testid="chat-drawer-resize-handle"]');
    expect(resizeHandle).toBeTruthy();

    // Trigger pointerdown and pointerup to test lifecycle
    const pointerDownEvent = new PointerEvent('pointerdown', { button: 0 });
    resizeHandle.dispatchEvent(pointerDownEvent);
    expect(app.isResizing()).toBe(true);

    window.dispatchEvent(new PointerEvent('pointerup'));
    expect(app.isResizing()).toBe(false);
    expect(localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY)).toBe(app.drawerWidth().toString());
  });

  it('should re-clamp drawer width on window resize if window shrinks', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.drawerWidth.set(550); // Valid when innerWidth = 1200 (50% is 600)

    // Shrink window to 800 => max is 400
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    app.onWindowResize();
    expect(app.drawerWidth()).toBe(400);
  });
});

