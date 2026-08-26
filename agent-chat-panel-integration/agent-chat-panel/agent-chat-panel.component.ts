import {
  AfterViewChecked,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  AgentSurface,
  ChatAction,
  ChatBlock,
  ChatContext,
  ChatEmitEventRequest,
  ChatRequest,
  ChatResponse,
  ChatResponseStatus,
  ChatSuggestionAction,
  ConversationDetailResponse,
  ConversationMessage,
  ConversationSummary,
  PersistedConversationMessage,
} from './chat.contracts';
import {
  AGENT_CHAT_RESPONSE_PORT,
  AGENT_CHAT_STATE_PORT,
  AGENT_CHAT_SURFACE_PLUGINS,
  AgentChatResponsePort,
  AgentChatStatePort,
  AgentChatSurfacePluginPort,
} from './agent-chat-port.contracts';

/** Entity/record the host app wants the panel to know about for context, e.g. "current customer". */
export interface ChatEntity {
  id: string;
  label?: string;
  [key: string]: unknown;
}

/** A one-tap starter prompt shown on a fresh conversation. Fully host-defined - no built-in content. */
export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

@Component({
  selector: 'app-agent-chat-panel',
  templateUrl: './agent-chat-panel.component.html',
  styleUrls: ['./agent-chat-panel.component.css'],
})
export class AgentChatPanelComponent implements AfterViewChecked, OnInit, OnDestroy {
  /** Controls visibility. Bind this to whatever toggles your chat button/drawer. */
  @Input() isOpen = false;

  /** Identifies this frontend to the backend, e.g. 'admin-portal'. Sent as client.appId. */
  @Input() appId = 'web-app';
  /** Optional free-text app/screen info sent to the backend as context.app. Never put secrets here. */
  @Input() appContext: Record<string, unknown> | null = null;
  /** Optional free-text host/session info sent to the backend as context.host. Never put secrets here. */
  @Input() hostContext: Record<string, unknown> | null = null;
  /** Optional records the backend may want to reason about (e.g. "the 3 rows currently on screen"). */
  @Input() entities: ChatEntity[] = [];

  /** One-tap prompts shown on a new conversation. Leave empty to show just the greeting. */
  @Input() quickActions: QuickAction[] = [];
  /** Optional in-app navigation menu the assistant can offer to jump to (used by the built-in 'list_tabs' action). */
  @Input() navigationTabs: Array<{ name?: string; route?: string }> = [];
  /**
   * Internal hrefs the panel is allowed to navigate to or render as link blocks.
   * Anything not in this list is silently ignored - this is a safety allowlist,
   * not a UI concern, so keep it as tight as your app needs.
   */
  @Input() allowedNavigationHrefs: string[] = [];

  /** Greeting shown at the top of a new conversation. */
  @Input() greeting = "I'm ready to help. Tell me what you need.";
  @Input() charLimit = 2000;
  @Input() initialWidth = 380;
  /** localStorage key prefix used to remember the last active conversation across reloads. */
  @Input() storageKeyPrefix = 'agent-chat';

  /** Fires for any action payload the panel doesn't handle itself (see README "Action payload types"). */
  @Output() agentEvent = new EventEmitter<Record<string, unknown>>();
  @Output() status = new EventEmitter<string>();
  @Output() panelWidthChange = new EventEmitter<number>();

  @ViewChild('messagesRef') messagesRef: ElementRef<HTMLDivElement> | null = null;
  @ViewChild('searchRef') searchRef: ElementRef<HTMLInputElement> | null = null;
  @ViewChild('composerRef') composerRef: ElementRef<HTMLTextAreaElement> | null = null;
  @ViewChild('panelRoot') panelRoot: ElementRef<HTMLElement> | null = null;
  @ViewChild('rightPanelContainer', { read: ViewContainerRef }) rightPanelContainer: ViewContainerRef | null = null;

  messages: ConversationMessage[] = [];
  inputValue = '';
  panelWidth = 380;
  readonly inFlightStatusText = 'Thinking...';
  currentAgentDisplay: string | null = null;
  isSearchOpen = false;
  searchTerm = '';
  isHistoryOpen = false;
  chatHistory: ConversationSummary[] = [];
  rightPanelVisible = false;
  rightPanelTitle = 'Details';
  rightPanelComputedWidth = 380;
  rightPanelComputedHeight = 0;
  rightPanelLeft = 0;
  rightPanelTop = 0;

  private rightPanelComponentRef: ComponentRef<any> | null = null;
  private activeSurfaceSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private lastNavigationUrl: string | null = null;

  conversationId = this.createId('conv');
  inFlightRequestId: string | null = null;
  canRetryRequestId: string | null = null;

  private activeRequests = new Map<
    string,
    {
      request: ChatRequest;
      requestType: 'user_message' | 'emit_event';
      assistantMessageId: string;
      userMessageId: string;
    }
  >();

  private lastMessageCount = 0;
  private dragging = false;
  private startX = 0;
  private startWidth = 380;
  private readonly submittedForms: Record<string, boolean> = {};
  private readonly actedConfirmations: Record<string, boolean> = {};
  private readonly formDraftValues: Record<string, Record<string, unknown>> = {};
  private readonly hiddenSuggestionMessageIds: Record<string, boolean> = {};

  constructor(
    @Inject(AGENT_CHAT_STATE_PORT) private readonly chatStatePort: AgentChatStatePort,
    @Inject(AGENT_CHAT_RESPONSE_PORT) private readonly chatResponsePort: AgentChatResponsePort,
    private readonly router: Router,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    @Optional() @Inject(AGENT_CHAT_SURFACE_PLUGINS) surfacePlugins: AgentChatSurfacePluginPort[] | null
  ) {
    this.surfacePlugins = Array.isArray(surfacePlugins) ? surfacePlugins.slice() : [];
  }

  private readonly surfacePlugins: AgentChatSurfacePluginPort[];

  ngOnInit(): void {
    this.panelWidth = this.initialWidth;
    this.startWidth = this.initialWidth;

    this.messages = [this.createIntroMessage()];
    this.chatStatePort.setMessages(this.messages);
    this.chatStatePort.setConversationId(this.conversationId);

    this.chatStatePort.messages$.subscribe((msgs) => {
      if (!msgs) { return; }
      if (msgs.length !== this.messages.length) {
        this.messages = msgs.slice();
        this.scrollToBottomSoon();
      }
    });

    this.chatStatePort.conversationList$.subscribe((list) => {
      if (!Array.isArray(list)) { return; }
      this.chatHistory = list;
    });

    this.chatStatePort.conversationId$.subscribe((id) => {
      if (id) {
        this.conversationId = id;
        this.setActiveConversationId(id);
      }
    });

    this.chatResponsePort.responses$.subscribe((response) => this.handleResponse(response));
    this.chatResponsePort.transportErrors$.subscribe(({ requestId, details }) => this.handleTransportError(requestId, details));

    this.activeSurfaceSub = this.chatStatePort.activeSurface$.subscribe((surface: AgentSurface | null) => {
      if (!surface) {
        this.closeRightPanel();
        return;
      }
      if (!this.tryRenderSurface(surface)) {
        this.closeRightPanel();
      }
    });

    this.lastNavigationUrl = this.router.url;
    this.routerSub = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) { return; }
      if (event.urlAfterRedirects === this.lastNavigationUrl) { return; }
      this.lastNavigationUrl = event.urlAfterRedirects;
      this.closeRightPanel();
    });

    this.chatStatePort.loadConversations(true);
  }

  ngOnDestroy(): void {
    if (this.activeSurfaceSub) { this.activeSurfaceSub.unsubscribe(); this.activeSurfaceSub = null; }
    if (this.routerSub) { this.routerSub.unsubscribe(); this.routerSub = null; }
  }

  ngAfterViewChecked(): void {
    if (this.messages.length !== this.lastMessageCount) {
      this.lastMessageCount = this.messages.length;
      this.scrollToBottomSoon();
    }
  }

  // ---------------------------------------------------------------------
  // New chat / history / search
  // ---------------------------------------------------------------------

  startNewChat(): void {
    if (this.inFlightRequestId) {
      this.cancelActiveRequest();
    }
    this.activeRequests.clear();
    this.clearRecord(this.hiddenSuggestionMessageIds);
    this.canRetryRequestId = null;
    this.conversationId = this.createId('conv');
    this.messages = [this.createIntroMessage()];
    this.chatStatePort.setMessages(this.messages);
    this.chatStatePort.setConversationId(this.conversationId);
    this.setActiveConversationId(this.conversationId);
    this.clearInteractiveState();
    this.closeRightPanel();
    this.lastMessageCount = 0;
    this.inputValue = '';
    this.clearSearch();
    this.isHistoryOpen = false;
    this.chatStatePort.clearSurface();
    this.chatStatePort.createConversation(this.conversationId, 'New chat');
    this.restoreComposerFocus();
  }

  get filteredMessages(): ConversationMessage[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) { return this.messages; }
    return this.messages.filter((message) => {
      const searchableText = message.blocks
        .map((block) => [block.text, block.markdown, block.message, block.label, block.details].filter(Boolean).join(' '))
        .join(' ')
        .toLowerCase();
      return searchableText.indexOf(term) >= 0;
    });
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
    if (!this.isSearchOpen) { this.clearSearch(); return; }
    setTimeout(() => { if (this.searchRef) { this.searchRef.nativeElement.focus(); } });
  }

  clearSearch(): void { this.searchTerm = ''; }

  toggleHistory(): void {
    this.isHistoryOpen = !this.isHistoryOpen;
    if (this.isHistoryOpen) {
      this.isSearchOpen = false;
      this.clearSearch();
      this.chatStatePort.loadConversations(false);
    }
  }

  getHistoryTitle(item: ConversationSummary): string {
    return item.title || 'Untitled chat';
  }

  restoreConversation(item: ConversationSummary): void {
    if (this.inFlightRequestId) { this.cancelActiveRequest(); }
    const result = this.chatStatePort.restoreConversationById(item.id);
    if (result && typeof (result as any).subscribe === 'function') {
      (result as any).subscribe((conversation: ConversationDetailResponse) => this.applyRestoredConversation(conversation));
    }
    // If your AgentChatStatePort pushes the restored conversation through
    // messages$/conversationId$ instead of returning an Observable, that
    // works too - the subscriptions set up in ngOnInit will pick it up.
  }

  // ---------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------

  get isPending(): boolean {
    return this.inFlightRequestId !== null;
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey) { return; }
    event.preventDefault();
    this.send();
  }

  isSubmitDisabled(): boolean {
    return this.inFlightRequestId !== null || this.inputValue.trim().length === 0;
  }

  send(): void {
    if (this.inFlightRequestId) { return; }
    const rawPrompt = this.inputValue;
    if (!rawPrompt.trim()) { return; }

    if (rawPrompt.length > this.charLimit) {
      this.appendSystemMessage([{ type: 'error', message: `Message exceeds ${this.charLimit} characters. Please shorten and try again.` }]);
      return;
    }

    this.hideSuggestionLinks();
    const messageId = this.appendUser(rawPrompt);
    const request = this.buildRequest(rawPrompt, messageId);
    this.dispatchRequest(request);
    this.inputValue = '';
    this.scrollToBottomSoon();
  }

  cancelActiveRequest(): void {
    if (!this.inFlightRequestId) { return; }
    const requestId = this.inFlightRequestId;
    this.inFlightRequestId = null;
    this.chatStatePort.cancelRequest(requestId);
    this.chatStatePort.setStatus('idle');
    this.chatStatePort.setActiveRequestId(null);

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
    if (!this.canRetryRequestId || this.inFlightRequestId) { return; }
    const tracked = this.activeRequests.get(this.canRetryRequestId);
    if (!tracked || tracked.requestType !== 'user_message') { return; }
    this.dispatchRequest(tracked.request, true);
  }

  // ---------------------------------------------------------------------
  // Suggestions / actions
  // ---------------------------------------------------------------------

  runSuggestion(action: ChatSuggestionAction): void {
    if (action.action && action.action.payload && action.action.payload['type'] === 'navigate') {
      // fall through - runAction() handles navigation itself
    }
    this.hideSuggestionLinks();
    this.runAction(action.action);
  }

  /**
   * Built-in action payload types: 'internal.retry', 'internal.prompt',
   * 'navigate', 'list_tabs', 'show_quick_actions'. Anything else is
   * forwarded to the host app via (agentEvent) - see README.
   */
  runAction(action: ChatAction): void {
    const payload = action.payload;
    if (!payload || typeof payload !== 'object') { return; }
    const content = payload as Record<string, unknown>;
    const type = String(content.type || '');

    if (type === 'internal.retry') {
      this.retryLastFailed();
      return;
    }

    if (type === 'internal.prompt') {
      const prompt = String(content.prompt || '');
      if (!prompt || this.inFlightRequestId) { return; }
      this.inputValue = prompt;
      this.send();
      return;
    }

    if (type === 'navigate') {
      const href = typeof content.href === 'string' ? content.href.trim() : String(content.route || '').trim();
      if (!this.isAllowlistedInternalHref(href)) {
        console.warn('[agent-chat] Ignoring navigate action outside allowedNavigationHrefs:', href);
        return;
      }
      this.chatStatePort.navigate(this.normalizeInternalHref(href));
      return;
    }

    if (type === 'list_tabs') {
      this.showNavigationTabs();
      return;
    }

    if (type === 'show_quick_actions') {
      this.showQuickActions();
      return;
    }

    // Anything else (e.g. a domain action like 'change_state', 'open_record')
    // is the host app's business, not the panel's.
    this.agentEvent.emit(content);
  }

  private showNavigationTabs(): void {
    const tabs = this.navigationTabs
      .filter((tab) => !!tab && !!tab.name && !!tab.route)
      .map((tab, index) => ({
        id: `navigation_tab_${index}`,
        label: String(tab.name),
        action: {
          id: `navigate_to_${index}`,
          label: String(tab.name),
          payload: { type: 'internal.prompt', prompt: `open ${String(tab.name)}` },
        },
      }));

    this.appendAssistant(
      tabs.length
        ? [{ type: 'text', text: 'Choose a tab to open:' }, { type: 'suggestions', items: tabs }]
        : [{ type: 'text', text: 'No navigation tabs are configured.' }]
    );
  }

  private showQuickActions(): void {
    if (!this.quickActions.length) {
      this.appendAssistant([{ type: 'text', text: 'No quick actions are configured.' }]);
      return;
    }
    const items: ChatSuggestionAction[] = this.quickActions.map((qa) => ({
      id: qa.id,
      label: qa.label,
      action: { id: `qa_${qa.id}`, label: qa.label, payload: { type: 'internal.prompt', prompt: qa.prompt } },
    }));
    this.appendAssistant([{ type: 'text', text: 'Here are some things I can help with:' }, { type: 'suggestions', items }]);
  }

  // ---------------------------------------------------------------------
  // Forms / confirmations
  // ---------------------------------------------------------------------

  isSuggestionHidden(message: ConversationMessage): boolean {
    return !!this.hiddenSuggestionMessageIds[message.id];
  }

  isFormSubmitted(message: ConversationMessage, blockIndex: number): boolean {
    return this.submittedForms[this.blockKey(message, blockIndex)] === true;
  }

  isConfirmationActed(message: ConversationMessage, blockIndex: number): boolean {
    return this.actedConfirmations[this.blockKey(message, blockIndex)] === true;
  }

  getFormFieldValue(message: ConversationMessage, blockIndex: number, fieldId: string): any {
    const draft = this.formDraftValues[this.blockKey(message, blockIndex)] || {};
    return draft[fieldId];
  }

  setFormFieldValue(message: ConversationMessage, blockIndex: number, fieldId: string, value: any): void {
    const key = this.blockKey(message, blockIndex);
    if (!this.formDraftValues[key]) { this.formDraftValues[key] = {}; }
    this.formDraftValues[key][fieldId] = value;
  }

  submitFormBlock(message: ConversationMessage, block: ChatBlock, blockIndex: number): void {
    const correlationId = String(block.correlationId || '');
    const action = String(block.submitAction || '');
    if (!correlationId || !action || this.inFlightRequestId || this.isFormSubmitted(message, blockIndex)) { return; }

    const values = this.buildFormValues(message, block, blockIndex);
    const validationError = this.validateFormValues(block, values);
    if (validationError) {
      this.appendSystemMessage([{ type: 'error', message: validationError }]);
      return;
    }

    this.submittedForms[this.blockKey(message, blockIndex)] = true;
    this.dispatchEmitEvent({
      requestId: this.createId('req'),
      messageId: this.createId('msg_event'),
      conversationId: this.conversationId,
      correlationId,
      event: 'form_submit',
      action,
      values,
      context: this.buildHostEventContext(),
    });
  }

  confirmBlockAction(message: ConversationMessage, block: ChatBlock, blockIndex: number, confirm: boolean): void {
    const correlationId = String(block.correlationId || '');
    const action = confirm ? String(block.confirmAction || '') : String(block.cancelAction || '');
    if (!correlationId || !action || this.inFlightRequestId || this.isConfirmationActed(message, blockIndex)) { return; }

    this.actedConfirmations[this.blockKey(message, blockIndex)] = true;
    this.dispatchEmitEvent({
      requestId: this.createId('req'),
      messageId: this.createId('msg_event'),
      conversationId: this.conversationId,
      correlationId,
      event: confirm ? 'confirm' : 'cancel',
      action,
      values: {},
      context: this.buildHostEventContext(),
    });
  }

  // ---------------------------------------------------------------------
  // Block rendering helpers (used by the template)
  // ---------------------------------------------------------------------

  trackByMessage(_: number, item: ConversationMessage): string { return item.id; }
  trackByBlock(index: number): number { return index; }

  getBlockText(block: ChatBlock): string { return block.text || ''; }
  getBlockMarkdown(block: ChatBlock): string { return block.markdown || ''; }
  getBlockMessage(block: ChatBlock): string { return block.message || 'Unknown response block.'; }
  getBlockLabel(block: ChatBlock): string { return block.label || 'Open link'; }

  getDataItems(block: ChatBlock): Array<{ key: string; value: string }> {
    if (!Array.isArray(block.items)) { return []; }
    return (block.items as any[]).filter(
      (item): item is { key: string; value: string } =>
        !!item && typeof item === 'object' && typeof item.key === 'string' && typeof item.value === 'string'
    );
  }

  getSuggestionItems(block: ChatBlock): ChatSuggestionAction[] {
    if (!Array.isArray(block.items)) { return []; }
    return (block.items as any[]).filter(
      (item): item is ChatSuggestionAction =>
        !!item && typeof item === 'object' && typeof item.label === 'string' && typeof item.id === 'string' && typeof item.action === 'object'
    );
  }

  /**
   * Shows an arrow icon next to a suggestion when clicking it is expected to
   * open the right-hand surface panel. Driven entirely by data from the
   * backend (`payload.opensSurface === true`) - no hardcoded prompt matching.
   */
  showsDynamicSurfaceHint(action: ChatSuggestionAction): boolean {
    const payload = action && action.action && action.action.payload;
    return !!payload && payload['opensSurface'] === true;
  }

  isLinkDisabled(block: ChatBlock): boolean { return !this.hasValidInternalHref(block); }

  onLinkClick(block: ChatBlock): void {
    if (!this.hasValidInternalHref(block)) {
      console.warn('[agent-chat] Ignoring malformed/disallowed link block:', block);
      return;
    }
    this.chatStatePort.navigate(this.normalizeInternalHref(String(block.href).trim()));
  }

  // ---------------------------------------------------------------------
  // Resize + right panel
  // ---------------------------------------------------------------------

  startResize(event: MouseEvent): void {
    this.dragging = true;
    this.startX = event.clientX;
    this.startWidth = this.panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (e: MouseEvent) => {
      if (!this.dragging) { return; }
      const nextWidth = this.startWidth + (e.clientX - this.startX);
      this.panelWidth = Math.max(300, Math.min(1000, nextWidth));
      this.panelWidthChange.emit(this.panelWidth);
      this.updateRightPanelPosition();
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateRightPanelPosition();
  }

  closeRightPanel(): void {
    if (this.rightPanelComponentRef) {
      this.rightPanelComponentRef.destroy();
      this.rightPanelComponentRef = null;
    }
    this.rightPanelVisible = false;
    this.rightPanelTitle = 'Details';
    this.chatStatePort.clearSurface();
  }

  private resetActiveFormSubmitting(): void {
    const instance = this.rightPanelComponentRef && this.rightPanelComponentRef.instance;
    if (instance && typeof instance.resetSubmitting === 'function') {
      instance.resetSubmitting();
    }
  }

  /** Optional advanced feature - see README "Surface plugins (optional)". No-op if none are registered. */
  private tryRenderSurface(surface: AgentSurface): boolean {
    if (!surface || !surface.type) { return false; }
    const plugin = this.surfacePlugins.find((candidate) => candidate && candidate.type === surface.type);
    if (!plugin) { return false; }

    this.rightPanelVisible = true;
    this.rightPanelTitle = surface.title || plugin.title || 'Details';
    this.updateRightPanelPosition();

    setTimeout(() => {
      if (!this.rightPanelContainer) { return; }
      if (this.rightPanelComponentRef) { this.rightPanelComponentRef.destroy(); }

      const pluginFactory = this.componentFactoryResolver.resolveComponentFactory(plugin.component);
      this.rightPanelComponentRef = this.rightPanelContainer.createComponent(pluginFactory);

      if (plugin.bind) {
        plugin.bind(surface, this.rightPanelComponentRef.instance, {
          emitFormSubmit: (activeSurface, formPayload, defaultAction) =>
            this.emitSurfaceFormSubmit(activeSurface, formPayload, defaultAction),
        });
      }

      const instance = this.rightPanelComponentRef.instance;
      if (instance.formContinue && instance.formContinue.subscribe) {
        instance.formContinue.subscribe((formPayload: any) => this.emitSurfaceFormContinue(surface, formPayload));
      }
    });

    return true;
  }

  private emitSurfaceFormSubmit(surface: AgentSurface, payload: any, defaultAction: string): void {
    if (!payload || this.inFlightRequestId) { return; }
    this.dispatchEmitEvent({
      requestId: this.createId('req'),
      messageId: this.createId('msg_event'),
      conversationId: this.conversationId,
      correlationId: String(payload.correlationId || surface.id || ''),
      event: 'form_submit',
      action: String(payload.action || defaultAction),
      values: payload.values || {},
      context: this.buildHostEventContext(),
    });
  }

  private emitSurfaceFormContinue(surface: AgentSurface, payload: any): void {
    if (!payload || this.inFlightRequestId) { return; }
    this.dispatchEmitEvent({
      requestId: this.createId('req'),
      messageId: this.createId('msg_event'),
      conversationId: this.conversationId,
      correlationId: String(payload.correlationId || surface.id || ''),
      event: 'form_continue',
      action: String(payload.action || `${surface.type}.continue`),
      values: payload.values || {},
      context: this.buildHostEventContext(),
    });
  }

  private updateRightPanelPosition(): void {
    if (!this.rightPanelVisible || !this.panelRoot) { return; }
    const bounds = this.panelRoot.nativeElement.getBoundingClientRect();
    this.rightPanelLeft = Math.round(bounds.right);
    this.rightPanelTop = Math.round(bounds.top);
    this.rightPanelComputedWidth = Math.max(280, Math.min(420, window.innerWidth - this.rightPanelLeft));
    this.rightPanelComputedHeight = Math.max(240, Math.round(bounds.height));
  }

  // ---------------------------------------------------------------------
  // Request lifecycle
  // ---------------------------------------------------------------------

  private buildRequest(prompt: string, messageId: string): ChatRequest {
    const normalizedAppId = this.appId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '') || 'web-app';
    return {
      schemaVersion: '1.0.0',
      requestId: this.createId('req'),
      conversationId: this.conversationId,
      messageId,
      prompt,
      context: this.buildContextSnapshot(),
      capabilities: ['blocks.text', 'blocks.markdown', 'blocks.status', 'blocks.data', 'blocks.suggestions', 'blocks.form', 'blocks.confirmation', 'blocks.link', 'blocks.error'],
      client: { appId: normalizedAppId, appVersion: '1.0.0', locale: 'en' },
    };
  }

  private buildContextSnapshot(): ChatContext {
    return {
      app: this.sanitizeContext(this.appContext),
      host: this.sanitizeContext(this.hostContext),
      catalog: { itemCount: this.entities.length },
    };
  }

  private buildHostEventContext(): { route?: string; persona?: string } {
    const hostPayload: Record<string, unknown> = this.hostContext || {};
    return {
      route: this.router && this.router.url ? this.router.url : '/',
      persona: typeof hostPayload['persona'] === 'string' ? String(hostPayload['persona']) : undefined,
    };
  }

  private dispatchRequest(request: ChatRequest, isRetry = false): void {
    if (this.inFlightRequestId) { return; }
    const tracked = this.activeRequests.get(request.requestId);
    let assistantMessageId = tracked && tracked.assistantMessageId;
    const userMessageId = (tracked && tracked.userMessageId) || request.messageId;

    if (!assistantMessageId) {
      assistantMessageId = this.appendAssistant(
        [{ type: 'status', level: 'loading', text: this.inFlightStatusText }],
        'completed',
        request.requestId,
        request.messageId
      );
    } else {
      this.patchMessage(assistantMessageId, { status: 'completed', blocks: [{ type: 'status', level: 'loading', text: this.inFlightStatusText }] });
    }

    this.activeRequests.set(request.requestId, { request, requestType: 'user_message', assistantMessageId, userMessageId });
    this.inFlightRequestId = request.requestId;
    this.canRetryRequestId = null;
    this.chatStatePort.sendRequest(request.requestId, request);
    this.chatStatePort.setActiveRequestId(this.inFlightRequestId);
    this.chatStatePort.setStatus('inFlight');
    this.status.emit(isRetry ? 'Retry started.' : 'Message sent.');
  }

  private dispatchEmitEvent(eventRequest: ChatEmitEventRequest): void {
    if (this.inFlightRequestId) { return; }

    const assistantMessageId = this.appendAssistant(
      [{ type: 'status', level: 'loading', text: this.inFlightStatusText }],
      'completed',
      eventRequest.requestId,
      eventRequest.messageId
    );

    const syntheticRequest: ChatRequest = {
      schemaVersion: '1.0.0',
      requestId: eventRequest.requestId,
      conversationId: eventRequest.conversationId,
      messageId: eventRequest.messageId,
      prompt: `[emit_event:${eventRequest.event}]`,
      context: this.buildContextSnapshot(),
      capabilities: [],
      client: { appId: this.appId },
    };

    this.activeRequests.set(eventRequest.requestId, {
      request: syntheticRequest,
      requestType: 'emit_event',
      assistantMessageId,
      userMessageId: eventRequest.messageId,
    });
    this.inFlightRequestId = eventRequest.requestId;
    this.canRetryRequestId = null;
    this.chatStatePort.sendRequest(eventRequest.requestId, syntheticRequest);
    this.chatStatePort.setActiveRequestId(this.inFlightRequestId);
    this.chatStatePort.setStatus('inFlight');
    this.chatStatePort.emitEvent(eventRequest);
  }

  private handleResponse(response: ChatResponse): void {
    let agentInfo: { id?: string; name?: string } | null = null;
    if ((response as any).agent) {
      const agent = (response as any).agent;
      const displayName = agent.name || agent.displayName || null;
      agentInfo = { id: agent.id || undefined, name: displayName || undefined };
      this.currentAgentDisplay = displayName || agent.id || null;
    }

    const tracked = this.activeRequests.get(response.requestId);
    if (!tracked) { return; }

    this.inFlightRequestId = null;
    const isEmitEventRequest = tracked.requestType === 'emit_event';
    if (response.status !== 'completed') { this.resetActiveFormSubmitting(); }

    const autoNavigateHref = this.getAutoNavigateHref(response.actions);
    const safeBlocks = this.ensureRenderableBlocks(this.filterNavLinkBlocks(response.blocks, autoNavigateHref));
    const failedBlocks = isEmitEventRequest ? safeBlocks : safeBlocks.concat([this.retrySuggestionBlock(response.requestId)]);

    this.patchMessage(tracked.assistantMessageId, {
      status: response.status,
      blocks: response.status === 'completed' ? safeBlocks : failedBlocks,
      timestamp: new Date().toISOString(),
      agent: agentInfo,
    });

    if (response.status !== 'completed' && !isEmitEventRequest) {
      this.canRetryRequestId = response.requestId;
    }

    if (response.status === 'completed') {
      this.chatStatePort.sendSuccess(response.requestId);
      this.chatStatePort.setStatus('idle');
      this.chatStatePort.setActiveRequestId(null);
    } else {
      this.chatStatePort.sendFailure(response.requestId, `Response ${response.status}`);
      this.chatStatePort.setStatus('error');
      this.chatStatePort.setActiveRequestId(null);
    }

    this.runAssistantResponseActions(response.actions);

    if (response.contextPatch) {
      this.agentEvent.emit({ type: 'chat_context_patch', patch: response.contextPatch, requestId: response.requestId });
    }

    this.setActiveConversationId(this.conversationId);

    if (response.surface) {
      try { this.chatStatePort.openSurface(response.surface); }
      catch (e) { console.warn('[agent-chat] Failed to open surface from response:', e); }
    }

    if (response.status === 'completed') {
      this.chatStatePort.loadConversations(false);
    }

    this.status.emit(`Response ${response.status}.`);
    this.restoreComposerFocus();
  }

  private handleTransportError(requestId: string, details: string): void {
    const tracked = this.activeRequests.get(requestId);
    if (!tracked) { return; }

    this.inFlightRequestId = null;
    this.resetActiveFormSubmitting();
    const isEmitEventRequest = tracked.requestType === 'emit_event';
    if (!isEmitEventRequest) { this.canRetryRequestId = requestId; }

    this.patchMessage(tracked.assistantMessageId, {
      status: 'failed',
      blocks: isEmitEventRequest
        ? [{ type: 'error', message: 'Something went wrong while processing that action.' }]
        : [{ type: 'error', message: 'Something went wrong while getting a response.' }, this.retrySuggestionBlock(requestId)],
      timestamp: new Date().toISOString(),
    });
    console.warn('[agent-chat] Request failed:', details);

    this.chatStatePort.sendFailure(requestId, details);
    this.chatStatePort.setStatus('error');
    this.chatStatePort.setActiveRequestId(null);

    this.status.emit(isEmitEventRequest ? 'Action failed. Please try again.' : 'Something went wrong. You can retry your last message.');
    this.restoreComposerFocus();
  }

  private runAssistantResponseActions(actions: ChatAction[] | undefined): void {
    if (!Array.isArray(actions) || !actions.length) { return; }
    let navigated = false;
    for (const action of actions) {
      const payload = action && action.payload && typeof action.payload === 'object' ? (action.payload as Record<string, unknown>) : null;
      if (payload && String(payload.type || '') === 'navigate') {
        if (navigated) { continue; }
        const href = typeof payload.href === 'string' ? payload.href.trim() : String(payload.route || '').trim();
        if (!this.isAllowlistedInternalHref(href)) {
          console.warn('[agent-chat] Ignoring unsafe response navigate action:', href);
          continue;
        }
        navigated = true;
        this.chatStatePort.navigate(this.normalizeInternalHref(href));
        continue;
      }
      this.runAction(action);
    }
  }

  private getAutoNavigateHref(actions: ChatAction[] | undefined): string {
    if (!Array.isArray(actions) || !actions.length) { return ''; }
    for (const action of actions) {
      const payload = action && action.payload && typeof action.payload === 'object' ? (action.payload as Record<string, unknown>) : null;
      if (!payload || String(payload.type || '') !== 'navigate') { continue; }
      const href = typeof payload.href === 'string' ? payload.href : typeof payload.route === 'string' ? payload.route : '';
      const normalizedHref = this.normalizeInternalHref(href);
      if (this.isAllowlistedInternalHref(normalizedHref)) { return normalizedHref; }
    }
    return '';
  }

  private retrySuggestionBlock(requestId: string): ChatBlock {
    return {
      type: 'suggestions',
      items: [{ id: `retry_${requestId}`, label: 'Retry', action: { id: `retry_action_${requestId}`, label: 'Retry', payload: { type: 'internal.retry', requestId } } }],
    };
  }

  private patchMessage(messageId: string, patch: Partial<ConversationMessage>): void {
    const index = this.messages.findIndex((message) => message.id === messageId);
    if (index < 0) { return; }
    this.messages[index] = { ...this.messages[index], ...patch };
    this.scrollToBottomSoon();
    this.chatStatePort.setMessages(this.messages);
  }

  private appendUser(text: string): string {
    const id = this.createId('msg_user');
    this.messages.push({ id, role: 'user', blocks: [{ type: 'text', text }], timestamp: new Date().toISOString(), status: 'completed' });
    this.scrollToBottomSoon();
    this.chatStatePort.setMessages(this.messages);
    return id;
  }

  private appendAssistant(blocks: ChatBlock[], status: ChatResponseStatus = 'completed', requestId?: string, userMessageId?: string): string {
    const id = this.createId('msg_assistant');
    this.messages.push({ id, role: 'assistant', blocks, timestamp: new Date().toISOString(), status, requestId, userMessageId });
    this.scrollToBottomSoon();
    this.chatStatePort.setMessages(this.messages);
    return id;
  }

  private appendSystemMessage(blocks: ChatBlock[]): void {
    this.messages.push({ id: this.createId('msg_system'), role: 'system', blocks, timestamp: new Date().toISOString(), status: 'completed' });
    this.scrollToBottomSoon();
    this.chatStatePort.setMessages(this.messages);
  }

  private applyRestoredConversation(conversation: ConversationDetailResponse): void {
    this.activeRequests.clear();
    this.canRetryRequestId = null;
    this.conversationId = conversation.id;
    this.chatStatePort.setConversationId(this.conversationId);
    this.setActiveConversationId(this.conversationId);
    this.messages = this.mapPersistedConversationMessages(conversation.messages);
    if (!this.messages.length) { this.messages = [this.createIntroMessage()]; }
    this.chatStatePort.setMessages(this.messages);
    this.clearInteractiveState();
    this.isHistoryOpen = false;
    this.clearSearch();
    this.lastMessageCount = 0;
    this.scrollToBottomSoon();
  }

  private mapPersistedConversationMessages(messages: PersistedConversationMessage[]): ConversationMessage[] {
    if (!Array.isArray(messages)) { return []; }
    return messages
      .map((message) => this.mapPersistedConversationMessage(message))
      .filter((message): message is ConversationMessage => message !== null);
  }

  private mapPersistedConversationMessage(message: PersistedConversationMessage): ConversationMessage | null {
    if (!message || typeof message !== 'object') { return null; }
    if (message.role === 'user') {
      const text = typeof message.text === 'string' ? message.text : '';
      if (!text.trim()) { return null; }
      return {
        id: message.id || this.createId('msg_user'),
        role: 'user',
        blocks: [{ type: 'text', text }],
        timestamp: message.createdAt || new Date().toISOString(),
        status: 'completed',
        userMessageId: message.userMessageId,
      };
    }
    if (message.role === 'assistant') {
      const msgs = (message.assistant && Array.isArray(message.assistant.messages)) ? message.assistant.messages : [];
      const blocks = msgs
        .map((m) => {
          if (!m || typeof m !== 'object') { return null; }
          if (typeof m.text === 'string' && m.text.trim()) { return { type: 'text', text: m.text } as ChatBlock; }
          if (typeof m.markdown === 'string' && m.markdown.trim()) { return { type: 'text', text: m.markdown } as ChatBlock; }
          return null;
        })
        .filter((b): b is ChatBlock => b !== null);
      return {
        id: message.id || this.createId('msg_assistant'),
        role: 'assistant',
        blocks: blocks.length ? blocks : [{ type: 'text', text: 'No renderable content was returned.' }],
        timestamp: message.createdAt || new Date().toISOString(),
        status: 'completed',
      };
    }
    return null;
  }

  private createIntroMessage(): ConversationMessage {
    const blocks: ChatBlock[] = [{ type: 'text', text: this.greeting }];
    if (this.quickActions.length) {
      blocks.push({
        type: 'suggestions',
        items: [{ id: 'show_quick_actions', label: 'Show me what you can do', action: { id: 'a_quick_actions', label: 'Show me what you can do', payload: { type: 'show_quick_actions' } } }],
      });
    }
    return { id: this.createId('msg_intro'), role: 'assistant', blocks, timestamp: new Date().toISOString(), status: 'completed' };
  }

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  private buildFormValues(message: ConversationMessage, block: ChatBlock, blockIndex: number): Record<string, unknown> {
    const draft = this.formDraftValues[this.blockKey(message, blockIndex)] || {};
    const values: Record<string, unknown> = {};
    (block.fields || []).forEach((field) => {
      const raw = draft[field.id];
      values[field.id] = field.type === 'number'
        ? (raw === undefined || raw === null || raw === '' ? '' : Number(raw))
        : (raw === undefined || raw === null ? '' : String(raw));
    });
    return values;
  }

  private validateFormValues(block: ChatBlock, values: Record<string, unknown>): string {
    for (const field of block.fields || []) {
      if (!field.required) { continue; }
      const value = values[field.id];
      if (field.type === 'number') {
        const numeric = Number(value);
        if (!isFinite(numeric) || value === '' || numeric <= 0) { return `${field.label} is required.`; }
      } else if (String(value || '').trim() === '') {
        return `${field.label} is required.`;
      }
    }
    return '';
  }

  private blockKey(message: ConversationMessage, blockIndex: number): string {
    return `${message.id}__${blockIndex}`;
  }

  private clearInteractiveState(): void {
    this.clearRecord(this.submittedForms);
    this.clearRecord(this.actedConfirmations);
    this.clearRecord(this.formDraftValues);
  }

  private hideSuggestionLinks(): void {
    this.messages.forEach((message) => {
      if (message.blocks.some((block) => block.type === 'suggestions')) {
        this.hiddenSuggestionMessageIds[message.id] = true;
      }
    });
  }

  private clearRecord(record: Record<string, any>): void {
    Object.keys(record).forEach((key) => delete record[key]);
  }

  private sanitizeContext(input: Record<string, unknown> | null): Record<string, unknown> {
    if (!input) { return {}; }
    const clone = { ...input };
    const secretLikeKeys = ['password', 'secret', 'token', 'apikey', 'auth'];
    for (const key of Object.keys(clone)) {
      if (secretLikeKeys.some((entry) => key.toLowerCase().includes(entry))) { delete clone[key]; }
    }
    return clone;
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private restoreComposerFocus(): void {
    const active = document.activeElement;
    const activeIsMessageArea = active === document.body || (this.messagesRef && active === this.messagesRef.nativeElement);
    if (activeIsMessageArea && this.composerRef) {
      this.composerRef.nativeElement.focus();
    }
  }

  private scrollToBottomSoon(): void {
    setTimeout(() => { const el = this.messagesRef && this.messagesRef.nativeElement; if (el) { el.scrollTop = el.scrollHeight; } });
    requestAnimationFrame(() => { const el = this.messagesRef && this.messagesRef.nativeElement; if (el) { el.scrollTop = el.scrollHeight; } });
  }

  private ensureRenderableBlocks(blocks: ChatBlock[]): ChatBlock[] {
    const filtered = (blocks || []).filter((block) => {
      if (this.isKnownBlockType(block.type)) { return true; }
      console.warn('[agent-chat] Skipping unsupported block type:', block.type);
      return false;
    });
    return filtered.length ? filtered : [{ type: 'text', text: 'No renderable content was returned.' }];
  }

  private filterNavLinkBlocks(blocks: ChatBlock[], autoNavigateHref: string): ChatBlock[] {
    return (Array.isArray(blocks) ? blocks : []).filter((block) => {
      if (!block || block.type !== 'link') { return true; }
      const href = typeof block.href === 'string' ? this.normalizeInternalHref(block.href) : '';
      const target = String(block.target || 'internal').toLowerCase();
      if (target !== 'internal') { return true; }
      return href !== autoNavigateHref;
    });
  }

  private isKnownBlockType(type: string): boolean {
    return ['text', 'markdown', 'status', 'data', 'suggestions', 'form', 'confirmation', 'link', 'error'].includes(type);
  }

  private hasValidInternalHref(block: ChatBlock): boolean {
    if (String(block.target || 'internal').toLowerCase() !== 'internal') { return false; }
    const href = typeof block.href === 'string' ? block.href.trim() : '';
    return this.isAllowlistedInternalHref(href);
  }

  private isAllowlistedInternalHref(href: string): boolean {
    const normalizedHref = this.normalizeInternalHref(href);
    if (!normalizedHref || normalizedHref.charAt(0) !== '/' || /^https?:\/\//i.test(normalizedHref)) { return false; }
    return this.allowedNavigationHrefs.some(
      (allowedHref) => normalizedHref === allowedHref || normalizedHref.indexOf(`${allowedHref}?`) === 0 || normalizedHref.indexOf(`${allowedHref}#`) === 0
    );
  }

  private normalizeInternalHref(href: string): string {
    const trimmed = typeof href === 'string' ? href.trim() : '';
    if (!trimmed) { return ''; }
    const queryIndex = trimmed.indexOf('?');
    const hashIndex = trimmed.indexOf('#');
    let cutIndex = -1;
    if (queryIndex >= 0 && hashIndex >= 0) { cutIndex = Math.min(queryIndex, hashIndex); }
    else { cutIndex = queryIndex >= 0 ? queryIndex : hashIndex; }
    const withoutQuery = cutIndex >= 0 ? trimmed.slice(0, cutIndex) : trimmed;
    return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
  }

  private getActiveConversationStorageKey(): string {
    return `${this.storageKeyPrefix}.activeConversationId`;
  }

  private setActiveConversationId(conversationId: string): void {
    const value = String(conversationId || '').trim();
    if (!value) { return; }
    try { localStorage.setItem(this.getActiveConversationStorageKey(), value); } catch { /* ignore storage failures */ }
  }
}
