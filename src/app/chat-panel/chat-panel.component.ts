import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  options?: ChatOption[];
  time: string;
}

export interface ChatOption {
  label: string;
  prompt: string;
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

  @ViewChild('chatThread')
  private chatThreadRef?: ElementRef<HTMLElement>;

  private _messages: ChatMessage[] = [];

  @Input()
  set messages(value: ChatMessage[]) {
    this._messages = value;
    queueMicrotask(() => {
      this.scrollToBottom();
    });
  }

  get messages(): ChatMessage[] {
    return this._messages;
  }

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

  runMessageOption(option: ChatOption): void {
    this.promptSubmitted.emit(option.prompt);
  }

  private scrollToBottom(): void {
    const chatThread = this.chatThreadRef?.nativeElement;
    if (!chatThread) {
      return;
    }

    chatThread.scrollTop = chatThread.scrollHeight;
  }
}
