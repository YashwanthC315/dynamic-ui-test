import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ChatBlock, ChatRequest, ChatResponse } from './chat-contracts';

@Injectable({ providedIn: 'root' })
export class MockAgentHarnessService {
  send(request: ChatRequest): Observable<ChatResponse> {
    const lowerPrompt = request.prompt.toLowerCase();
    const blocks: ChatBlock[] = [
      {
        type: 'status',
        level: 'success',
        text: 'Request processed by mock harness.',
      },
    ];

    if (lowerPrompt.includes('help')) {
      blocks.push(
        {
          type: 'markdown',
          markdown: [
            'I can return typed blocks, quick actions, and data summaries.',
            '- Try: show overview',
            '- Try: open settings',
            '- Try: status summary',
          ].join('\n'),
        },
        {
          type: 'suggestions',
          items: [
            {
              id: 'help-1',
              label: 'Show overview',
              action: { id: 'a-help-1', label: 'Show overview', payload: { type: 'navigate', route: 'overview' } },
            },
            {
              id: 'help-2',
              label: 'Open settings',
              action: { id: 'a-help-2', label: 'Open settings', payload: { type: 'navigate', route: 'settings' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('show overview')) {
      blocks.push(
        { type: 'text', text: 'Navigating to overview view.' },
        {
          type: 'suggestions',
          items: [
            {
              id: 'board-1',
              label: 'Open overview',
              action: { id: 'a-board-1', label: 'Open overview', payload: { type: 'navigate', route: 'overview' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('open settings')) {
      blocks.push(
        {
          type: 'text',
          text: 'Opening settings.',
        },
        {
          type: 'suggestions',
          items: [
            {
              id: 'settings-1',
              label: 'Open settings',
              action: { id: 'a-settings-1', label: 'Open settings', payload: { type: 'navigate', route: 'settings' } },
            },
            {
              id: 'settings-2',
              label: 'Back to overview',
              action: { id: 'a-settings-2', label: 'Back to overview', payload: { type: 'navigate', route: 'overview' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('status summary')) {
      const appName = String(request.context.app['app'] ?? 'Unknown');
      const activeScreen = String(request.context.app['screen'] ?? 'Unknown');
      const contextKeys = Object.keys(request.context.host ?? {}).length;
      const catalogItems = Number(request.context.catalog?.itemCount ?? 0);

      blocks.push({
        type: 'data',
        items: [
          { key: 'App', value: appName },
          { key: 'Screen', value: activeScreen },
          { key: 'Host context keys', value: String(contextKeys) },
          { key: 'Catalog items', value: String(catalogItems) },
        ],
      });
    } else if (lowerPrompt.includes('simulate error')) {
      const failedResponse: ChatResponse = {
        schemaVersion: '1.0.0',
        requestId: request.requestId,
        conversationId: request.conversationId,
        messageId: `resp_${Date.now()}`,
        parentMessageId: request.messageId,
        agent: { id: 'mock-harness', displayName: 'Mock Harness Agent' },
        status: 'failed',
        blocks: [
          { type: 'error', message: 'Simulated transport-safe failure from harness.' },
        ],
        diagnostics: { traceId: `trace_${request.requestId}` },
      };

      return of(failedResponse).pipe(delay(550));
    } else {
      blocks.push(
        { type: 'text', text: 'Prompt delivered as-is to the harness. No local intent parsing was applied.' },
        {
          type: 'suggestions',
          items: [
            {
              id: 'generic-1',
              label: 'Help',
              action: { id: 'a-generic-1', label: 'Help', payload: { type: 'internal.prompt', prompt: 'help' } },
            },
            {
              id: 'generic-2',
              label: 'Status summary',
              action: { id: 'a-generic-2', label: 'Status summary', payload: { type: 'internal.prompt', prompt: 'status summary' } },
            },
          ],
        }
      );
    }

    const successResponse: ChatResponse = {
      schemaVersion: '1.0.0',
      requestId: request.requestId,
      conversationId: request.conversationId,
      messageId: `resp_${Date.now()}`,
      parentMessageId: request.messageId,
      agent: {
        id: 'mock-harness',
        displayName: 'Mock Harness Agent',
      },
      status: 'completed',
      blocks,
      diagnostics: {
        traceId: `trace_${request.requestId}`,
      },
    };

    return of(successResponse).pipe(delay(550));
  }
}
