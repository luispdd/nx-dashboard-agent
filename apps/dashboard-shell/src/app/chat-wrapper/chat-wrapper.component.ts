import {
  Component,
  ElementRef,
  OnInit,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/native-federation';
import {
  createDefaultDashboardContext,
  type DashboardContext,
} from 'shared-mfe-context';

@Component({
  selector: 'app-chat-wrapper',
  imports: [],
  templateUrl: './chat-wrapper.component.html',
  styleUrl: './chat-wrapper.component.scss',
})
export class ChatWrapperComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly container =
    viewChild<ElementRef<HTMLDivElement>>('chatContainer');
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  private unmountFn: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const containerEl = this.container()?.nativeElement;
      if (!containerEl) {
        return;
      }

      const remoteModule = await loadRemoteModule<{
        mount: (
          el: HTMLElement,
          options?: { context?: DashboardContext }
        ) => () => void;
      }>('chat-mfe', './Chat');

      if (remoteModule && typeof remoteModule.mount === 'function') {
        const context = createDefaultDashboardContext();
        this.unmountFn = remoteModule.mount(containerEl, { context });
        this.status.set('ready');
      } else {
        throw new Error('Remote module did not export a mount function');
      }
    } catch (err: unknown) {
      this.status.set('error');
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
    }

    this.destroyRef.onDestroy(() => {
      if (this.unmountFn) {
        this.unmountFn();
      }
    });
  }
}
