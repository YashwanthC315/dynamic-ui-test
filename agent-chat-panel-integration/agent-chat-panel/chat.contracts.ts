/**
 * chat.contracts.ts
 *
 * Wire-level and view-model types shared between the AgentChatPanel component,
 * its default transport service, and whatever backend you point it at.
 *
 * Nothing in this file is application-specific. Keep it that way: if you find
 * yourself adding a field just for one app's use case, put it inside
 * `context` / `payload` instead of widening these shapes.
 */

// ---------------------------------------------------------------------------
// Response blocks
// ---------------------------------------------------------------------------

export type ChatBlockType =
  | 'text'
  | 'markdown'
  | 'status'
  | 'data'
  | 'suggestions'
  | 'form'
  | 'confirmation'
  | 'link'
  | 'error';

export interface ChatFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  options?: Array<{ label: string; value: unknown }>;
}

export interface ChatDataItem {
  key: string;
  value: string;
}

export interface ChatAction {
  id: string;
  label: string;
  /**
   * Free-form payload. The panel only inspects `payload.type` for a small
   * set of built-in behaviors (see README "Action payload types"); anything
   * else is forwarded to the host app via the `agentEvent` output.
   */
  payload: Record<string, unknown>;
}

export interface ChatSuggestionAction {
  id: string;
  label: string;
  action: ChatAction;
}

export interface ChatBlock {
  type: ChatBlockType | string;

  // text / markdown
  text?: string;
  markdown?: string;

  // status
  level?: 'loading' | 'info' | 'warning' | string;

  // data
  items?: ChatDataItem[] | ChatSuggestionAction[];

  // suggestions -> items: ChatSuggestionAction[]

  // form
  title?: string;
  fields?: ChatFormField[];
  correlationId?: string;
  submitAction?: string;
  confirmAction?: string;
  cancelAction?: string;

  // link
  label?: string;
  href?: string;
  target?: 'internal' | 'external' | string;

  // error
  message?: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Requests / responses
// ---------------------------------------------------------------------------

export type ChatResponseStatus = 'completed' | 'failed' | 'cancelled' | string;

export interface ChatContext {
  /** Sanitized snapshot of whatever the host app passed in via [appContext]. */
  app: Record<string, unknown>;
  /** Sanitized snapshot of whatever the host app passed in via [hostContext]. */
  host: Record<string, unknown>;
  catalog?: { itemCount: number };
}

export interface ChatRequest {
  schemaVersion: string;
  requestId: string;
  conversationId: string;
  messageId: string;
  prompt: string;
  context: ChatContext;
  capabilities: string[];
  client: {
    appId: string;
    appVersion?: string;
    locale?: string;
  };
}

export interface ChatEmitEventRequest {
  requestId: string;
  messageId: string;
  conversationId: string;
  correlationId: string;
  event: 'form_submit' | 'confirm' | 'cancel' | 'form_continue' | string;
  action: string;
  values: Record<string, unknown>;
  context: { route?: string; persona?: string };
}

export interface ChatResponse {
  requestId: string;
  status: ChatResponseStatus;
  blocks: ChatBlock[];
  actions?: ChatAction[];
  contextPatch?: Record<string, unknown>;
  agent?: { id?: string; name?: string; displayName?: string };
  surface?: AgentSurface | null;
}

// ---------------------------------------------------------------------------
// Conversation view models
// ---------------------------------------------------------------------------

export type MessageRole = 'assistant' | 'user' | 'system' | 'error';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  blocks: ChatBlock[];
  timestamp: string;
  status?: ChatResponseStatus;
  requestId?: string;
  userMessageId?: string;
  agent?: { id?: string; name?: string } | null;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface PersistedConversationMessage {
  id?: string;
  role: 'user' | 'assistant';
  text?: string;
  createdAt?: string;
  userMessageId?: string;
  assistant?: { messages: Array<{ text?: string; markdown?: string }> };
}

export interface ConversationDetailResponse {
  id: string;
  messages: PersistedConversationMessage[];
}

// ---------------------------------------------------------------------------
// Right-hand "surface" plugin system (optional, advanced)
// ---------------------------------------------------------------------------

/**
 * A surface is a request from the backend to render a richer, app-specific
 * UI next to the chat (e.g. a multi-step form). It's entirely optional -
 * most integrations never use it. See README "Surface plugins (optional)".
 */
export interface AgentSurface {
  id: string;
  type: string;
  title?: string;
  [key: string]: unknown;
}
