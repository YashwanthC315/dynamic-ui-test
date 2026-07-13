import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css',
})
export class ChatPanelComponent {
  @Input() title = 'Operations Assistant';
  @Input() subtitle = 'Chat-driven workflow control';
  @Input() placeholder = 'Type a command';
  @Input() quickCommands: string[] = [];
  @Input() messages: ChatMessage[] = [];

  @Output() promptSubmitted = new EventEmitter<string>();

  chatInput = '';

  submitPrompt(): void {
    const prompt = this.chatInput.trim();
    if (!prompt) {
      return;
    }

    this.promptSubmitted.emit(prompt);
    this.chatInput = '';
  }

  runQuickCommand(command: string): void {
    this.promptSubmitted.emit(command);
  }
}
