/**
 * @acp/chat-panel v0.2.7 TypeScript Definitions
 * Universal Custom Elements for Angular and modern web applications.
 */

export type AcpChatRole = 'user' | 'assistant' | 'system' | 'error';

export type AcpChatBlockType =
  | 'text'
  | 'markdown'
  | 'status'
  | 'data'
  | 'suggestions'
  | 'form'
  | 'confirmation'
  | 'link'
  | 'error';

export interface AcpChatAction {
  id: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface AcpChatSuggestion {
  id: string;
  label: string;
  action: AcpChatAction;
}

export interface AcpDataRowItem {
  key: string;
  value: unknown;
}

export interface AcpChatBlock {
  type: AcpChatBlockType;
  text?: string;
  markdown?: string;
  level?: 'info' | 'warning' | 'error' | 'loading';
  items?: AcpDataRowItem[];
  suggestions?: AcpChatSuggestion[];
  fields?: AcpFieldSpec[];
  title?: string;
  label?: string;
  href?: string;
  route?: string;
  message?: string;
  details?: string;
}

export interface AcpChatMessage {
  id: string;
  role: AcpChatRole;
  text?: string;
  blocks?: AcpChatBlock[];
  timestamp?: string | Date;
  agent?: { id?: string; name?: string } | null;
}

export interface AcpChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string | Date;
}

export type AcpFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';

export interface AcpFieldValidation {
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface AcpSelectOption {
  label: string;
  value: string;
}

export interface AcpFieldSpec {
  id: string;
  label: string;
  type: AcpFieldType;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  optionsSource?: string;
  options?: AcpSelectOption[];
  validation?: AcpFieldValidation;
}

export interface AcpFormSpec {
  formId: string;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  initialValues?: Record<string, unknown>;
  fields: AcpFieldSpec[];
}

export interface AcpFormRequestedEvent {
  formSpec: AcpFormSpec;
}

export interface AcpActivityAction {
  id: string;
  label: string;
  type?: string;
  payload?: Record<string, unknown>;
}

export interface AcpActivityItem {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
  recordId?: string;
  actions?: AcpActivityAction[];
}

export interface AcpActionsRequestedEvent {
  open: true;
  item: AcpActivityItem;
}

export interface BuddyRecord {
  id: string;
  name: string;
  dob?: string;
  gender?: string;
  course?: string;
  email?: string;
  mobile?: string;
  fatherName?: string;
  valid?: boolean;
}

export declare class AcpChatPanel extends HTMLElement {
  open: boolean;
  title: string;
  placeholder: string;
  maxLength: number;
  width: number;
  minWidth: number;
  maxWidth: number;
  dock: 'left' | 'right';
  formTriggerPrefix: string;
  agentDisplay: string;
  pending: boolean;
  messages: AcpChatMessage[];
  chatHistory: AcpChatHistoryItem[];

  startNewChat(): void;
  toggleSearch(): void;
  clearSearch(): void;
  toggleHistory(): void;
  sendMessage(text: string): void;
}

export declare class AcpDynamicContainer extends HTMLElement {
  open: boolean;
  title: string;
  formWidth: number;
  minFormWidth: number;
  maxFormWidth: number;
  /** Custom pane height in px; `null` stretches to the full column height. */
  formHeight: number | null;
  minFormHeight: number;
  minimized: boolean;
  maximized: boolean;
  formSpec: AcpFormSpec | null;
  surface: Record<string, unknown> | null;

  collapse(): void;
  maximize(): void;
  restore(): void;
  close(): void;
}

export declare class BuddyEnrolWorkspaceSurface extends HTMLElement {
  formId: string;
  surface: unknown;
  records: BuddyRecord[];
  activeRecordId: string;
  buddyText: string;
  parseInFlight: boolean;
  checkInFlight: boolean;

  setRequestState(state: { parseInFlight?: boolean; checkInFlight?: boolean }): void;
}

export declare class AcpActionsPane extends HTMLElement {
  open: boolean;
  title: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  /** Custom pane height in px; `null` stretches to the full column height. */
  height: number | null;
  minHeight: number;
  items: AcpActivityItem[];
  menuActions: AcpActivityAction[];
  minimized: boolean;
  maximized: boolean;

  collapse(): void;
  maximize(): void;
  restore(): void;
  close(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'acp-chat-panel': AcpChatPanel;
    'acp-dynamic-container': AcpDynamicContainer;
    'buddy-enrol-workspace-surface': BuddyEnrolWorkspaceSurface;
    'acp-actions-pane': AcpActionsPane;
  }
}
