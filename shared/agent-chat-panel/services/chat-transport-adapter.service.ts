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

    // Post-process: if harness returned a `surface` block, expose it as
    // `response.surface` for easier host consumption. Also accept a
    // leading `/form { ... }` text payload inside a text block and parse it
    // as a surface-like `formSpec` for backward compatibility.
    const out: any = { ...response, blocks };

    const surfaceBlock = blocks.find(b => (b as any).type === 'surface');
    if (surfaceBlock && (surfaceBlock as any).surface) {
      out.surface = (surfaceBlock as any).surface;
    } else {
      // inspect text blocks for `/form ` prefix
      for (const b of blocks) {
        if ((b as any).type === 'text' && typeof (b as any).text === 'string') {
          const txt = ((b as any).text).trim();
          if (txt.startsWith('/form')) {
            const payload = txt.slice('/form'.length).trim();
            try {
              const parsed = payload.startsWith('{') ? JSON.parse(payload) : null;
              if (parsed) out.surface = { type: 'form', formSpec: parsed };
            } catch {
              // ignore parse errors
            }
            break;
          }
        }
      }
    }

    return out as ChatResponse;
  }
}
