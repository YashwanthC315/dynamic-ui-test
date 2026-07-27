import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ChatAction,
  ChatBlock,
  ChatContext,
  ChatRequest,
  ChatResponse,
  ChatResponseStatus,
  ChatSuggestionAction,
} from '../services/chat-contracts';
import { ChatTransportAdapterService } from '../services/chat-transport-adapter.service';

interface ChatEntity {
  id: string;
  label?: string;
  [key: string]: unknown;
}

type MessageRole = 'assistant' | 'user' | 'system' | 'error';

interface ConversationMessage {
  id: string;
  role: MessageRole;
  blocks: ChatBlock[];
  timestamp: string;
  status?: ChatResponseStatus;
  requestId?: string;
  userMessageId?: string;
}

@Component({
  selector: 'app-agent-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-chat-panel.component.html',
})
export class AgentChatPanelComponent implements AfterViewChecked, OnInit {
  @Input() isOpen = false;
  @Input() appContext: Record<string, unknown> | null = null;
  @Input() hostContext: Record<string, unknown> | null = null;
  @Input() feeContext: Record<string, unknown> | null = null;
  @Input() entities: ChatEntity[] = [];
  @Input() students: Array<Record<string, unknown>> = [];

  @Output() agentEvent = new EventEmitter<Record<string, unknown>>();
  @Output() status = new EventEmitter<string>();

  @ViewChild('messagesRef') messagesRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composerRef') composerRef?: ElementRef<HTMLTextAreaElement>;

  messages: ConversationMessage[] = [];
  inputValue = '';
  panelWidth = 380;
  charLimit = 2000;

  conversationId = this.createId('conv');
  inFlightRequestId: string | null = null;
  activeRequestSub: Subscription | null = null;
  canRetryRequestId: string | null = null;

  private activeRequests = new Map<
    string,
    {
      request: ChatRequest;
      assistantMessageId: string;
      userMessageId: string;
    }
  >();

  private lastMessageCount = 0;
  private dragging = false;
  private startX = 0;
  private startWidth = 380;

  constructor(private readonly transportAdapter: ChatTransportAdapterService) {}

  ngOnInit(): void {
    this.messages = [
      {
        id: this.createId('msg_intro'),
        role: 'assistant',
        blocks: [
          {
            type: 'text',
            text: `Agent connected for ${this.contextLabel}. Type your request and I will send it to the harness unchanged.`,
          },
          {
            type: 'suggestions',
            items: [
              {
                id: 's1',
                label: 'Show overview',
                action: { id: 'a1', label: 'Show overview', payload: { type: 'navigate', route: 'overview' } },
              },
              {
                id: 's2',
                label: 'Open help',
                action: { id: 'a2', label: 'Open help', payload: { type: 'open_help_center' } },
              },
            ],
          },
        ],
        timestamp: new Date().toISOString(),
        status: 'completed',
      },
    ];
  }

  ngAfterViewChecked(): void {
    if (this.messages.length !== this.lastMessageCount) {
      this.lastMessageCount = this.messages.length;
      this.scrollToBottomSoon();
    }
  }

  get contextLabel(): string {
    const app = String(this.appContext?.['app'] ?? 'Application');
    const screen = String(this.appContext?.['screen'] ?? 'current-screen');
    return `${app} / ${screen}`;
  }

  get contextTabDetail(): string | null {
    const screen = String(this.appContext?.['screen'] ?? 'current-screen');
    if (screen === 'current-screen') {
      return null;
    }

    const tab = this.appContext?.['tab'];
    return tab ? String(tab) : null;
  }

  get isPending(): boolean {
    return this.inFlightRequestId !== null;
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.shiftKey || event.altKey) {
      return;
    }

    if (event.ctrlKey || event.metaKey || (!event.shiftKey && !event.altKey)) {
      event.preventDefault();
      this.send();
    }
  }

  startResize(event: MouseEvent): void {
    this.dragging = true;
    this.startX = event.clientX;
    this.startWidth = this.panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (e: MouseEvent) => {
      if (!this.dragging) {
        return;
      }
      const deltaX = e.clientX - this.startX;
      const nextWidth = this.startWidth + deltaX;
      this.panelWidth = Math.max(300, Math.min(700, nextWidth));
    };

    const up = () => {
      this.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  send(): void {
    if (this.inFlightRequestId) {
      return;
    }

    const rawPrompt = this.inputValue;
    const trimmedForValidation = rawPrompt.trim();
    if (!trimmedForValidation) {
      return;
    }

    if (rawPrompt.length > this.charLimit) {
      this.appendSystemMessage([{ type: 'error', message: `Message exceeds ${this.charLimit} characters. Please shorten and try again.` }]);
      return;
    }

    const messageId = this.appendUser(rawPrompt);
    const request = this.buildRequest(rawPrompt, messageId);
    this.dispatchRequest(request);
    this.inputValue = '';
    this.scrollToBottomSoon();
  }

  cancelActiveRequest(): void {
    if (!this.inFlightRequestId) {
      return;
    }

    const requestId = this.inFlightRequestId;
    this.activeRequestSub?.unsubscribe();
    this.activeRequestSub = null;
    this.inFlightRequestId = null;

    const tracked = this.activeRequests.get(requestId);
    if (tracked) {
      this.patchMessage(tracked.assistantMessageId, {
        status: 'cancelled',
        blocks: [
          { type: 'status', level: 'info', text: 'Request cancelled.' },
          this.retrySuggestionBlock(requestId),
        ],
      });
      this.canRetryRequestId = requestId;
    }

    this.status.emit('Request cancelled.');
    this.restoreComposerFocus();
  }

  retryLastFailed(): void {
    if (!this.canRetryRequestId || this.inFlightRequestId) {
      return;
    }

    const tracked = this.activeRequests.get(this.canRetryRequestId);
    if (!tracked) {
      return;
    }

    this.dispatchRequest(tracked.request, true);
  }

  runSuggestion(action: ChatSuggestionAction): void {
    this.runAction(action.action);
  }

  runAction(action: ChatAction): void {
    const payload = action.payload;
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const content = payload as Record<string, unknown>;
    const type = String(content.type ?? '');
    if (type === 'internal.retry') {
      this.retryLastFailed();
      return;
    }

    if (type === 'internal.prompt') {
      const prompt = String(content.prompt ?? '');
      if (!prompt || this.inFlightRequestId) {
        return;
      }
      this.inputValue = prompt;
      this.send();
      return;
    }

    this.agentEvent.emit(content);
  }

  isSubmitDisabled(): boolean {
    return this.inFlightRequestId !== null || this.inputValue.trim().length === 0;
  }

  trackByMessage(_: number, item: ConversationMessage): string {
    return item.id;
  }

  trackByBlock(index: number): number {
    return index;
  }

  getBlockText(block: ChatBlock): string {
    return block.text ?? '';
  }

  getBlockMarkdown(block: ChatBlock): string {
    return block.markdown ?? '';
  }

  getBlockMessage(block: ChatBlock): string {
    return block.message ?? 'Unknown response block.';
  }

  getBlockLabel(block: ChatBlock): string {
    return block.label ?? 'Open link';
  }

  getBlockHref(block: ChatBlock): string {
    return block.href ?? '#';
  }

  getDataItems(block: ChatBlock): Array<{ key: string; value: string }> {
    if (!Array.isArray(block.items)) {
      return [];
    }

    return block.items.filter((item): item is { key: string; value: string } => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as Record<string, unknown>;
      return typeof candidate.key === 'string' && typeof candidate.value === 'string';
    });
  }

  getSuggestionItems(block: ChatBlock): ChatSuggestionAction[] {
    if (!Array.isArray(block.items)) {
      return [];
    }

    return block.items.filter((item): item is ChatSuggestionAction => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as Record<string, unknown>;
      return typeof candidate.label === 'string' && typeof candidate.id === 'string' && typeof candidate.action === 'object';
    });
  }

  private dispatchRequest(request: ChatRequest, isRetry = false): void {
    if (this.inFlightRequestId) {
      return;
    }

    const tracked = this.activeRequests.get(request.requestId);
    let assistantMessageId = tracked?.assistantMessageId;
    const userMessageId = tracked?.userMessageId ?? request.messageId;

    if (!assistantMessageId) {
      assistantMessageId = this.appendAssistant(
        [
          { type: 'status', level: 'info', text: 'Sending request to agent...' },
          { type: 'status', level: 'loading', text: 'Waiting for response...' },
        ],
        'completed',
        request.requestId,
        request.messageId
      );
    } else {
      this.patchMessage(assistantMessageId, {
        status: 'completed',
        blocks: [
          { type: 'status', level: 'info', text: 'Retrying previous request...' },
          { type: 'status', level: 'loading', text: 'Waiting for response...' },
        ],
      });
    }

    this.activeRequests.set(request.requestId, { request, assistantMessageId, userMessageId });
    this.inFlightRequestId = request.requestId;
    this.canRetryRequestId = null;
    this.status.emit(isRetry ? 'Retry started.' : 'Message submitted to agent.');

    this.activeRequestSub = this.transportAdapter.send(request).subscribe({
      next: (response) => this.handleResponse(response),
      error: (error) => {
        const details = error instanceof Error ? error.message : 'Unknown transport error.';
        this.handleTransportError(request.requestId, details);
      },
    });
  }

  private handleResponse(response: ChatResponse): void {
    const requestId = response.requestId;
    const tracked = this.activeRequests.get(requestId);
    if (!tracked) {
      return;
    }

    this.activeRequestSub = null;
    this.inFlightRequestId = null;

    const safeBlocks = this.ensureRenderableBlocks(response.blocks);
    this.patchMessage(tracked.assistantMessageId, {
      status: response.status,
      blocks: response.status === 'completed' ? safeBlocks : [...safeBlocks, this.retrySuggestionBlock(requestId)],
      timestamp: new Date().toISOString(),
    });

    if (response.status !== 'completed') {
      this.canRetryRequestId = requestId;
    }

    if (response.actions?.length) {
      for (const action of response.actions) {
        this.runAction(action);
      }
    }

    if (response.contextPatch) {
      this.agentEvent.emit({
        type: 'chat_context_patch',
        patch: response.contextPatch,
        requestId: response.requestId,
      });
    }

    this.status.emit(`Agent response ${response.status}.`);
    this.restoreComposerFocus();
  }

  private handleTransportError(requestId: string, details: string): void {
    const tracked = this.activeRequests.get(requestId);
    if (!tracked) {
      return;
    }

    this.activeRequestSub = null;
    this.inFlightRequestId = null;
    this.canRetryRequestId = requestId;

    this.patchMessage(tracked.assistantMessageId, {
      status: 'failed',
      blocks: [
        {
          type: 'error',
          message: 'The request failed before receiving a valid response envelope.',
          details,
        },
        this.retrySuggestionBlock(requestId),
      ],
      timestamp: new Date().toISOString(),
    });

    this.status.emit('Transport error. You can retry the last request.');
    this.restoreComposerFocus();
  }

  private retrySuggestionBlock(requestId: string): ChatBlock {
    return {
      type: 'suggestions',
      items: [
        {
          id: `retry_${requestId}`,
          label: 'Retry',
          action: { id: `retry_action_${requestId}`, label: 'Retry', payload: { type: 'internal.retry', requestId } },
        },
      ],
    };
  }

  private patchMessage(messageId: string, patch: Partial<ConversationMessage>): void {
    const index = this.messages.findIndex((message) => message.id === messageId);
    if (index < 0) {
      return;
    }

    this.messages[index] = {
      ...this.messages[index],
      ...patch,
    };
    this.scrollToBottomSoon();
  }

  private appendUser(text: string): string {
    const id = this.createId('msg_user');
    this.messages.push({
      id,
      role: 'user',
      blocks: [{ type: 'text', text }],
      timestamp: new Date().toISOString(),
      status: 'completed',
    });
    this.scrollToBottomSoon();
    return id;
  }

  private appendAssistant(
    blocks: ChatBlock[],
    status: ChatResponseStatus = 'completed',
    requestId?: string,
    userMessageId?: string
  ): string {
    const id = this.createId('msg_assistant');
    this.messages.push({
      id,
      role: 'assistant',
      blocks,
      timestamp: new Date().toISOString(),
      status,
      requestId,
      userMessageId,
    });
    this.scrollToBottomSoon();
    return id;
  }

  private appendSystemMessage(blocks: ChatBlock[]): void {
    this.messages.push({
      id: this.createId('msg_system'),
      role: 'system',
      blocks,
      timestamp: new Date().toISOString(),
      status: 'completed',
    });
    this.scrollToBottomSoon();
  }

  private ensureRenderableBlocks(blocks: ChatBlock[]): ChatBlock[] {
    return blocks.map((block) => {
      if (this.isKnownBlockType(block.type)) {
        return block;
      }

      return {
        type: 'error',
        message: `Unsupported block type: ${String(block.type)}.`,
      };
    });
  }

  private isKnownBlockType(type: string): boolean {
    return ['text', 'markdown', 'status', 'data', 'suggestions', 'form', 'link', 'error'].includes(type);
  }

  private buildRequest(prompt: string, messageId: string): ChatRequest {
    const appName = String(this.appContext?.['app'] ?? 'web-host');
    const normalizedAppId = appName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '') || 'web-host';

    return {
      schemaVersion: '1.0.0',
      requestId: this.createId('req'),
      conversationId: this.conversationId,
      messageId,
      prompt,
      context: this.buildContextSnapshot(),
      capabilities: [
        'blocks.text',
        'blocks.markdown',
        'blocks.status',
        'blocks.data',
        'blocks.suggestions',
        'blocks.link',
        'blocks.error',
      ],
      client: {
        appId: normalizedAppId,
        appVersion: 'ui-shared-1',
        locale: 'en',
      },
    };
  }

  private buildContextSnapshot(): ChatContext {
    const hostPayload = this.hostContext ?? this.feeContext;

    return {
      app: this.sanitizeContext(this.appContext),
      host: this.sanitizeContext(hostPayload),
      catalog: {
        itemCount: this.entities.length || this.students.length,
      },
    };
  }

  private sanitizeContext(input: Record<string, unknown> | null): Record<string, unknown> {
    if (!input) {
      return {};
    }

    const clone = { ...input };
    const secretLikeKeys = ['password', 'secret', 'token', 'apikey', 'auth'];
    for (const key of Object.keys(clone)) {
      const normalizedKey = key.toLowerCase();
      if (secretLikeKeys.some((entry) => normalizedKey.includes(entry))) {
        delete clone[key];
      }
    }
    return clone;
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private restoreComposerFocus(): void {
    const active = document.activeElement;
    const activeIsMessageArea = active === document.body || active === this.messagesRef?.nativeElement;
    if (activeIsMessageArea) {
      this.composerRef?.nativeElement.focus();
    }
  }

  private scrollToBottomSoon(): void {
    queueMicrotask(() => {
      const el = this.messagesRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });

    requestAnimationFrame(() => {
      const el = this.messagesRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
