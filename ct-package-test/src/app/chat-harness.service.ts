import { Injectable } from '@angular/core';

export interface HarnessChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface HarnessMessageBlock {
  type?: string;
  text?: string;
  markdown?: string;
  label?: string;
  items?: Array<{ label?: string }>;
}

interface HarnessAssistantResponse {
  type: 'assistant_response';
  conversationId?: string;
  messages?: HarnessMessageBlock[];
  actions?: Array<{ type?: string; route?: string }>;
  surface?: HarnessSurface;
}

interface HarnessErrorResponse {
  type: 'error';
  message?: string;
}

type HarnessFrame = HarnessAssistantResponse | HarnessErrorResponse;

export interface HarnessSurface {
  type?: string;
  id?: string;
  title?: string;
  formId?: string;
  submitAction?: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  schema?: { fields?: Array<Record<string, unknown>> };
  fields?: Array<Record<string, unknown>>;
  buddy?: { text?: string };
  activeRecordId?: string;
  records?: Array<Record<string, unknown>>;
  parse?: Record<string, unknown>;
}

// The checked-in mock-harness/config.json binds the local server to 8788.
// Keep this in one place so the host can be changed without touching the panel.
export const HARNESS_WS_URL = 'ws://localhost:8788';

@Injectable({ providedIn: 'root' })
export class ChatHarnessService {
  private socket: WebSocket | null = null;
  private connected = false;
  private pendingPrompts: Array<{ conversationId: string; messageId: string; text: string }> = [];
  private responseHandler: ((response: HarnessAssistantResponse) => void) | null = null;
  private errorHandler: ((message: string) => void) | null = null;

  connect(
    conversationId: string,
    onResponse: (response: HarnessAssistantResponse) => void,
    onError: (message: string) => void
  ): void {
    this.responseHandler = onResponse;
    this.errorHandler = onError;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const socket = new WebSocket(HARNESS_WS_URL);
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.connected = true;
        this.send({
          type: 'hello',
          conversationId,
          hostProtocolVersion: '1.0',
          capabilities: ['dynamicForms', 'buddyMount']
        });
        this.flushPending();
      });
      socket.addEventListener('message', (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as HarnessFrame;
          if (frame.type === 'assistant_response') {
            this.responseHandler?.(frame);
          } else if (frame.type === 'error') {
            this.errorHandler?.(frame.message || 'The harness rejected the request.');
          }
        } catch {
          this.errorHandler?.('The harness returned an invalid response.');
        }
      });
      socket.addEventListener('error', () => {
        this.connected = false;
        this.errorHandler?.(`Unable to connect to the mock harness at ${HARNESS_WS_URL}.`);
      });
      socket.addEventListener('close', () => {
        this.connected = false;
        this.socket = null;
      });
    } catch {
      this.errorHandler?.(`Unable to connect to the mock harness at ${HARNESS_WS_URL}.`);
    }
  }

  sendPrompt(conversationId: string, messageId: string, text: string, onError: (message: string) => void): void {
    const request = { type: 'user_message', conversationId, messageId, text, context: { route: '/home' } };
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingPrompts.push({ conversationId, messageId, text });
      this.connect(conversationId, this.responseHandler || (() => undefined), this.errorHandler || onError);
      return;
    }
    this.send(request);
  }

  sendEvent(conversationId: string, event: string, values: Record<string, unknown>, onError: (message: string) => void): void {
    const payload = {
      type: 'emit_event',
      conversationId,
      event,
      action: typeof values['action'] === 'string'
        ? values['action']
        : (typeof values['submitAction'] === 'string' ? values['submitAction'] : undefined),
      correlationId: typeof values['correlationId'] === 'string' ? values['correlationId'] : undefined,
      values
    };
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      onError('The harness is not connected; the form event was not submitted.');
      return;
    }
    this.send(payload);
  }

  close(): void {
    this.pendingPrompts = [];
    this.socket?.close();
    this.socket = null;
    this.connected = false;
  }

  private flushPending(): void {
    const pending = this.pendingPrompts.splice(0);
    for (const prompt of pending) {
      if (this.connected && this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'user_message', ...prompt });
      }
    }
  }

  private send(payload: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify(payload));
  }
}
