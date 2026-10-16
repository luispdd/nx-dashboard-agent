import { TestBed } from '@angular/core/testing';
import { ChatWrapperComponent } from './chat-wrapper.component';
import { DashboardContextService } from '../core/services/dashboard-context.service';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { DashboardContext, DashboardContextListener } from 'shared-mfe-context';

vi.mock('@angular-architects/native-federation', () => ({
  loadRemoteModule: vi.fn(),
}));

describe('ChatWrapperComponent', () => {
  let contextService: DashboardContextService;
  let mockUnmount: Mock;
  let capturedListener: DashboardContextListener | null;

  beforeEach(() => {
    mockUnmount = vi.fn();
    capturedListener = null;

    (loadRemoteModule as Mock).mockResolvedValue({
      mount: vi.fn((el: HTMLElement, options?: { context?: DashboardContext; onContextChange?: (cb: DashboardContextListener) => () => void }) => {
        if (options?.onContextChange) {
          options.onContextChange((ctx) => {
            capturedListener?.(ctx);
          });
        }
        return mockUnmount;
      }),
    });

    TestBed.configureTestingModule({
      imports: [ChatWrapperComponent],
      providers: [DashboardContextService],
    });

    contextService = TestBed.inject(DashboardContextService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize, load remote module and set status to ready', async () => {
    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp['status']()).toBe('ready');
    expect(comp['errorMessage']()).toBeNull();
    expect(loadRemoteModule).toHaveBeenCalledWith(
      expect.objectContaining({ remoteName: 'chat-mfe', exposedModule: './Chat' })
    );
  });

  it('should transition to error state if loadRemoteModule fails', async () => {
    (loadRemoteModule as Mock).mockRejectedValueOnce(new Error('Network connection refused'));

    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp['status']()).toBe('error');
    expect(comp['errorMessage']()).toContain('Network connection refused');

    const errorEl = fixture.nativeElement.querySelector('[data-testid="chat-error"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Network connection refused');
  });

  it('should transition to error state if remote module does not export mount function', async () => {
    (loadRemoteModule as Mock).mockResolvedValueOnce({});

    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp['status']()).toBe('error');
    expect(comp['errorMessage']()).toContain('Remote module did not export a mount function');
  });

  it('should retry connection and remount cleanly on retry action', async () => {
    (loadRemoteModule as Mock).mockRejectedValueOnce(new Error('Temporary failure'));

    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp['status']()).toBe('error');

    // Simulate recovery for retry
    (loadRemoteModule as Mock).mockResolvedValueOnce({
      mount: vi.fn(() => mockUnmount),
    });

    const retryBtn: HTMLElement = fixture.nativeElement.querySelector('[data-testid="retry-chat-mfe-button"]');
    expect(retryBtn).toBeTruthy();

    await comp.retry();
    fixture.detectChanges();

    expect(comp['status']()).toBe('ready');
    expect(comp['errorMessage']()).toBeNull();
  });

  it('should call unmount on component destruction', async () => {
    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    fixture.destroy();
    expect(mockUnmount).toHaveBeenCalled();
  });

  it('should propagate context updates from service to remote listener via effect', async () => {
    let receivedContext: DashboardContext | null = null;
    (loadRemoteModule as Mock).mockResolvedValueOnce({
      mount: vi.fn((_el: HTMLElement, options?: { onContextChange?: (cb: DashboardContextListener) => () => void }) => {
        options?.onContextChange?.((ctx) => {
          receivedContext = ctx;
        });
        return mockUnmount;
      }),
    });

    const fixture = TestBed.createComponent(ChatWrapperComponent);
    fixture.detectChanges();
    await fixture.componentInstance['mountPromise'];
    fixture.detectChanges();

    // Update context in service
    contextService.updateContext({
      selectedMetric: 'humidity',
      selectedDevices: ['esp32s3'],
      timeRange: { preset: '7d' },
    });

    TestBed.flushEffects();

    expect(receivedContext).not.toBeNull();
    const result = receivedContext as unknown as DashboardContext;
    expect(result.selectedMetric).toBe('humidity');
    expect(result.selectedDevices).toEqual(['esp32s3']);
  });
});
