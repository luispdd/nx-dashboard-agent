import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DatabaseStatusService } from '../../core/services/database-status.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly databaseStatusService = inject(DatabaseStatusService);

  readonly isChatOpen = input<boolean>(false);
  readonly toggleChat = output<void>();

  readonly isDemo = this.databaseStatusService.isDemo;

  onToggleChat(): void {
    this.toggleChat.emit();
  }
}

