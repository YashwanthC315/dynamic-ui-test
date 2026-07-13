import { Component, ViewChild } from '@angular/core';
import { ChatMessage, ChatPanelComponent } from './chat-panel/chat-panel.component';
import { FeeCollectionFormComponent } from './fee-collection-form/fee-collection-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatPanelComponent, FeeCollectionFormComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  @ViewChild(FeeCollectionFormComponent)
  private feeCollectionForm?: FeeCollectionFormComponent;

  readonly title = 'Dynamic Operations Console';
  readonly subtitle = 'Universal chat panel currently connected to fee collection';
  readonly chatPlaceholder = 'Type a fee-collection command';

  chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      text: 'I am currently focused on fee collection. Try: "pick student a", "set amount 500", "mode cash", or "show paid tab".',
      time: this.timeNow(),
    },
  ];

  readonly quickCommands = [
    'Pick student A fee collection',
    'Set amount 500',
    'Mode cash',
    'Show paid tab',
  ];

  handlePrompt(prompt: string): void {
    this.pushMessage('user', prompt);

    if (!this.feeCollectionForm) {
      this.pushMessage('assistant', 'Fee collection form is loading. Try the command again.');
      return;
    }

    const response = this.feeCollectionForm.handleChatPrompt(prompt);
    this.pushMessage('assistant', response);
  }

  private pushMessage(role: 'user' | 'assistant', text: string): void {
    this.chatMessages = [...this.chatMessages, { role, text, time: this.timeNow() }];
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
