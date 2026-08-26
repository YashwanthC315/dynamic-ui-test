/**
 * agent-chat-port.contracts.ts
 *
 * The panel component never talks to HTTP, NgRx, a router store, etc.
 * directly. It only talks to these two "ports". This is what makes the
 * component portable: drop in the default `AgentChatService` (implements
 * both ports) to get working chat in minutes, or implement the ports
 * yourself to wire the panel into an existing state-management setup
 * (NgRx, Akita, a hand-rolled facade...) without touching the component.
 */

import { InjectionToken, Type } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AgentSurface,
  ChatEmitEventRequest,
  ChatRequest,
  ChatResponse,
  ConversationDetailResponse,
  ConversationMessage,
  ConversationSummary,
} from './chat.contracts';

/**
 * Owns conversation state (messages, history list, active conversation id,
 * active surface) and is the entry point for dispatching work. The default
 * `AgentChatService` implements this using RxJS subjects + HttpClient.
 */
export interface AgentChatStatePort {
  readonly messages$: Observable<ConversationMessage[]>;
  readonly conversationList$: Observable<ConversationSummary[]>;
  readonly conversationId$: Observable<string | null>;
  readonly activeSurface$: Observable<AgentSurface | null>;

  setMessages(messages: ConversationMessage[]): void;
  setConversationId(conversationId: string): void;

  loadConversations(restoreActiveConversation: boolean): void;
  createConversation(conversationId: string, title: string): void;
  restoreConversationById(conversationId: string): Observable<ConversationDetailResponse> | void;

  sendRequest(requestId: string, request: ChatRequest): void;
  emitEvent(event: ChatEmitEventRequest): void;
  cancelRequest(requestId: string): void;

  sendSuccess(requestId: string): void;
  sendFailure(requestId: string, details: string): void;
  setStatus(status: 'idle' | 'inFlight' | 'error' | string): void;
  setActiveRequestId(requestId: string | null): void;

  navigate(href: string): void;

  openSurface(surface: AgentSurface): void;
  clearSurface(): void;
}

/**
 * Delivers responses to whatever request the state port sent, out of band
 * (e.g. after an HTTP call, a WebSocket push, or an NgRx effect resolves).
 */
export interface AgentChatResponsePort {
  readonly responses$: Observable<ChatResponse>;
  readonly transportErrors$: Observable<{ requestId: string; details: string }>;
}

/**
 * Optional: lets the host app register a component to render inside the
 * panel's right-hand "surface" slot when the backend asks for one by type.
 * See README "Surface plugins (optional)". Most integrations can skip this.
 */
export interface AgentChatSurfacePluginPort {
  type: string;
  title?: string;
  component: Type<any>;
  bind?(
    surface: AgentSurface,
    instance: any,
    host: {
      emitFormSubmit: (surface: AgentSurface, payload: any, defaultAction: string) => void;
    }
  ): void;
}

export const AGENT_CHAT_STATE_PORT = new InjectionToken<AgentChatStatePort>('AGENT_CHAT_STATE_PORT');
export const AGENT_CHAT_RESPONSE_PORT = new InjectionToken<AgentChatResponsePort>('AGENT_CHAT_RESPONSE_PORT');
export const AGENT_CHAT_SURFACE_PLUGINS = new InjectionToken<AgentChatSurfacePluginPort[]>('AGENT_CHAT_SURFACE_PLUGINS');

/** Config for the default `AgentChatService`. Provide via `AgentChatModule.forRoot(...)`. */
export interface AgentChatConfig {
  /** Base URL of your backend, e.g. 'https://api.example.com/agent-chat'. */
  apiBaseUrl: string;
  /** Static id identifying this frontend app to the backend, e.g. 'admin-portal'. */
  appId: string;
}

export const AGENT_CHAT_CONFIG = new InjectionToken<AgentChatConfig>('AGENT_CHAT_CONFIG');
