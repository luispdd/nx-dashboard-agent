import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { ChatWrapperComponent } from './chat-wrapper/chat-wrapper.component';

export const DEFAULT_DRAWER_WIDTH = 480;
export const MIN_DRAWER_WIDTH = 360;
export const DRAWER_WIDTH_STORAGE_KEY = 'iot-dashboard-chat-drawer-width';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, ChatWrapperComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  readonly isChatOpen = signal<boolean>(false);
  readonly drawerWidth = signal<number>(this.getInitialWidth());
  readonly isResizing = signal<boolean>(false);

  private moveListener: ((e: PointerEvent) => void) | null = null;
  private upListener: ((e: PointerEvent) => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanupDragListeners();
    });
  }

  toggleChat(): void {
    this.isChatOpen.update((open) => !open);
  }

  closeChat(): void {
    this.isChatOpen.set(false);
  }

  startResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    this.isResizing.set(true);
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    this.moveListener = (e: PointerEvent) => {
      this.onResizeMove(e.clientX);
    };

    this.upListener = () => {
      this.stopResize();
    };

    window.addEventListener('pointermove', this.moveListener);
    window.addEventListener('pointerup', this.upListener);
    window.addEventListener('pointercancel', this.upListener);
  }

  onResizeMove(clientX: number): void {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const rawWidth = windowWidth - clientX;
    const maxWidth = Math.floor(windowWidth * 0.5);
    const clamped = Math.max(MIN_DRAWER_WIDTH, Math.min(rawWidth, maxWidth));
    this.drawerWidth.set(clamped);
  }

  private stopResize(): void {
    this.isResizing.set(false);
    this.cleanupDragListeners();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, this.drawerWidth().toString());
      } catch {
        // localStorage might be restricted
      }
    }
  }

  private cleanupDragListeners(): void {
    if (typeof document !== 'undefined') {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    if (this.moveListener) {
      window.removeEventListener('pointermove', this.moveListener);
      this.moveListener = null;
    }
    if (this.upListener) {
      window.removeEventListener('pointerup', this.upListener);
      window.removeEventListener('pointercancel', this.upListener);
      this.upListener = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window === 'undefined') return;
    const maxWidth = Math.floor(window.innerWidth * 0.5);
    if (this.drawerWidth() > maxWidth) {
      this.drawerWidth.set(Math.max(MIN_DRAWER_WIDTH, maxWidth));
    }
  }

  private getInitialWidth(): number {
    if (typeof window === 'undefined') return DEFAULT_DRAWER_WIDTH;
    const maxWidth = Math.floor(window.innerWidth * 0.5);
    let preferred = DEFAULT_DRAWER_WIDTH;

    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed > 0) {
            preferred = parsed;
          }
        }
      } catch {
        // Fall back to default
      }
    }

    return Math.max(MIN_DRAWER_WIDTH, Math.min(preferred, maxWidth));
  }
}

