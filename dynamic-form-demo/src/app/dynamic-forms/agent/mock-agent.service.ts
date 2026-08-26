import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { FormSpec } from '../models/form-spec.model';
import { AgentToolHandler } from './agent-tools';

export interface AgentChatResult {
  reply: string;
  formSpec?: FormSpec;
}

/**
 * Stands in for a real LLM + function-calling loop. In production, an
 * actual model would decide which of these tool calls to make, in what
 * order, with what arguments — based on the user's message and a system
 * prompt describing the tools. Here we hardcode "if the message looks
 * like X, make these tool calls" purely to demonstrate the execution
 * path: intent -> tool calls -> validated FormSpec -> UI.
 */
@Injectable({ providedIn: 'root' })
export class MockAgentService {
  sendMessage(userMessage: string): Observable<AgentChatResult> {
    const msg = userMessage.toLowerCase();

    if (msg.includes('add organization') || msg.includes('add org')) {
      return of(this.buildAddOrganizationForm()).pipe(delay(600));
    }

    return of({
      reply:
        "I'm not sure how to help with that in this demo. Try: \"add organization\"",
    }).pipe(delay(300));
  }

  private buildAddOrganizationForm(): AgentChatResult {
    // This block is what an LLM's tool-call sequence would produce.
    // Nothing here touches HTML, CSS, or an API endpoint.
    const tools = new AgentToolHandler();

    tools.startForm(
      'add-organization',
      'Add Organization',
      'Fill in the organization details, then submit. The agent will acknowledge this form.'
    );

    tools.addField({
      id: 'name',
      label: 'Name',
      type: 'text',
      required: true,
    });

    tools.addField({
      id: 'shortName',
      label: 'Short Name',
      type: 'text',
      required: true,
      maxLength: 6,
      helpText: 'Up to 6 characters',
    });

    tools.addSelectField({
      id: 'parentOrgId',
      label: 'Parent',
      optionsSource: 'organizations.parentOptions',
    });

    tools.addSelectField({
      id: 'ownerId',
      label: 'Owner',
      optionsSource: 'organizations.ownerOptions',
    });

    const formSpec = tools.finalizeForm('Submit');

    return {
      reply: 'Opening the Add Organization form. Fill in the details in the panel.',
      formSpec,
    };
  }
}
