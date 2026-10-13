import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';
import { ChatWrapperComponent } from './chat-wrapper/chat-wrapper.component';

@Component({
  imports: [NxWelcome, RouterModule, ChatWrapperComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'dashboard-shell';
}
