import {
  Component,
  ElementRef,
  OnInit,
  DestroyRef,
  inject,
  signal,
  effect,
  viewChild,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/native-federation';
import {
  type DashboardContextListener,
  type MountOptions,
} from 'shared-mfe-context';
import { DashboardContextService } from '../core/services/dashboard-context.service';

@Component({
  selector: 'app-chat-wrapper',
  imports: [],
  templateUrl: './chat-wrapper.component.html',
  styleUrl: './chat-wrapper.component.scss',
})
export class ChatWrapperComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly contextService = inject(DashboardContextService);

  protected readonly container =
    viewChild<ElementRef<HTMLDivElement>>('chatContainer');
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly errorMessage = signal<string | null>(null);

  private unmountFn: (() => void) | null = null;
  private contextListener: DashboardContextListener | null = null;

  constructor() {
    effect(() => {
      const activeCtx = this.contextService.activeContext();
      if (this.contextListener) {
        this.contextListener(activeCtx);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const containerEl = this.container()?.nativeElement;
      if (!containerEl) {
        return;
      }

      const remoteModule = await loadRemoteModule<{
        mount: (
          el: HTMLElement,
          options?: MountOptions
        ) => () => void;
      }>('chat-mfe', './Chat');

      if (remoteModule && typeof remoteModule.mount === 'function') {
        const initialContext = this.contextService.activeContext();
        this.unmountFn = remoteModule.mount(containerEl, {
          context: initialContext,
          onContextChange: (listener: DashboardContextListener) => {
            this.contextListener = listener;
            return () => {
              if (this.contextListener === listener) {
                this.contextListener = null;
              }
            };
          },
        });
        this.status.set('ready');
      } else {
        throw new Error('Remote module did not export a mount function');
      }
    } catch (err: unknown) {
      this.status.set('error');
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
    }

    this.destroyRef.onDestroy(() => {
      this.contextListener = null;
      if (this.unmountFn) {
        this.unmountFn();
      }
    });
  }
}
