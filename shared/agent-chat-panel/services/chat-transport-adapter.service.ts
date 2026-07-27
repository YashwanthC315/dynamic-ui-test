import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ChatBlock, ChatRequest, ChatResponse } from './chat-contracts';
import { MockAgentHarnessService } from './mock-agent-harness.service';

export interface HarnessTransportClient {
  send(request: ChatRequest): Observable<ChatResponse>;
}

export const HARNESS_TRANSPORT_CLIENT = new InjectionToken<HarnessTransportClient>('HARNESS_TRANSPORT_CLIENT', {
  providedIn: 'root',
  factory: () => inject(MockAgentHarnessService),
});

@Injectable({ providedIn: 'root' })
export class ChatTransportAdapterService {
  private readonly client = inject(HARNESS_TRANSPORT_CLIENT);

  send(request: ChatRequest): Observable<ChatResponse> {
    return this.client.send(request).pipe(
      map((response) => this.normalizeResponse(request, response))
    );
  }

  private normalizeResponse(request: ChatRequest, response: ChatResponse): ChatResponse {
    const hasEnvelope =
      response.schemaVersion &&
      response.requestId &&
      response.conversationId &&
      response.messageId &&
      response.parentMessageId &&
      response.status &&
      Array.isArray(response.blocks);

    if (!hasEnvelope) {
      throw new Error('Malformed response envelope from harness.');
    }

    if (response.requestId !== request.requestId) {
      throw new Error('Mismatched requestId in response envelope.');
    }

    if (response.conversationId !== request.conversationId) {
      throw new Error('Mismatched conversationId in response envelope.');
    }

    if (response.parentMessageId !== request.messageId) {
      throw new Error('Mismatched parentMessageId in response envelope.');
    }

    const blocks = response.blocks.length > 0
      ? response.blocks
      : [
          {
            type: 'error',
            message: 'Harness response did not include any renderable block.',
          } satisfies ChatBlock,
        ];

    return {
      ...response,
      blocks,
    };
  }
}
