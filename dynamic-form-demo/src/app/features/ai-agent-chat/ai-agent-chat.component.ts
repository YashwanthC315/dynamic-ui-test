import { Component, EventEmitter, Output } from '@angular/core';
import { FormSpec, FormSubmitEvent } from '../../dynamic-forms/models/form-spec.model';
import { MockAgentService } from '../../dynamic-forms/agent/mock-agent.service';
import { SubmitHandlerRegistry } from '../../dynamic-forms/registry/submit-handler.registry';

interface ChatMessage {
  from: 'user' | 'agent';
  text: string;
}

@Component({
  selector: 'app-ai-agent-chat',
  templateUrl: './ai-agent-chat.component.html',
  styleUrls: ['./ai-agent-chat.component.css'],
})
export class AiAgentChatComponent {
  @Output() organizationCreated = new EventEmitter<any>();

  messages: ChatMessage[] = [
    { from: 'agent', text: "I'm ready to help. Try: \"add organization\"" },
  ];
  draft = '';
  activeFormSpec: FormSpec | null = null;
  sending = false;

  constructor(
    private agent: MockAgentService,
    private submitHandlers: SubmitHandlerRegistry
  ) {}

  send(): void {
    const text = this.draft.trim();
    if (!text || this.sending) {
      return;
    }
    this.messages.push({ from: 'user', text });
    this.draft = '';
    this.sending = true;

    this.agent.sendMessage(text).subscribe((result) => {
      this.messages.push({ from: 'agent', text: result.reply });
      if (result.formSpec) {
        this.activeFormSpec = result.formSpec;
      }
      this.sending = false;
    });
  }

  onFormCancel(): void {
    this.activeFormSpec = null;
  }

  // This is the ONLY place that knows how to turn a submitted form value
  // into a real (mocked) API call. Neither the dynamic form nor the
  // agent know this happens.
  onFormSubmit(event: FormSubmitEvent): void {
    const handler = this.submitHandlers.getHandler(event.formId);
    if (!handler) {
      this.messages.push({
        from: 'agent',
        text: `No handler registered for form "${event.formId}".`,
      });
      return;
    }

    handler(event.value).subscribe((created) => {
      this.activeFormSpec = null;
      this.messages.push({
        from: 'agent',
        text: `"${created.name}" was created successfully.`,
      });
      this.organizationCreated.emit(created);
    });
  }
}
