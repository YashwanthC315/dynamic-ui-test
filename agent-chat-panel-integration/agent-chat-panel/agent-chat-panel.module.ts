/**
 * agent-chat-panel.module.ts
 *
 * Declares the panel component and its Angular dependencies. It does NOT
 * provide AGENT_CHAT_STATE_PORT / AGENT_CHAT_RESPONSE_PORT for you - those
 * need to be backed by this app's real backend/services, which is app-specific
 * and belongs in agent-chat.service.ts (built from agent-chat.service.template.ts).
 * See AGENT_GUIDE.md, Task 3.
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AgentChatPanelComponent } from './agent-chat-panel.component';
import { AgentChatService } from './agent-chat.service';
import { AGENT_CHAT_RESPONSE_PORT, AGENT_CHAT_STATE_PORT } from './agent-chat-port.contracts';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [AgentChatPanelComponent],
  exports: [AgentChatPanelComponent],
  providers: [
    AgentChatService,
    { provide: AGENT_CHAT_STATE_PORT, useExisting: AgentChatService },
    { provide: AGENT_CHAT_RESPONSE_PORT, useExisting: AgentChatService },
  ],
})
export class AgentChatPanelModule {}
