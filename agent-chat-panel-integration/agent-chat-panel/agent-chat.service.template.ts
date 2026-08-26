/**
 * agent-chat.service.template.ts
 *
 * This is a SCAFFOLD, not a finished file. It implements the plumbing
 * (AgentChatStatePort + AgentChatResponsePort - the two interfaces
 * agent-chat-panel.component.ts depends on) using RxJS subjects, but every
 * method that needs to talk to a backend is a TODO stub.
 *
 * Rename this file to `agent-chat.service.ts` and fill in the TODOs using
 * THIS APP'S EXISTING patterns - its own API/HTTP service layer, its own
 * auth (interceptors/tokens it already attaches), its own base URL config
 * (environment.ts or equivalent) - rather than introducing a new, separate
 * HttpClient call or a new backend contract. If this app already has an
 * assistant/agent/chat endpoint, call that; if it doesn't, this is the one
 * new endpoint the integration needs, and it should follow the same
 * conventions (request wrapper, error handling, auth) as the app's other
 * API calls.
 *
 * See AGENT_GUIDE.md, Task 3, for the discovery steps to do before editing
 * this file, and the exact request/response shapes below.
 */

import { Injectable } from '@angular/core';
// TODO: import this app's existing API/HTTP service instead of using
// HttpClient directly, if one exists, e.g.:
//   import { ApiService } from '../core/api.service';
// Only fall back to raw HttpClient if the app truly has no shared layer:
//   import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable, Subject, of } from 'rxjs';

import { AgentChatResponsePort, AgentChatStatePort } from './agent-chat-port.contracts';
import {
  AgentSurface,
  ChatEmitEventRequest,
  ChatRequest,
  ChatResponse,
  ConversationDetailResponse,
  ConversationMessage,
  ConversationSummary,
} from './chat.contracts';

@Injectable()
export class AgentChatService implements AgentChatStatePort, AgentChatResponsePort {
  private readonly messagesSubject = new BehaviorSubject<ConversationMessage[]>([]);
  private readonly conversationListSubject = new BehaviorSubject<ConversationSummary[]>([]);
  private readonly conversationIdSubject = new BehaviorSubject<string | null>(null);
  private readonly activeSurfaceSubject = new BehaviorSubject<AgentSurface | null>(null);
  private readonly responsesSubject = new Subject<ChatResponse>();
  private readonly transportErrorsSubject = new Subject<{ requestId: string; details: string }>();

  readonly messages$ = this.messagesSubject.asObservable();
  readonly conversationList$ = this.conversationListSubject.asObservable();
  readonly conversationId$ = this.conversationIdSubject.asObservable();
  readonly activeSurface$ = this.activeSurfaceSubject.asObservable();
  readonly responses$ = this.responsesSubject.asObservable();
  readonly transportErrors$ = this.transportErrorsSubject.asObservable();

  constructor(
    // TODO: inject this app's existing API service / HttpClient / Router here.
    // private readonly api: ApiService,
    // private readonly router: Router,
  ) {}

  // ---------------------------------------------------------------------
  // Conversation state - no backend call needed for most of these.
  // ---------------------------------------------------------------------

  setMessages(messages: ConversationMessage[]): void {
    this.messagesSubject.next(messages);
  }

  setConversationId(conversationId: string): void {
    this.conversationIdSubject.next(conversationId);
  }

  /**
   * TODO: fetch this app's chat history list, if it persists conversations.
   * If it doesn't (each session starts fresh), leave this as a no-op -
   * the panel works fine without a history list; the "Chat history" button
   * will just show "No saved chats yet."
   */
  loadConversations(_restoreActiveConversation: boolean): void {
    // Example shape once implemented:
    // this.api.get<ConversationSummary[]>('/agent-chat/conversations')
    //   .subscribe((list) => this.conversationListSubject.next(list));
  }

  createConversation(_conversationId: string, _title: string): void {
    // TODO: only needed if the backend requires an explicit "create
    // conversation" call before the first message. Most backends create
    // conversations implicitly on first message - if so, leave this empty.
  }

  /**
   * TODO: fetch a past conversation's messages by id, if history is
   * supported. Return an Observable<ConversationDetailResponse>.
   */
  restoreConversationById(conversationId: string): Observable<ConversationDetailResponse> {
    // Placeholder so the panel doesn't break before this is implemented:
    return of({ id: conversationId, messages: [] });
  }

  // ---------------------------------------------------------------------
  // The actual chat call - this is the important one.
  // ---------------------------------------------------------------------

  /**
   * TODO: send `request` to this app's agent/chat backend endpoint and push
   * the result into `this.responsesSubject`. Use this app's existing HTTP
   * wrapper/auth so the request is authenticated the same way every other
   * API call in the app is.
   *
   * `request.context.app` / `request.context.host` already carry whatever
   * this app passed in via the panel's [appContext]/[hostContext] inputs
   * (see AGENT_GUIDE.md Task 4 for what to put there - current route,
   * current view/record, user/session info the backend needs) - you
   * shouldn't need to gather anything extra here, just forward `request`.
   *
   * On success, call `this.responsesSubject.next(response)`.
   * On failure, call `this.transportErrorsSubject.next({ requestId, details })`.
   */
  sendRequest(requestId: string, request: ChatRequest): void {
    // Example shape once implemented:
    // this.api.post<ChatResponse>('/agent-chat/messages', request).subscribe({
    //   next: (response) => this.responsesSubject.next(response),
    //   error: (err) => this.transportErrorsSubject.next({ requestId, details: String(err) }),
    // });

    this.transportErrorsSubject.next({
      requestId,
      details: 'AgentChatService.sendRequest() is not implemented yet - see the TODO above.',
    });
  }

  /**
   * TODO: same as sendRequest(), but for form submissions and
   * confirm/cancel taps (ChatEmitEventRequest). Many backends handle this
   * on the same endpoint as sendRequest() with a different payload shape -
   * check what the backend expects before adding a second endpoint.
   */
  emitEvent(event: ChatEmitEventRequest): void {
    // Example shape once implemented:
    // this.api.post<ChatResponse>('/agent-chat/events', event).subscribe({
    //   next: (response) => this.responsesSubject.next(response),
    //   error: (err) => this.transportErrorsSubject.next({ requestId: event.requestId, details: String(err) }),
    // });

    this.transportErrorsSubject.next({
      requestId: event.requestId,
      details: 'AgentChatService.emitEvent() is not implemented yet - see the TODO above.',
    });
  }

  cancelRequest(_requestId: string): void {
    // TODO (optional): call a cancel endpoint if the backend supports one.
    // If not, leave empty - the panel already stops waiting on its side.
  }

  sendSuccess(_requestId: string): void {}
  sendFailure(_requestId: string, _details: string): void {}
  setStatus(_status: string): void {}
  setActiveRequestId(_requestId: string | null): void {}

  /**
   * TODO: navigate using this app's Router. This is the same Router the
   * rest of the app already uses for routing - don't introduce a second
   * navigation mechanism.
   */
  navigate(_href: string): void {
    // this.router.navigateByUrl(_href);
  }

  openSurface(surface: AgentSurface): void {
    this.activeSurfaceSubject.next(surface);
  }

  clearSurface(): void {
    this.activeSurfaceSubject.next(null);
  }
}
