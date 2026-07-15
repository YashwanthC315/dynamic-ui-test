import { Component, ViewChild } from '@angular/core';
import { ChatMessage, ChatPanelComponent } from './chat-panel/chat-panel.component';
import { ChatPromptResponse, FeeCollectionFormComponent } from './fee-collection-form/fee-collection-form.component';

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
  readonly chatPlaceholder = 'Type a prompt: pick 20P074, set amount 500, mode cash, show paid tab';

  chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      text: 'I am currently focused on fee collection. Try: "pick 20P074", "set amount 500", "mode cash", "show paid tab", or "help".',
      time: this.timeNow(),
    },
  ];

  readonly quickCommands = [
    'Pick 20P074',
    'Set amount 500',
    'Mode cash',
    'Show paid tab',
    'What is selected',
  ];

  handlePrompt(prompt: string): void {
    this.pushMessage('user', prompt);

    if (!this.feeCollectionForm) {
      this.pushMessage('assistant', 'Fee collection form is loading. Try the command again.');
      return;
    }

    const response = this.feeCollectionForm.handleChatPrompt(prompt);
    if (typeof response === 'string') {
      this.pushMessage('assistant', response);
      return;
    }

    this.pushMessage('assistant', response.text, response.options);
  }

  private pushMessage(role: 'user' | 'assistant', text: string, options?: ChatPromptResponse['options']): void {
    this.chatMessages = [...this.chatMessages, { role, text, options, time: this.timeNow() }];
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
