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
            '- Try: show board',
            '- Try: open fee collection',
            '- Try: status summary',
          ].join('\n'),
        },
        {
          type: 'suggestions',
          items: [
            {
              id: 'help-1',
              label: 'Show board',
              action: { id: 'a-help-1', label: 'Show board', payload: { type: 'navigate', page: 'dashboard' } },
            },
            {
              id: 'help-2',
              label: 'Open fee collection',
              action: { id: 'a-help-2', label: 'Open fee collection', payload: { type: 'switch_tab', page: 'fees', tab: 'collection' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('show board')) {
      blocks.push(
        { type: 'text', text: 'Navigating to dashboard board view.' },
        {
          type: 'suggestions',
          items: [
            {
              id: 'board-1',
              label: 'Open dashboard',
              action: { id: 'a-board-1', label: 'Open dashboard', payload: { type: 'navigate', page: 'dashboard' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('open fee collection')) {
      blocks.push(
        {
          type: 'text',
          text: 'Opening the fee collection tab and pending fee view.',
        },
        {
          type: 'suggestions',
          items: [
            {
              id: 'fees-1',
              label: 'Open fee collection',
              action: { id: 'a-fees-1', label: 'Open fee collection', payload: { type: 'switch_tab', page: 'fees', tab: 'collection' } },
            },
            {
              id: 'fees-2',
              label: 'Show pending rows',
              action: { id: 'a-fees-2', label: 'Show pending rows', payload: { type: 'switch_fee_view', view: 'pending' } },
            },
          ],
        }
      );
    } else if (lowerPrompt.includes('status summary')) {
      const selectedStudent = String(request.context.fee['selectedStudentName'] ?? 'None');
      const selectedCount = Number(request.context.fee['selectedPendingCount'] ?? 0);
      const amount = String(request.context.fee['amount'] ?? '0');

      blocks.push({
        type: 'data',
        items: [
          { key: 'Selected student', value: selectedStudent },
          { key: 'Selected pending count', value: String(selectedCount) },
          { key: 'Entered amount', value: amount },
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
