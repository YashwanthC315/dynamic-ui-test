import { AcpActivityAction, AcpActivityItem, AcpChatMessage } from './acp-chat-panel';

export interface AcpHarnessConfig {
  /** Agent-file-run API origin, for example http://localhost:4001. */
  baseUrl?: string;
  /** Runtime-provided bearer token. Do not commit credentials in app source. */
  bearerToken?: string;
  /** Resolve the current session token for each agent run. */
  getBearerToken?: () => string | Promise<string>;
  /** Agent file path accepted by the configured agent service. */
  agentPath?: string;
  /** Optional second agent file for assistant suggestion chips. */
  suggestionsAgentPath?: string;
  /** Maximum prior user/assistant messages included in each prompt (default 20). */
  maxHistoryEntries?: number;
  /** localStorage key for persisted conversations; scope it per user when needed. */
  historyStorageKey?: string;
  /** Maximum time to wait for an agent run, in milliseconds. */
  timeoutMs?: number;
}

export interface AcpHarnessEnvironment {
  AGENT_FILE_RUN_API_URL?: string;
  AGENT_FILE_RUN_BEARER_TOKEN?: string;
  AGENT_FILE_RUN_AGENT_PATH?: string;
  AGENT_SUGGESTIONS_AGENT_PATH?: string;
  AGENT_CHAT_HISTORY_MAX?: number;
}

export interface AcpHarnessOptions {
  chat: HTMLElement & { messages?: AcpChatMessage[]; chatHistory?: unknown[]; pending?: boolean };
  workspace?: HTMLElement & { open?: boolean; formSpec?: unknown; surface?: Record<string, unknown> | null; close?: () => void };
  actions?: HTMLElement & { open?: boolean; title?: string; items?: AcpActivityItem[]; menuActions?: AcpActivityAction[] };
  buddyWorkspace?: HTMLElement & { surface?: unknown; buddyText?: string; records?: unknown[] };
  environment?: AcpHarnessEnvironment;
  config?: Partial<AcpHarnessConfig>;
  conversationId?: string;
  context?: Record<string, unknown>;
  getContext?: () => Record<string, unknown>;
  onNavigate?: (href: string) => void;
  /** Called after the connector dispatches a supported Workspace or Assembler surface. */
  onSurface?: (surface: Record<string, unknown>) => void;
}

export interface AcpHarnessConnection {
  readonly conversationId: string;
  sendMessage(prompt: string, options?: Record<string, unknown>): Promise<void>;
  cancel(): void;
  disconnect(): void;
}

export declare function connectAcpHarness(options: AcpHarnessOptions): AcpHarnessConnection;
export declare function buildAcpFileRunPrompt(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  context: Record<string, unknown>,
  prompt: string
): string;
export declare function parseAcpHarnessReply(raw: string, conversationId?: string): {
  blocks: Array<Record<string, unknown>>;
  surface: Record<string, unknown> | null;
  actions: Array<Record<string, unknown>>;
  agent: Record<string, unknown> | null;
  suggestionOnly?: boolean;
  conversationId?: string;
};
export declare function stripAcpCodeFence(raw: string): string;
export declare function encodeAcpBearerSubprotocol(token: string): string;