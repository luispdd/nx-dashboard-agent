import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { ChatWrapperComponent } from './chat-wrapper/chat-wrapper.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, ChatWrapperComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly isChatOpen = signal<boolean>(false);

  toggleChat(): void {
    this.isChatOpen.update((open) => !open);
  }

  closeChat(): void {
    this.isChatOpen.set(false);
  }
}
