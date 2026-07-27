export type ChatResponseStatus = 'completed' | 'failed' | 'cancelled';

export interface ChatContext {
  app: Record<string, unknown>;
  host: Record<string, unknown>;
  catalog: {
    itemCount: number;
  };
}

export interface ChatRequest {
  schemaVersion: string;
  requestId: string;
  conversationId: string;
  messageId: string;
  prompt: string;
  context: ChatContext;
  capabilities?: string[];
  client: {
    appId: string;
    appVersion?: string;
    locale?: string;
  };
}

export interface ChatAction {
  id: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface ChatSuggestionAction {
  id: string;
  label: string;
  action: ChatAction;
}

export interface ChatBlock {
  type: 'text' | 'markdown' | 'status' | 'data' | 'suggestions' | 'form' | 'link' | 'error' | string;
  text?: string;
  markdown?: string;
  level?: 'info' | 'loading' | 'warning' | 'success';
  items?: Array<{ key: string; value: string }> | ChatSuggestionAction[];
  title?: string;
  fields?: Array<{ key: string; label: string; fieldType: 'text' | 'number' | 'select' }>;
  label?: string;
  href?: string;
  message?: string;
  details?: string;
}

export interface ChatResponse {
  schemaVersion: string;
  requestId: string;
  conversationId: string;
  messageId: string;
  parentMessageId: string;
  agent: {
    id: string;
    displayName?: string;
    avatarKey?: string;
  };
  status: ChatResponseStatus;
  blocks: ChatBlock[];
  contextPatch?: Record<string, unknown>;
  actions?: ChatAction[];
  diagnostics?: {
    traceId?: string;
  };
}
