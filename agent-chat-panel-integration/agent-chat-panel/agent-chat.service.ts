import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { environment } from '../../../env/environment';

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
    private readonly httpClient: HttpClient,
    private readonly router: Router,
  ) {}

  // ---------------------------------------------------------------------
  // Conversation state
  // ---------------------------------------------------------------------

  setMessages(messages: ConversationMessage[]): void {
    this.messagesSubject.next(messages);
  }

  setConversationId(conversationId: string): void {
    this.conversationIdSubject.next(conversationId);
  }

  loadConversations(_restoreActiveConversation: boolean): void {
    // If history is not persisted on the backend, leave as no-op.
  }

  createConversation(_conversationId: string, _title: string): void {
    // Implicitly created on first message.
  }

  restoreConversationById(conversationId: string): Observable<ConversationDetailResponse> {
    return of({ id: conversationId, messages: [] });
  }

  // ---------------------------------------------------------------------
  // The actual chat call
  // ---------------------------------------------------------------------

  sendRequest(requestId: string, request: ChatRequest): void {
    this.httpClient.post<ChatResponse>(`${environment.API_URL}/agent-chat/messages`, request).subscribe(
      (response) => {
        this.responsesSubject.next(response);
      },
      (err) => {
        const details = err.message || String(err);
        this.transportErrorsSubject.next({ requestId, details });
      }
    );
  }

  emitEvent(event: ChatEmitEventRequest): void {
    this.httpClient.post<ChatResponse>(`${environment.API_URL}/agent-chat/events`, event).subscribe(
      (response) => {
        this.responsesSubject.next(response);
      },
      (err) => {
        const details = err.message || String(err);
        this.transportErrorsSubject.next({ requestId: event.requestId, details });
      }
    );
  }

  cancelRequest(_requestId: string): void {
    // Optional cancel endpoint.
  }

  sendSuccess(_requestId: string): void {}
  sendFailure(_requestId: string, _details: string): void {}
  setStatus(_status: string): void {}
  setActiveRequestId(_requestId: string | null): void {}

  navigate(_href: string): void {
    this.router.navigateByUrl(_href);
  }

  openSurface(surface: AgentSurface): void {
    this.activeSurfaceSubject.next(surface);
  }

  clearSurface(): void {
    this.activeSurfaceSubject.next(null);
  }
}
