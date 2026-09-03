import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, DashboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly userEmail = 'yashwanth@biltoka.com';
  protected chatOpen = false;
  protected chatWidth = 300;
  protected chatMessages: ChatMessage[] = [];

  protected onChatMessage(text: string): void {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    this.chatMessages = [
      ...this.chatMessages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        timestamp
      }
    ];
  }

  protected onNewChat(): void {
    this.chatMessages = [];
  }

  protected onChatHelp(): void {
    console.log('chat help');
  }
}
