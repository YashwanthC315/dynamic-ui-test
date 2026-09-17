import { createServer } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { URL } from 'url';
import {
  AssistantAction,
  AssistantMessageBlock,
  HarnessAssistantResponse,
  HarnessErrorResponse,
  HostContextBag,
  HostEmitEvent,
  HostResponseAgent,
  HostToHarnessMessage,
  HostUserMessage,
  hostProtocolCapabilities,
  hostProtocolVersion
} from './src/app/agent-chat-panel/services/ct-bot-host-protocol';
import { createLogger, loadHarnessConfig } from './harness-config';
import {
  LiveChatError,
  callOpenAICompatibleChat,
  resolveChatCompletionsUrl
} from './live-client';

const WebSocketLib = require('ws');
const WebSocketServer = WebSocketLib.Server;
const sqlite3 = require('sqlite3').verbose();

// The repo pins TypeScript 3.2, which predates the built-in Omit utility
// type (added in TS 3.5); declare it locally.
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

const FEES_OVERVIEW_ROUTE = '/fees';
const FEES_TRANSACTIONS_ROUTE = '/fees/transactions';
const FEES_TRANSACTIONS_ADD_ROUTE = '/fees/transactions/add';
const FEES_COLLECT_ROUTE = '/fees/add';
const INSTITUTE_MANAGE_ROUTE = '/admin/inst';
const CONNECT_MARKS_CARD_ROUTE = '/connect/marksCardRecipients';
const HOME_ROUTE = '/home';
const LIVE_PROMPT_PATH = path.resolve(__dirname, 'AGENTS.md');
const KNOWN_NAVIGATION_ROUTES = [
  HOME_ROUTE,
  FEES_OVERVIEW_ROUTE,
  FEES_TRANSACTIONS_ROUTE,
  FEES_TRANSACTIONS_ADD_ROUTE,
  FEES_COLLECT_ROUTE,
  INSTITUTE_MANAGE_ROUTE,
  CONNECT_MARKS_CARD_ROUTE
];
const config = loadHarnessConfig();
const logger = createLogger(config.logLevel);
const liveSystemPrompt = loadLiveSystemPrompt();
const HARNESS_DATA_DIR = path.resolve(__dirname, 'data');
const HARNESS_DB_PATH = process.env.MOCK_HARNESS_SQLITE_PATH
  ? path.resolve(process.env.MOCK_HARNESS_SQLITE_PATH)
  : path.resolve(__dirname, config.sqlitePath || path.join(HARNESS_DATA_DIR, 'conversations.sqlite3'));
const HARNESS_DB_DIR = path.dirname(HARNESS_DB_PATH);
const ALLOWED_CORS_ORIGIN = (process.env.MOCK_HARNESS_CORS_ORIGIN || 'http://localhost:4200').trim();

interface InstituteContextSnapshot {
  status?: string;
  source?: string;
  reason?: string;
  message?: string;
  data?: {
    id?: string;
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    shortName?: string;
    academicYearFrom?: string;
    academicYearTo?: string;
    status?: string;
    board?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface FormSelectOption {
  label: string;
  value: string;
}

interface FormOptionsContext {
  courses?: FormSelectOption[];
  parentOrgs?: FormSelectOption[];
  ownerOrgs?: FormSelectOption[];
  orgs?: FormSelectOption[];
}

interface HostFocusContext {
  type?: string | null;
  id?: string;
  label?: string;
}

interface HostFlagsContext {
  underFees?: boolean;
}

interface HostModuleFlagsContext {
  underFees?: boolean;
  underConnect?: boolean;
  underStudent?: boolean;
}

interface HostViewContext {
  module?: string;
  screen?: string;
  title?: string;
  source?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
  rowCount?: number;
  truncated?: boolean;
  maxRows?: number;
  [key: string]: unknown;
}

interface ViewQaDebug {
  active: boolean;
  source: 'llm' | 'fallback_summary' | 'fallback_fees' | 'safety_fees' | 'n/a';
  rowCount: number;
  nameMatched: boolean;
  dateConstrained: boolean;
  dateMatched: boolean;
}

interface ConnectionContext {
  userId: string;
}

interface PersistedAssistantPayload {
  hostProtocolVersion: string;
  correlationId: string | null;
  messages: AssistantMessageBlock[];
  actions: AssistantAction[];
}

interface InstituteSurface {
  type: 'institute-summary';
  id: string;
  title?: string;
  data: {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    shortName?: string;
    academicYearFrom?: string;
    academicYearTo?: string;
    status?: string;
    board?: string;
  };
}

interface PersistedConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

type SqlValue = string | number | null;

if (!fs.existsSync(HARNESS_DB_DIR)) {
  fs.mkdirSync(HARNESS_DB_DIR, { recursive: true });
}

try {
  const fileHandle = fs.openSync(HARNESS_DB_PATH, 'a');
  fs.closeSync(fileHandle);
} catch (error) {
  logger.error('[mock-harness] failed to ensure sqlite file path=%s', HARNESS_DB_PATH);
}

const db = new sqlite3.Database(HARNESS_DB_PATH, (error: Error | null) => {
  if (error) {
    logger.error('[mock-harness] sqlite open failed path=%s', HARNESS_DB_PATH);
    logger.debug('[mock-harness] sqlite open error=%s', safeStringifyDebug(error));
    return;
  }
  logger.info('[mock-harness] sqlite open path=%s', HARNESS_DB_PATH);
});
const persistenceReady = initializePersistenceSchema();

async function initializePersistenceSchema(): Promise<void> {
  try {
    await runSql(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await runSql(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        created_at TEXT NOT NULL,
        user_text TEXT,
        user_message_id TEXT,
        assistant_payload_json TEXT
      )
    `);
    await runSql(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)`);
    await runSql(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC)`);
    await runSql(`CREATE INDEX IF NOT EXISTS idx_messages_user_conversation ON messages(user_id, conversation_id)`);
    logger.info('[mock-harness] sqlite schema ready path=%s', HARNESS_DB_PATH);
  } catch (error) {
    logger.error('[mock-harness] sqlite schema init failed path=%s', HARNESS_DB_PATH);
    logger.debug('[mock-harness] sqlite schema init error=%s', safeStringifyDebug(error));
    throw error;
  }
}

async function ensurePersistenceReady(): Promise<void> {
  await persistenceReady;
}

function runSql(sql: string, params: SqlValue[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (error: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function getSql<T = any>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error: Error, row: T) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

function allSql<T = any>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error: Error, rows: T[]) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function toConversationTitleFromFirstUserText(text: string): string {
  const trimmed = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!trimmed) {
    return 'New chat';
  }
  return trimmed.slice(0, 80);
}

function toPersistedAssistantPayload(payload: Omit<HarnessAssistantResponse, 'type'>): PersistedAssistantPayload {
  return {
    hostProtocolVersion: payload.hostProtocolVersion,
    correlationId: payload.correlationId,
    messages: payload.messages,
    actions: payload.actions
  };
}

function readTokenDerivedUserId(rawToken: string): string {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) {
    return '';
  }
  const parts = token.split('.');
  if (parts.length >= 2) {
    try {
      const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(normalizedPayload, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      const candidate = readFirstNonEmptyString(payload, ['sub', 'user_id', 'userId', 'id', 'uid']);
      if (candidate) {
        return 'user:' + candidate;
      }
    } catch (error) {
      // Ignore parse errors; fall back to stable token hash.
    }
  }
  return 'token:' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
}

function readFirstNonEmptyString(source: any, keys: string[]): string {
  if (!source || typeof source !== 'object') {
    return '';
  }
  for (let index = 0; index < keys.length; index++) {
    const value = source[keys[index]];
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function readHeaderValue(headers: any, name: string): string {
  if (!headers || !name) {
    return '';
  }
  const key = Object.keys(headers).find((candidate: string) => candidate.toLowerCase() === name.toLowerCase());
  if (!key) {
    return '';
  }
  const value = headers[key];
  if (Array.isArray(value)) {
    return value.length ? String(value[0]).trim() : '';
  }
  return String(value || '').trim();
}

function extractAuthToken(headers: any, requestUrl: URL): string {
  const headerToken = readHeaderValue(headers, 'AccessToken')
    || readHeaderValue(headers, 'Authorization').replace(/^Bearer\s+/i, '');
  const queryToken = requestUrl.searchParams.get('access_token') || '';
  return (headerToken || queryToken || '').trim();
}

function resolveUserId(headers: any, requestUrl: URL): string {
  const token = extractAuthToken(headers, requestUrl);
  const tokenBased = readTokenDerivedUserId(token);
  if (tokenBased) {
    return tokenBased;
  }
  return 'anon:' + crypto.createHash('sha256')
    .update(String(readHeaderValue(headers, 'user-agent') || 'unknown'))
    .update('|')
    .update(String(readHeaderValue(headers, 'origin') || 'no-origin'))
    .digest('hex')
    .slice(0, 12);
}

async function upsertConversationForTurn(conversationId: string, userId: string, userText: string): Promise<void> {
  await ensurePersistenceReady();
  const existing = await getSql<PersistedConversationRow>(
    'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?',
    [conversationId]
  );
  const timestamp = nowIso();
  const preferredTitle = toConversationTitleFromFirstUserText(userText);
  if (!existing) {
    await runSql(
      'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [conversationId, userId, preferredTitle || 'New chat', timestamp, timestamp]
    );
    return;
  }

  if (existing.user_id !== userId) {
    throw new Error('Conversation is owned by another user.');
  }

  await runSql(
    'UPDATE conversations SET updated_at = ? WHERE id = ?',
    [timestamp, conversationId]
  );

  if (existing.title === 'New chat' && preferredTitle && preferredTitle !== 'New chat') {
    const firstUserMessage = await getSql<{ count: number }>(
      'SELECT COUNT(1) as count FROM messages WHERE conversation_id = ? AND role = ?',
      [conversationId, 'user']
    );
    const hasUserMessages = !!(firstUserMessage && Number(firstUserMessage.count) > 0);
    if (!hasUserMessages) {
      await runSql(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [preferredTitle, conversationId]
      );
    }
  }
}

async function appendUserMessage(
  conversationId: string,
  userId: string,
  text: string,
  hostMessageId?: string
): Promise<void> {
  await ensurePersistenceReady();
  const timestamp = nowIso();
  await runSql(
    `
      INSERT INTO messages (
        id,
        conversation_id,
        user_id,
        role,
        created_at,
        user_text,
        user_message_id,
        assistant_payload_json
      ) VALUES (?, ?, ?, 'user', ?, ?, ?, NULL)
    `,
    [
      createMessageId('user'),
      conversationId,
      userId,
      timestamp,
      text,
      hostMessageId || null
    ]
  );
}

async function appendAssistantMessage(
  conversationId: string,
  userId: string,
  assistantPayload: PersistedAssistantPayload
): Promise<void> {
  await ensurePersistenceReady();
  const timestamp = nowIso();
  await runSql(
    `
      INSERT INTO messages (
        id,
        conversation_id,
        user_id,
        role,
        created_at,
        user_text,
        user_message_id,
        assistant_payload_json
      ) VALUES (?, ?, ?, 'assistant', ?, NULL, NULL, ?)
    `,
    [
      createMessageId('assistant'),
      conversationId,
      userId,
      timestamp,
      JSON.stringify(assistantPayload)
    ]
  );
  await runSql(
    'UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
    [timestamp, conversationId, userId]
  );
}

function createMessageId(prefix: 'user' | 'assistant'): string {
  return 'msg_' + prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

const httpServer = createServer(async (req: any, res: any) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const corsHeaders = buildCorsHeaders(req);
  const requestOrigin = readHeaderValue(req && req.headers ? req.headers : {}, 'origin');
  if (req.method === 'OPTIONS') {
    // Read requested headers for logging/verification
    const requested = readHeaderValue(req && req.headers ? req.headers : {}, 'access-control-request-headers') || '';
    const requestedList = requested.split(',').map((s: string) => s.trim()).filter((s: string) => !!s);
    const allowedList = getAllowedRequestHeaders().map((h) => h.toLowerCase());
    const missing = requestedList.filter((h: string) => allowedList.indexOf(h.toLowerCase()) < 0);
    const allowedAll = missing.length === 0;
    logger.info('[mock-harness] CORS preflight origin=%s path=%s requestedHeaders=%s allowedAll=%s missing=%s',
      requestOrigin, requestUrl.pathname, requested || '(none)', allowedAll, missing.join(',') || '(none)');

    // Reply to preflight with required CORS headers and explicit empty body
    writeCors(res, 204, corsHeaders, { 'content-length': '0' });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/v1/conversations' && req.method === 'GET') {
    const userId = resolveUserId(req.headers || {}, requestUrl);
    try {
      await ensurePersistenceReady();
      const rows = await allSql<{ id: string; title: string; updated_at: string }>(
        `
          SELECT id, title, updated_at
          FROM conversations
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 100
        `,
        [userId]
      );
      logger.info('[mock-harness] listed conversations user=%s count=%s', userId, rows.length);
      sendJson(res, 200, {
        items: rows.map((row) => ({
          id: row.id,
          title: row.title || 'New chat',
          updatedAt: row.updated_at
        }))
      }, corsHeaders);
      return;
    } catch (error) {
      logger.error('[mock-harness] failed to list conversations', error as Error);
      sendJson(res, 500, { error: 'Unable to load conversations.' }, corsHeaders);
      return;
    }
  }

  if (requestUrl.pathname === '/v1/conversations' && req.method === 'POST') {
    const userId = resolveUserId(req.headers || {}, requestUrl);
    try {
      await ensurePersistenceReady();
      const body = await readJsonBody(req);
      const requestedConversationId = body && typeof body.id === 'string' && body.id.trim()
        ? body.id.trim()
        : createConversationId();
      const title = body && typeof body.title === 'string'
        ? toConversationTitleFromFirstUserText(body.title)
        : 'New chat';
      const existing = await getSql<PersistedConversationRow>(
        'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?',
        [requestedConversationId]
      );
      const timestamp = nowIso();
      if (!existing) {
        await runSql(
          'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [requestedConversationId, userId, title || 'New chat', timestamp, timestamp]
        );
      } else if (existing.user_id !== userId) {
        sendJson(res, 401, { error: 'Conversation does not belong to current user.' }, corsHeaders);
        return;
      } else {
        await runSql(
          'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?',
          [title || existing.title || 'New chat', timestamp, requestedConversationId, userId]
        );
      }
      sendJson(res, 201, { id: requestedConversationId, title: title || 'New chat' }, corsHeaders);
      return;
    } catch (error) {
      logger.error('[mock-harness] failed to create conversation', error as Error);
      sendJson(res, 500, { error: 'Unable to create conversation.' }, corsHeaders);
      return;
    }
  }

  if (requestUrl.pathname.indexOf('/v1/conversations/') === 0 && req.method === 'GET') {
    const userId = resolveUserId(req.headers || {}, requestUrl);
    const conversationId = decodeURIComponent(requestUrl.pathname.replace('/v1/conversations/', '').trim());
    if (!conversationId) {
      sendJson(res, 400, { error: 'conversationId is required.' }, corsHeaders);
      return;
    }
    try {
      await ensurePersistenceReady();
      const conversation = await getSql<PersistedConversationRow>(
        'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?',
        [conversationId]
      );
      if (!conversation) {
        sendJson(res, 404, { error: 'Conversation not found.' }, corsHeaders);
        return;
      }
      if (conversation.user_id !== userId) {
        sendJson(res, 401, { error: 'Conversation does not belong to current user.' }, corsHeaders);
        return;
      }
      const rows = await allSql<any>(
        `
          SELECT id, role, created_at, user_text, user_message_id, assistant_payload_json
          FROM messages
          WHERE conversation_id = ? AND user_id = ?
          ORDER BY created_at ASC, id ASC
        `,
        [conversationId, userId]
      );
      sendJson(res, 200, {
        id: conversation.id,
        title: conversation.title || 'New chat',
        messages: rows.map((row) => {
          if (row.role === 'assistant') {
            let assistantPayload: PersistedAssistantPayload | null = null;
            if (typeof row.assistant_payload_json === 'string' && row.assistant_payload_json.trim()) {
              try {
                assistantPayload = JSON.parse(row.assistant_payload_json);
              } catch (error) {
                assistantPayload = null;
              }
            }
            return {
              id: row.id,
              role: 'assistant',
              createdAt: row.created_at,
              assistant: assistantPayload
            };
          }
          return {
            id: row.id,
            role: 'user',
            createdAt: row.created_at,
            text: row.user_text || '',
            userMessageId: row.user_message_id || undefined
          };
        })
      }, corsHeaders);
      return;
    } catch (error) {
      logger.error('[mock-harness] failed to load conversation %s', conversationId);
      sendJson(res, 500, { error: 'Unable to load conversation.' }, corsHeaders);
      return;
    }
  }

  if (requestUrl.pathname.indexOf('/v1/conversations/') === 0 && req.method === 'DELETE') {
    const userId = resolveUserId(req.headers || {}, requestUrl);
    const conversationId = decodeURIComponent(requestUrl.pathname.replace('/v1/conversations/', '').trim());
    if (!conversationId) {
      sendJson(res, 400, { error: 'conversationId is required.' }, corsHeaders);
      return;
    }
    try {
      await ensurePersistenceReady();
      const conversation = await getSql<PersistedConversationRow>(
        'SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?',
        [conversationId]
      );
      if (!conversation) {
        sendJson(res, 404, { error: 'Conversation not found.' }, corsHeaders);
        return;
      }
      if (conversation.user_id !== userId) {
        sendJson(res, 401, { error: 'Conversation does not belong to current user.' }, corsHeaders);
        return;
      }
      await runSql('DELETE FROM messages WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
      await runSql('DELETE FROM conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
      sendJson(res, 200, { deleted: true }, corsHeaders);
      return;
    } catch (error) {
      logger.error('[mock-harness] failed to delete conversation %s', conversationId);
      sendJson(res, 500, { error: 'Unable to delete conversation.' }, corsHeaders);
      return;
    }
  }

  writeCors(res, 200, corsHeaders, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('CT-Bot mock harness is running.\n');
});

const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on('connection', (socket: any, request: any) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const userId = resolveUserId(request.headers || {}, requestUrl);
  const accessToken = extractAuthToken(request.headers || {}, requestUrl);
  const connectionContext: ConnectionContext = { userId };
  logger.info('[mock-harness] client connected tokenPresent=%s mode=%s user=%s', Boolean(accessToken), config.mode, userId);

  socket.on('message', async (frame: any) => {
    await handleFrame(socket, String(frame), connectionContext);
  });

  socket.on('error', (error: Error) => {
    logger.error('[mock-harness] socket error', error);
  });
});

async function handleFrame(socket: any, rawFrame: string, connectionContext: ConnectionContext): Promise<void> {
  let payload: HostToHarnessMessage;
  try {
    payload = JSON.parse(rawFrame) as HostToHarnessMessage;
  } catch (error) {
    sendError(socket, createConversationId(), 'bad_request', 'Invalid JSON payload.');
    return;
  }

  switch (payload.type) {
    case 'hello':
      logger.info(
        '[mock-harness] hello version=%s capabilities=%s',
        payload.hostProtocolVersion,
        Array.isArray(payload.capabilities) ? payload.capabilities.join(',') : 'none'
      );
      // reply with a minimal assistant_response so the UI can show a connected agent
      try {
        const convoId = sanitizeConversationId((payload as any).conversationId) || createConversationId();
        const resp = {
          type: 'assistant_response',
          conversationId: convoId,
          correlationId: null,
          hostProtocolVersion: hostProtocolVersion,
          messages: [
            { type: 'text', text: 'Agent connected (mock harness).' }
          ],
          actions: []
        } as HarnessAssistantResponse;
        socket.send(JSON.stringify(resp));
      } catch (err) {
        logger.error('[mock-harness] failed sending hello response', err);
      }
      return;
    case 'context_response':
      logger.debug('[mock-harness] context_response received');
      return;
    case 'emit_event':
      await handleEmitEvent(socket, payload);
      return;
    case 'user_message':
      if (config.mode === 'live') {
        await handleLiveUserMessage(socket, payload, connectionContext);
        return;
      }
      await handleCannedUserMessage(socket, payload, connectionContext);
      return;
    default:
      sendError(
        socket,
        sanitizeConversationId((payload as any).conversationId),
        'unsupported_type',
        'Unsupported message type.'
      );
  }
}

async function handleCannedUserMessage(socket: any, payload: HostUserMessage, connectionContext: ConnectionContext): Promise<void> {
  const conversationId = sanitizeConversationId(payload.conversationId);
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const currentRoute = readCurrentRoute(payload);
  const contextFlags = readContextFlags(payload);
  const moduleFlags = readModuleFlags(payload);
  const viewContext = readViewContext(payload);
  const instituteContext = readInstituteContext(payload);
  const isUnderFees = typeof moduleFlags.underFees === 'boolean'
    ? moduleFlags.underFees
    : (typeof contextFlags.underFees === 'boolean'
      ? contextFlags.underFees
      : currentRoute.indexOf('/fees') === 0);
  if (!text) {
    sendError(socket, conversationId, 'bad_request', 'user_message.text must be a non-empty string.');
    return;
  }

  if (isCollectFeesIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        {
          type: 'text',
          text: isUnderFees
            ? 'Opening the payment recording screen in Fees.'
            : 'Fee collection is done in Fees. Opening the add payment screen so you can record a payment there.'
        },
        createSuggestionsBlock([
          createSendMessageSuggestion('Open Fees', 'take me to fees'),
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home')
        ])
      ],
      actions: [createNavigateAction(isUnderFees ? FEES_COLLECT_ROUTE : FEES_COLLECT_ROUTE)]
    });
    return;
  }

  if (isInstitutePageNavigationIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: 'Opening the institute page.' },
        createSuggestionsBlock([
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home')
        ])
      ],
      actions: [createNavigateAction(INSTITUTE_MANAGE_ROUTE)]
    });
    return;
  }

  const cannedFieldQuestion = detectInstituteFieldQuestion(text);
  if (cannedFieldQuestion) {
    logger.info(
      '[mock-harness] institute field repair conversationId=%s field=%s instituteStatus=%s',
      conversationId,
      cannedFieldQuestion,
      instituteContext && instituteContext.status ? instituteContext.status : '(none)'
    );
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: buildInstituteFieldAnswer(text, instituteContext) },
        createSuggestionsBlock(defaultInstituteFollowUpSuggestions())
      ],
      actions: []
    });
    return;
  }

  if (isInstituteInfoIntent(text)) {
    const instituteMessage = buildInstituteSummaryMessage(instituteContext, false);
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        {
          type: 'text',
          text: instituteMessage
        },
        createSuggestionsBlock(defaultInstituteFollowUpSuggestions())
      ],
      surface: hasOkInstituteData(instituteContext) ? buildInstituteSurface(instituteContext) : undefined,
      actions: []
    });
    return;
  }

  if (isBuddyWorkspaceIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: 'Opening the buddy enrolment workspace. Paste your notes in the buddy box, then Parse.' },
        createSuggestionsBlock([
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home'),
          createSendMessageSuggestion('Open Fees', 'take me to fees')
        ])
      ],
      surface: buildBuddyWorkspaceSurface('', [], undefined, courseOptionsFromUserMessage(payload)),
      actions: []
    });
    return;
  }

  if (isStudentEnrolIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: studentEnrolOpenMessage(readFormOptionsContext(payload)) },
        createSuggestionsBlock([
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home'),
          createSendMessageSuggestion('Open Fees', 'take me to fees')
        ])
      ],
      surface: buildStudentEnrolFormSurface(readFormOptionsContext(payload)),
      actions: []
    });
    return;
  }

  if (isOrgAddIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: orgAddOpenMessage(readFormOptionsContext(payload)) },
        createSuggestionsBlock([
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home'),
          createSendMessageSuggestion('Open Fees', 'take me to fees')
        ])
      ],
      surface: buildOrgAddFormSurface(readFormOptionsContext(payload)),
      actions: []
    });
    return;
  }

  if (isMarksCardIntent(text)) {
    const mentionsFa1 = text.toLowerCase().indexOf('fa1') >= 0;
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        {
          type: 'text',
          text: mentionsFa1
            ? 'Marks cards are sent from Connect. Opening the marks-card recipients screen so you can continue with FA1 selection there. (Demo: no email is sent yet.)'
            : 'Marks cards are sent from Connect. Opening the marks-card recipients screen. (Demo: no email is sent yet.)'
        },
        createSuggestionsBlock([
          createSendMessageSuggestion('Open Home', 'take me home'),
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Fees', 'take me to fees')
        ])
      ],
      actions: [createNavigateAction(CONNECT_MARKS_CARD_ROUTE)]
    });
    return;
  }

  if (isFeesTransactionsNavigationIntent(text)) {
    const alreadyOnPage = normalizeRoute(currentRoute) === FEES_TRANSACTIONS_ROUTE;
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: alreadyOnPage ? 'You are already on Fee Transactions.' : 'Opening Fee Transactions.' },
        createSuggestionsBlock([
          createSendMessageSuggestion('Collect fees', 'collect fees'),
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Open Home', 'take me home')
        ])
      ],
      actions: alreadyOnPage ? [] : [createNavigateAction(FEES_TRANSACTIONS_ROUTE)]
    });
    return;
  }

  if (isFeesNavigationIntent(text)) {
    const alreadyOnFees = normalizeRoute(currentRoute) === FEES_OVERVIEW_ROUTE;
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: alreadyOnFees ? 'You are already on Fees.' : 'Opening Fees.' },
        createSuggestionsBlock([
          createSendMessageSuggestion('Open fee transactions', 'take me to fee transactions'),
          createSendMessageSuggestion('Collect fees', 'collect fees'),
          createSendMessageSuggestion('Institute info', 'institute info')
        ])
      ],
      actions: alreadyOnFees ? [] : [createNavigateAction(FEES_OVERVIEW_ROUTE)]
    });
    return;
  }

  if (isHomeNavigationIntent(text)) {
    const alreadyOnHome = normalizeRoute(currentRoute) === HOME_ROUTE;
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [
        { type: 'text', text: alreadyOnHome ? 'You are already on Home.' : 'Opening Home.' },
        createSuggestionsBlock([
          createSendMessageSuggestion('Open Fees', 'take me to fees'),
          createSendMessageSuggestion('Institute info', 'institute info'),
          createSendMessageSuggestion('Send marks cards', 'send marks cards')
        ])
      ],
      actions: alreadyOnHome ? [] : [createNavigateAction(HOME_ROUTE)]
    });
    return;
  }

  if (isUnknownNavigationIntent(text)) {
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: buildUnknownNavigationFallbackBlocks(),
      actions: []
    });
    return;
  }

  const viewSummary = summarizeVisibleView(text, viewContext);
  if (viewSummary) {
    const viewQa = inspectViewQa(text, viewContext);
    logger.debug(
      '[mock-harness] canned view-qa source=%s rowCount=%s nameMatched=%s dateConstrained=%s dateMatched=%s',
      'fallback_summary',
      viewQa ? viewQa.rowCount : 0,
      viewQa ? viewQa.nameMatched : false,
      viewQa ? viewQa.dateConstrained : false,
      viewQa ? viewQa.dateMatched : false
    );
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [{ type: 'text', text: viewSummary }],
      actions: []
    });
    return;
  }

  const feeAnswer = (isUnderFees || isFeesViewContext(viewContext))
    ? answerFeesAmountQuestion(text, viewContext)
    : null;
  if (feeAnswer) {
    const viewQa = inspectViewQa(text, viewContext);
    logger.debug(
      '[mock-harness] canned view-qa source=%s rowCount=%s nameMatched=%s dateConstrained=%s dateMatched=%s',
      'fallback_fees',
      viewQa ? viewQa.rowCount : 0,
      viewQa ? viewQa.nameMatched : false,
      viewQa ? viewQa.dateConstrained : false,
      viewQa ? viewQa.dateMatched : false
    );
    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: [{ type: 'text', text: feeAnswer }],
      actions: []
    });
    return;
  }

  await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
    conversationId,
    correlationId: null,
    messages: [{ type: 'text', text: 'I can help with Fees, Institute info, marks cards, and Home. Try: take me to fees, collect fees, institute info, send marks cards, or take me home.' }],
    actions: []
  });
}

async function handleLiveUserMessage(socket: any, payload: HostUserMessage, connectionContext: ConnectionContext): Promise<void> {
  const conversationId = sanitizeConversationId(payload.conversationId);
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const endpoint = resolveChatCompletionsUrl(config.live.baseUrl);
  if (!text) {
    sendError(socket, conversationId, 'bad_request', 'user_message.text must be a non-empty string.');
    return;
  }

  // BW-T3: workspace-open intents were served deterministically here; H3+
  // removed that gate for LIVE mode: the main agent decides by meaning
  // (AGENTS.md rule 23) and may return a buddy-enrol-workspace surface, which
  // the host passes through as-is (empty records on the open turn; Parse owns
  // records). No host phrase gate and no post-LLM workspace repair in live
  // mode; the canned/deterministic path below keeps its gate.


  if (!config.live.apiKey || !config.live.model) {
    logger.error(
      '[mock-harness] live turn conversationId=%s path=live endpoint=%s model=%s status=%s latencyMs=%s mapping=%s message=%s',
      conversationId,
      endpoint || '(empty)',
      config.live.model || '(missing)',
      0,
      0,
      'error',
      'Live mode is not configured. Set API key and model for the live provider.'
    );
    sendError(
      socket,
      conversationId,
      'configuration_error',
      'Live mode is not configured. Set API key and model for the live provider.'
    );
    return;
  }

  try {
    const currentRoute = readCurrentRoute(payload);
    const instituteContext = readInstituteContext(payload);
    logger.info(
      '[mock-harness] live turn conversationId=%s path=live endpoint=%s model=%s instituteStatus=%s',
      conversationId,
      endpoint || '(empty)',
      config.live.model,
      instituteContext && instituteContext.status ? instituteContext.status : '(none)'
    );
    const moduleFlags = readModuleFlags(payload);
    const contextFlags = readContextFlags(payload);
    const viewContext = readViewContext(payload);
    const formOptions = readFormOptionsContext(payload);

    const liveResult = await callOpenAICompatibleChat({
      baseUrl: config.live.baseUrl,
      apiKey: config.live.apiKey,
      model: config.live.model,
      temperature: config.live.temperature,
      userText: text,
      contextRoute: currentRoute,
      contextPersona: readPersona(payload),
      contextFocus: readContextFocus(payload),
      contextModuleFlags: moduleFlags,
      contextFlags: contextFlags,
      contextView: viewContext,
      contextInstitute: instituteContext,
      contextFormOptions: formOptions,
      systemPrompt: liveSystemPrompt,
      logger
    });
    logger.info(
      '[mock-harness] live turn conversationId=%s path=live endpoint=%s model=%s status=%s latencyMs=%s mapping=%s',
      conversationId,
      liveResult.endpoint,
      liveResult.model,
      liveResult.statusCode,
      liveResult.latencyMs,
      'success'
    );
    logger.debug(
      '[mock-harness] live turn debug conversationId=%s responseBytes=%s finishReason=%s',
      conversationId,
      liveResult.responseBytes,
      liveResult.finishReason || '(none)'
    );
    const repaired = mapLiveOutputToAssistant(
      text,
      currentRoute,
      liveResult.text,
      instituteContext,
      viewContext,
      moduleFlags,
      contextFlags,
      formOptions
    );
    if (repaired.debug && repaired.debug.active) {
      logger.debug(
        '[mock-harness] live view-qa conversationId=%s source=%s rowCount=%s nameMatched=%s dateConstrained=%s dateMatched=%s',
        conversationId,
        repaired.debug.source,
        repaired.debug.rowCount,
        repaired.debug.nameMatched,
        repaired.debug.dateConstrained,
        repaired.debug.dateMatched
      );
    }

    const fieldQuestion = detectInstituteFieldQuestion(text);
    const expectedSurface = (!fieldQuestion && isInstituteInfoIntent(text))
      ? (hasOkInstituteData(instituteContext) ? buildInstituteSurface(instituteContext) : undefined)
      : (isBuddyWorkspaceIntent(text)
        ? buildBuddyWorkspaceSurface('', [], undefined, courseOptionsFromUserMessage(payload))
        : (isStudentEnrolIntent(text)
          ? buildStudentEnrolFormSurface(formOptions)
          : (isOrgAddIntent(text) ? buildOrgAddFormSurface(formOptions) : undefined)));
    const modelSurface = repaired.surface;
    const initialSurface = expectedSurface && isFormSurfaceIntent(text)
      ? (surfaceTypeMatches(modelSurface, expectedSurface) ? modelSurface : expectedSurface)
      : (modelSurface || expectedSurface);
    const liveRepaired = applyLiveTurnRepairs(
      text,
      currentRoute,
      repaired.messages,
      repaired.actions,
      instituteContext,
      initialSurface,
      conversationId,
      formOptions
    );

    // H5: on a live open-workspace turn the model's `fields[]` IS the field
    // list — remember it for this conversation and reuse the SAME array on
    // the sanitize/parse hops and the parse reply surface. No TS field list
    // is rebuilt for live.
    rememberBuddyFieldsFromSurface(conversationId, liveRepaired.surface);

    await sendAssistantResponseForTurn(socket, connectionContext.userId, payload, {
      conversationId,
      correlationId: null,
      messages: liveRepaired.messages,
      actions: liveRepaired.actions,
      surface: overwriteSurfaceCourseOptions(liveRepaired.surface, formOptions)
    });
  } catch (error) {
    const liveError = error as LiveChatError;
    const hasDetails = liveError && liveError.details;
    const statusCode = hasDetails ? liveError.details.statusCode : 0;
    const latencyMs = hasDetails ? liveError.details.latencyMs : 0;
    const safeMessage = hasDetails
      ? liveError.details.safeMessage
      : (error && (error as Error).message ? (error as Error).message : 'Unknown live provider failure.');
    const failedEndpoint = hasDetails ? liveError.details.endpoint : (endpoint || '(empty)');
    const failedModel = hasDetails ? liveError.details.model : (config.live.model || '(missing)');
    const responseBytes = hasDetails ? liveError.details.responseBytes : 0;

    logger.error(
      '[mock-harness] live turn conversationId=%s path=live endpoint=%s model=%s status=%s latencyMs=%s mapping=%s message=%s',
      conversationId,
      failedEndpoint,
      failedModel,
      statusCode,
      latencyMs,
      'error',
      safeMessage
    );
    logger.debug(
      '[mock-harness] live turn debug conversationId=%s responseBytes=%s finishReason=%s',
      conversationId,
      responseBytes,
      '(none)'
    );
    if (hasDetails) {
      logger.debug(
        '[mock-harness] live turn error-details conversationId=%s details=%s',
        conversationId,
        safeStringifyDebug(liveError.details)
      );
    } else if (error && (error as Error).stack) {
      logger.debug(
        '[mock-harness] live turn error-stack conversationId=%s stack=%s',
        conversationId,
        (error as Error).stack
      );
    }
    sendError(
      socket,
      conversationId,
      'internal_error',
      'Live response is unavailable right now. Please try again shortly.'
    );
  }
}

function isFeesNavigationIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasFees = /\bfees?\b/.test(normalized);
  return hasFees && hasNavigationPhrase(normalized);
}

function isFeesTransactionsNavigationIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  if (/\bfees?\s+transactions?\b/.test(normalized)) {
    return true;
  }
  return hasNavigationPhrase(normalized)
    && /\bfees?\b[\s-]*(?:transaction|transactions)|\b(?:transaction|transactions)\b[\s-]*fees?/.test(normalized);
}

function hasNavigationPhrase(normalizedText: string): boolean {
  return /(take me|go to|open|navigate|bring me|show me)/.test(normalizedText);
}

function isHomeNavigationIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\bhome\b/.test(normalized) && hasNavigationPhrase(normalized);
}

function isUnknownNavigationIntent(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized || !hasNavigationPhrase(normalized)) {
    return false;
  }

  if (
    isFeesTransactionsNavigationIntent(text)
    || isFeesNavigationIntent(text)
    || isCollectFeesIntent(text)
    || isInstituteInfoIntent(text)
    || isStudentEnrolIntent(text)
    || isOrgAddIntent(text)
    || isMarksCardIntent(text)
    || isHomeNavigationIntent(text)
    || isFeesAmountQuestion(text)
  ) {
    return false;
  }
  return true;
}

function isCollectFeesIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\bcollect\b/.test(normalized) && /\bfees?\b/.test(normalized);
}

function isInstituteInfoIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) {
    return false;
  }

  if (/\b(inst|institute)\s+(info|information|details?)\b/.test(normalized)) {
    return true;
  }
  if (/\b(org|organization|organisation)\s+(info|information|details?)\b/.test(normalized)) {
    return true;
  }
  if (/\bschool\s+(info|information|details?)\b/.test(normalized)) {
    return true;
  }
  if (/(tell me about|about)\s+(the\s+)?(inst|institute|org|organization|organisation|school)\b/.test(normalized)) {
    return true;
  }
  if (/(info|information|details?)\s+(about|on)\s+(the\s+)?(inst|institute|org|organization|organisation|school)\b/.test(normalized)) {
    return true;
  }
  return false;
}

function isStudentEnrolIntent(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return /(^|\b)(enroll\s+student|enrol\s+student|student\s+enroll|student\s+enrol|add\s+student|student\s+enrollment|student\s+enrolment)(\b|$)/.test(normalized);
}

// BW-T3 + H3: buddy enrolment workspace intents. Checked BEFORE
// isStudentEnrolIntent so batch-enrol asks open the workspace surface, never
// the thin student-enrol-form, and never navigate.
// H3: match by MEANING, not a closed phrase list — the goal is batch enrol
// from pasted / messy notes, a list, or several named students ("these
// kids", "parse this", buddy/batch enrol, clear typos of the same idea).
// A single-student ask ("enroll student" / "add student") keeps rule 19 and
// the thin form: singular nouns and no notes/list wording never match here.
function isBuddyWorkspaceIntent(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  // "buddy…" (buddy, budy, buddi, buddies) always means the workspace; so
  // does any parse ask ("parse this", "parse my notes", typos included).
  if (/\bbud+[dy]/.test(normalized) || /\bpar[sz]+[e3]?[dgs]?\b/.test(normalized)) {
    return true;
  }
  // Enrol-family verb (typo-tolerant: enr… / enro… / enrolll / enrool …).
  const enrolVerb = /\b(enr[o0]+[l1|p]+[a-z]*|admi[rt][a-z]*|registr[a-z]*|adds?|adding|added|puts?|putting|imports?|importing|entered?|entering|upload[a-z]*|load[sz]?)\b/.test(normalized);
  if (!enrolVerb) {
    return false;
  }
  // Notes / list wording (typos included: nots, listt, sheat …).
  const notesWording = /\b(notes?|nots?|notez|messy|pasted?|pasting|lists?|listt|sheet|sheat|spreadsheet|file|below)\b/.test(normalized);
  // Several-students wording: plural nouns only, so singular asks
  // ("enroll the student") stay on the thin form.
  const severalWording = /\b(these|all|the|my)\s+(students|kids|children|pupils|names|records|entries|details)\b/.test(normalized)
    || /\b(batch|bulk|multiple|several|couple)\b/.test(normalized)
    || /\b(students|kids|children|pupils)\b/.test(normalized);
  return notesWording || severalWording;
}

function isOrgAddIntent(text: string): boolean {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return /(^|\b)(org\s+add|add\s+org|add\s+organization|add\s+organisation)(\b|$)/.test(normalized);
}

function isFormSurfaceIntent(text: string): boolean {
  return isBuddyWorkspaceIntent(text) || isStudentEnrolIntent(text) || isOrgAddIntent(text);
}

// BW-T5A: never ship the model's course list — overwrite the courseId
// options on enrol/workspace surfaces from the host's deduped, capped
// formOptions.courses. Empty host list stays empty (no demo fallback).
function overwriteSurfaceCourseOptions(
  surface: InstituteSurface | Record<string, unknown> | undefined,
  formOptions?: FormOptionsContext | null
): InstituteSurface | Record<string, unknown> | undefined {
  if (!surface || typeof surface !== 'object') {
    return surface;
  }
  const type = String((surface as any).type || '');
  if (type !== 'student-enrol-form' && type !== 'buddy-enrol-workspace') {
    return surface;
  }
  const courseOptions = mapSelectOptions(formOptions && formOptions.courses);
  const container = type === 'student-enrol-form'
    ? ((surface as any).schema && typeof (surface as any).schema === 'object' ? (surface as any).schema : null)
    : (surface as any);
  if (!container || !Array.isArray(container.fields)) {
    return surface;
  }
  const fields = container.fields.map((field: any) => {
    if (!field || field.id !== 'courseId') {
      return field;
    }
    return Object.assign({}, field, { options: courseOptions });
  });
  const next: any = Object.assign({}, surface);
  if (type === 'student-enrol-form') {
    next.schema = Object.assign({}, container, { fields: fields });
  } else {
    next.fields = fields;
  }
  return next;
}

function surfaceTypeMatches(
  surface: InstituteSurface | Record<string, unknown> | undefined,
  expected: InstituteSurface | Record<string, unknown>
): boolean {
  return !!surface
    && typeof surface === 'object'
    && String((surface as any).type || (surface as any).kind || '')
      === String((expected as any).type || (expected as any).kind || '');
}

function isInstitutePageNavigationIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) {
    return false;
  }

  if (/\b(open|go to|take me to|navigate to|bring me to)\s+(the\s+)?(institute|inst)\s+(page|admin|management|dashboard)\b/.test(normalized)) {
    return true;
  }
  if (/\b(open|go to|take me to|navigate to|bring me to)\s+(the\s+)?(institute|inst)\s+admin\b/.test(normalized)) {
    return true;
  }
  if (/\b(open|go to|take me to|navigate to|bring me to)\s+admin\s+(the\s+)?(institute|inst)\b/.test(normalized)) {
    return true;
  }
  return false;
}

function isMarksCardIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasMarksCard = (
    normalized.indexOf('marks card') >= 0 ||
    normalized.indexOf('marks cards') >= 0 ||
    normalized.indexOf('markscard') >= 0
  );
  const hasSendOrEmail = (
    normalized.indexOf('send') >= 0 ||
    normalized.indexOf('email') >= 0 ||
    normalized.indexOf('fa1') >= 0
  );
  return hasMarksCard || (hasSendOrEmail && normalized.indexOf('marks') >= 0 && normalized.indexOf('card') >= 0);
}

function loadLiveSystemPrompt(): string {
  try {
    if (fs.existsSync(LIVE_PROMPT_PATH)) {
      const content = fs.readFileSync(LIVE_PROMPT_PATH, 'utf8').trim();
      if (content) {
        return content;
      }
    }
  } catch (error) {
    logger.error('[mock-harness] failed to read live prompt file path=%s', LIVE_PROMPT_PATH);
  }
  return defaultLiveSystemPrompt();
}

function defaultLiveSystemPrompt(): string {
  return [
    'You are CT-Bot for CampusTrack, a school admin web application.',
    'Return protocol JSON only.',
    'Schema: {"messages":[...],"actions":[...],"surface": optional institute-summary | student-enrol-form | org-add-form | buddy-enrol-workspace}. Omit surface otherwise.',
    'Batch enrol from notes / a list / several students (decide by meaning) may return a buddy-enrol-workspace surface with EMPTY records: type, title, formId student-enrol-buddy, submitAction student.enrol.submit, buddy.text "", records [], fields per this turn\'s field list; never invent students or records on the open turn.',
    'Allowed messages: text, markdown, suggestions, link, form, confirmation.',
    'Allowed actions: navigate, change_state.',
    'For in-app navigation that should auto-navigate, prefer a navigate action with an internal route. Use link blocks only as click fallback when needed.',
    'Use only in-app navigation routes that start with /. Never output external http/https links for these routes.',
    'Known routes: /home, /fees, /fees/transactions, /fees/add, /admin/inst, /connect/marksCardRecipients.',
    'Read context.route and moduleFlags/flags on every turn. If the user asks for a route they are already on, say so, omit navigate, and suggest up to 3 different send_message next steps.',
    'For "take me to fees" (or open/go to fees), include a navigate action to /fees when context.route is not already /fees. If already on /fees, say so and omit navigate. Always include a short text message. Do not return an institute summary or institute-summary surface for this intent. context.institute may be omitted on navigation turns.',
    'For "take me to fee transactions" / "open fee transactions" / "fee transactions", include a navigate action to /fees/transactions when the user is not already there. If already there, say so and omit navigate. Always include a short text message. Do not return an institute summary.',
    'For home requests ("take me home", "go home", "open home"), include a navigate action to /home when the user is not already on Home. If already on Home, say so and omit navigate. Always include a short text message. Do not return an institute summary.',
    'For institute info / institute details / tell me about the institute: if context.institute.status is ok and useful fields exist, return a short bullet summary of those real fields (or one line that the side panel opened) and the institute-summary surface, plus 1-3 allowlisted send_message chips. Never say unavailable when ok data is present. If status is unavailable or data is missing, say so honestly and omit a rich summary surface. Do not auto-navigate.',
    'If the user asks for the institute name, short name, address, status, or academic year, answer only from context.institute on this turn (the host may fetch a fresh snapshot for that question, or reuse an earlier ok snapshot). Do not invent values. If context has no ok institute data or the field is missing, say it is not available in context. Do not return the institute-summary surface for a single-field question.',
    'For explicit institute page navigation requests ("open institute page", "take me to institute page", "open institute admin"), return a navigate action to /admin/inst and omit the institute-summary surface.',
    'For fee/view questions, use context.view when module=fees and treat columns/row keys as the source of truth.',
    'Interpret date constraints flexibly across date-like keys (ISO datetime, YYYY-MM-DD, DD-MM-YY/DD-MM-YYYY).',
    'If a student name clearly matches rows, do not answer "not found"; summarize those matching rows.',
    'If a user constrains by date and no row matches after reasonable interpretation, say no matching row exists in the current view.',
    'Never invent paid/due/date values; if a requested field is not present, say it is unavailable in the current view.',
    'For "what can you see?" requests, summarize the current view in plain language. Do not emit raw JSON blobs in text.',
    'If focus exists in host context and user refers to "this student" or similar, use the provided focus id/label and do not invent focus.',
    'For marks card / send marks cards, navigate to /connect/marksCardRecipients only when the user is not already there.',
    'For unknown navigation requests, return a concise refusal with no navigate action and optional send_message tips only. Never combine refusal text with a navigate action.',
    'If a typo clearly identifies an allowlisted intent, treat it as that intent and use the success path; otherwise refuse without navigation.',
    'You may include a suggestions block with 1-3 concise, varied follow-up chips. Suggestions must use send_message with payload.text; never use navigate for a suggestion chip and never repeat the just-completed utterance or navigation.',
    'Suggestion payload.text must be one of: take me to fees, open fees, collect fees, take me to fee transactions, take me home, go home, open home, institute info, tell me about the institute, add student, enrol student, enroll student, add organization, add org, add organisation, send marks cards. Never suggest view student list, card balance/settings, or banking.',
    'Do not claim payment was recorded, marks-card emails were sent, a student was enrolled, or an organization was created unless a real backend confirms it.',
    'Human-in-the-loop forms use top-level surface (not an in-thread form block). Include type, id, title, schema.fields, optional data, and submit metadata (formId, submitAction, correlationId). User submits via host emit_event form_submit; the host persists through the real CTApi save path. A separate form_continue event opens the full in-app form with current values and is not a save.',
    'For add/enrol/enroll student, return student-enrol-form with required fields name (text), dob (date, dd/mm/yyyy), gender (select), courseId (select). Labels: Name, Date Of Birth, Gender, Course. submitAction student.enrol.submit. Do not auto-navigate unless the user also asked to open an allowlisted route.',
    'For add organization/org/organisation, return org-add-form with name, shortName (max 6 hint OK), parentId (select), ownerId (select). submitAction org.add.submit. Do not return institute-summary for this intent.',
    'Use select options when present on schema or host context.formOptions (courses, parentOrgs, ownerOrgs as {value,label}[]). Gender may stay Female/Male. If course/parent/owner options are missing, use empty options and do not invent lists such as Grade 1 A or Demo Public School.',
    'After form_submit, the host reports the real save result. Do not claim enrollment or org creation succeeded unless that real result is already in the conversation. After form_continue, do not claim the record was created.'
  ].join('\n');
}

function mapLiveOutputToAssistant(
  userText: string,
  currentRoute: string,
  modelText: string,
  instituteContext: InstituteContextSnapshot | null,
  viewContext: HostViewContext | null,
  moduleFlags: HostModuleFlagsContext,
  contextFlags: HostFlagsContext,
  formOptions?: FormOptionsContext | null
): {
  messages: AssistantMessageBlock[];
  actions: AssistantAction[];
  surface?: Record<string, unknown>;
  debug: ViewQaDebug;
} {
  const parsed = parseStructuredLiveOutput(modelText);
  const messages = sanitizeMessages(parsed ? parsed.messages : []);
  const actions = sanitizeActions(parsed ? parsed.actions : []);
  const viewQa = inspectViewQa(userText, viewContext);
  const debug: ViewQaDebug = {
    active: !!viewQa,
    source: hasTextLikeMessage(messages) ? 'llm' : 'n/a',
    rowCount: viewQa ? viewQa.rowCount : 0,
    nameMatched: viewQa ? viewQa.nameMatched : false,
    dateConstrained: viewQa ? viewQa.dateConstrained : false,
    dateMatched: viewQa ? viewQa.dateMatched : false
  };
  const safeMessages = messages.length
    ? messages
    : [createTextBlock('I can help with Fees, Home, institute info, adding a student or organization, and marks cards. Try one of those.')];
  const safeActions = assistantTextRefusesNavigation(safeMessages) ? [] : actions;
  return {
    messages: normalizeSuggestionBlocks(safeMessages),
    actions: safeActions,
    surface: parsed && parsed.surface && typeof parsed.surface === 'object' ? parsed.surface : undefined,
    debug: debug
  };
}

function applyLiveTurnRepairs(
  userText: string,
  currentRoute: string,
  messages: AssistantMessageBlock[],
  actions: AssistantAction[],
  instituteContext: InstituteContextSnapshot | null,
  surface: InstituteSurface | Record<string, unknown> | undefined,
  conversationId: string,
  formOptions?: FormOptionsContext | null
): { messages: AssistantMessageBlock[]; actions: AssistantAction[]; surface: InstituteSurface | Record<string, unknown> | undefined } {
  const navKind = detectClearNavigationKind(userText);
  if (navKind) {
    const nav = repairClearNavigation(navKind, currentRoute, messages, actions, userText, conversationId, surface);
    return { messages: nav.messages, actions: nav.actions, surface: undefined };
  }

  const field = detectInstituteFieldQuestion(userText);
  if (field) {
    logger.info(
      '[mock-harness] institute field repair conversationId=%s field=%s instituteStatus=%s',
      conversationId,
      field,
      instituteContext && instituteContext.status ? instituteContext.status : '(none)'
    );
    return {
      messages: ensureSuggestionChips(
        [createTextBlock(buildInstituteFieldAnswer(userText, instituteContext))],
        defaultInstituteFollowUpSuggestions(),
        userText,
        conversationId
      ),
      actions: [],
      surface: undefined
    };
  }

  let nextSurface = surface;
  const repairedBuddySurface = isBuddyWorkspaceIntent(userText)
    && !surfaceTypeMatches(nextSurface, buildBuddyWorkspaceSurface('', [], undefined, mapSelectOptions(formOptions && formOptions.courses)));
  const repairedStudentSurface = !repairedBuddySurface
    && isStudentEnrolIntent(userText)
    && !surfaceTypeMatches(nextSurface, buildStudentEnrolFormSurface(formOptions));
  const repairedOrgSurface = isOrgAddIntent(userText)
    && !surfaceTypeMatches(nextSurface, buildOrgAddFormSurface(formOptions));
  if (repairedBuddySurface) {
    nextSurface = buildBuddyWorkspaceSurface('', [], undefined, mapSelectOptions(formOptions && formOptions.courses));
  } else if (repairedStudentSurface) {
    nextSurface = buildStudentEnrolFormSurface(formOptions);
  } else if (repairedOrgSurface) {
    nextSurface = buildOrgAddFormSurface(formOptions);
  }

  let nextMessages = repairInstituteUnavailableText(messages, instituteContext, nextSurface, conversationId);
  let nextActions = actions.slice();

  if (isInstituteInfoIntent(userText) && hasOkInstituteData(instituteContext)) {
    nextMessages = polishInstituteSummaryText(nextMessages, instituteContext, conversationId);
    nextMessages = ensureSuggestionChips(
      nextMessages,
      defaultInstituteFollowUpSuggestions(),
      userText,
      conversationId
    );
    return { messages: nextMessages, actions: [], surface: nextSurface };
  }

  if (!hasTextLikeMessage(nextMessages)) {
    nextMessages = [createTextBlock(defaultSafeFallbackText())].concat(nextMessages);
  }
  const nextSurfaceType = nextSurface && typeof nextSurface === 'object'
    ? String((nextSurface as any).type || (nextSurface as any).kind || '')
    : '';
  if (repairedBuddySurface || repairedStudentSurface || repairedOrgSurface
    || nextSurfaceType === 'buddy-enrol-workspace'
    || nextSurfaceType === 'student-enrol-form'
    || nextSurfaceType === 'org-add-form') {
    nextMessages = withFormOpenSuggestions(nextMessages, userText, conversationId);
  }
  return { messages: nextMessages, actions: nextActions, surface: nextSurface };
}

function withFormOpenSuggestions(
  messages: AssistantMessageBlock[],
  userText: string,
  conversationId: string
): AssistantMessageBlock[] {
  const nextMessages = messages.slice();
  removeSuggestionBlocks(nextMessages);
  const chips = [
    createSendMessageSuggestion('Institute info', 'institute info'),
    createSendMessageSuggestion('Open Home', 'take me home'),
    createSendMessageSuggestion('Open Fees', 'take me to fees')
  ].filter((chip) => normalizeSuggestionText(String(chip.payload.text || '')) !== normalizeSuggestionText(userText));
  logger.info('[mock-harness] form surface suggestions injected conversationId=%s count=%s', conversationId, chips.length);
  nextMessages.push(createSuggestionsBlock(chips.slice(0, 3)));
  return nextMessages;
}

function detectClearNavigationKind(text: string): 'fees' | 'transactions' | 'home' | 'marks' | null {
  if (isFeesTransactionsNavigationIntent(text)) {
    return 'transactions';
  }
  if (isCollectFeesIntent(text)) {
    return null;
  }
  if (isFeesNavigationIntent(text)) {
    return 'fees';
  }
  if (isHomeNavigationIntent(text)) {
    return 'home';
  }
  if (isMarksCardIntent(text)) {
    return 'marks';
  }
  return null;
}

function repairClearNavigation(
  kind: 'fees' | 'transactions' | 'home' | 'marks',
  currentRoute: string,
  messages: AssistantMessageBlock[],
  actions: AssistantAction[],
  userText: string,
  conversationId: string,
  surface: InstituteSurface | Record<string, unknown> | undefined
): { messages: AssistantMessageBlock[]; actions: AssistantAction[] } {
  const spec = {
    fees: {
      route: FEES_OVERVIEW_ROUTE,
      opening: 'Opening Fees.',
      already: 'You are already on Fees.',
      chips: [
        createSendMessageSuggestion('Open fee transactions', 'take me to fee transactions'),
        createSendMessageSuggestion('Collect fees', 'collect fees'),
        createSendMessageSuggestion('Institute info', 'institute info')
      ]
    },
    transactions: {
      route: FEES_TRANSACTIONS_ROUTE,
      opening: 'Opening Fee Transactions.',
      already: 'You are already on Fee Transactions.',
      chips: [
        createSendMessageSuggestion('Collect fees', 'collect fees'),
        createSendMessageSuggestion('Institute info', 'institute info'),
        createSendMessageSuggestion('Open Home', 'take me home')
      ]
    },
    home: {
      route: HOME_ROUTE,
      opening: 'Opening Home.',
      already: 'You are already on Home.',
      chips: [
        createSendMessageSuggestion('Open Fees', 'take me to fees'),
        createSendMessageSuggestion('Institute info', 'institute info'),
        createSendMessageSuggestion('Add student', 'add student')
      ]
    },
    marks: {
      route: CONNECT_MARKS_CARD_ROUTE,
      opening: userText.toLowerCase().indexOf('fa1') >= 0
        ? 'Marks cards are sent from Connect. Opening the marks-card recipients screen so you can continue with FA1 selection there. (Demo: no email is sent yet.)'
        : 'Marks cards are sent from Connect. Opening the marks-card recipients screen. (Demo: no email is sent yet.)',
      already: 'You are already on the marks-card recipients screen.',
      chips: [
        createSendMessageSuggestion('Open Home', 'take me home'),
        createSendMessageSuggestion('Institute info', 'institute info'),
        createSendMessageSuggestion('Open Fees', 'take me to fees')
      ]
    }
  }[kind];
  if (looksLikeInstituteDump(messages, surface)) {
    logger.info('[mock-harness] nav repair overrides institute conversationId=%s kind=%s', conversationId, kind);
  }
  return repairNavigationIntent(
    kind,
    spec.route,
    spec.opening,
    spec.already,
    currentRoute,
    messages,
    actions,
    userText,
    conversationId,
    spec.chips
  );
}

function looksLikeInstituteDump(
  messages: AssistantMessageBlock[],
  surface: InstituteSurface | Record<string, unknown> | undefined
): boolean {
  const surfaceType = surface && typeof surface === 'object' ? String((surface as any).type || (surface as any).kind || '') : '';
  if (surfaceType === 'institute-summary') {
    return true;
  }
  const text = joinAssistantText(messages).toLowerCase();
  if (!text) {
    return false;
  }
  return text.indexOf('institute') >= 0
    && (
      text.indexOf('academic year') >= 0
      || text.indexOf('short name') >= 0
      || text.indexOf('address') >= 0
      || text.indexOf('board') >= 0
    );
}

function repairNavigationIntent(
  kind: string,
  targetRoute: string,
  openingText: string,
  alreadyText: string,
  currentRoute: string,
  messages: AssistantMessageBlock[],
  actions: AssistantAction[],
  userText: string,
  conversationId: string,
  chips: Array<{ id: string; label: string; action: string; payload: Record<string, unknown> }>
): { messages: AssistantMessageBlock[]; actions: AssistantAction[] } {
  const alreadyThere = normalizeRoute(currentRoute) === normalizeRoute(targetRoute);
  const hasTargetNavigate = hasNavigateActionTo(actions, targetRoute);
  const needsNavigate = !alreadyThere && !hasTargetNavigate;
  logger.info(
    '[mock-harness] nav repair conversationId=%s kind=%s alreadyOnRoute=%s injectedText=%s injectedNavigate=%s',
    conversationId,
    kind,
    alreadyThere,
    true,
    needsNavigate
  );
  let nextMessages = replaceFirstTextLikeMessage(messages, alreadyThere ? alreadyText : openingText);
  nextMessages = ensureSuggestionChips(nextMessages, chips, userText, conversationId);
  let nextActions = actions.slice();
  if (alreadyThere) {
    nextActions = nextActions.filter((action: AssistantAction) => action.type !== 'navigate');
  } else {
    appendNavigateAction(nextActions, targetRoute);
  }
  return { messages: nextMessages, actions: nextActions };
}

function hasNavigateActionTo(actions: AssistantAction[], route: string): boolean {
  const target = normalizeRoute(route);
  return actions.some((action: AssistantAction) => {
    return action && action.type === 'navigate' && normalizeRoute((action as any).route) === target;
  });
}

function joinAssistantText(messages: AssistantMessageBlock[]): string {
  return messages
    .map((message: AssistantMessageBlock) => {
      if (message.type === 'text') {
        return String((message as any).text || '');
      }
      if (message.type === 'markdown') {
        return String((message as any).markdown || '');
      }
      return '';
    })
    .join(' ')
    .trim();
}

function isGenericCapabilityFallbackText(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  return normalized.indexOf('i can help with fees') >= 0
    || normalized.indexOf('try one of those') >= 0;
}

function hasSuggestionItems(messages: AssistantMessageBlock[]): boolean {
  return messages.some((message: AssistantMessageBlock) => {
    return message.type === 'suggestions'
      && Array.isArray((message as any).items)
      && (message as any).items.length > 0;
  });
}

function defaultInstituteFollowUpSuggestions(): Array<{ id: string; label: string; action: string; payload: Record<string, unknown> }> {
  return [
    createSendMessageSuggestion('Open Fees', 'open fees'),
    createSendMessageSuggestion('Take me home', 'take me home'),
    createSendMessageSuggestion('Add student', 'add student')
  ];
}

function ensureSuggestionChips(
  messages: AssistantMessageBlock[],
  chips: Array<{ id: string; label: string; action: string; payload: Record<string, unknown> }>,
  userText: string,
  conversationId: string
): AssistantMessageBlock[] {
  if (hasSuggestionItems(messages)) {
    return messages;
  }
  const filtered = chips.filter((chip) => {
    const payloadText = chip.payload && typeof chip.payload.text === 'string' ? chip.payload.text : '';
    return normalizeSuggestionText(payloadText) !== normalizeSuggestionText(userText);
  }).slice(0, 3);
  if (!filtered.length) {
    return messages;
  }
  logger.info('[mock-harness] suggestions injected conversationId=%s count=%s', conversationId, filtered.length);
  return messages.concat([createSuggestionsBlock(filtered)]);
}

function polishInstituteSummaryText(
  messages: AssistantMessageBlock[],
  instituteContext: InstituteContextSnapshot | null,
  conversationId: string
): AssistantMessageBlock[] {
  const summary = buildInstituteSummaryMessage(instituteContext, false);
  const current = joinAssistantText(messages);
  const name = instituteContext && instituteContext.data ? readDisplayValue(instituteContext.data.name) : '';
  const tooLong = current.length > 420;
  const looksDumped = /[{[]/.test(current);
  const missingName = !!(name && current.toLowerCase().indexOf(name.toLowerCase()) < 0);
  if (!current || tooLong || looksDumped || missingName || assistantClaimsInstituteUnavailable(messages)) {
    logger.info('[mock-harness] institute text polish conversationId=%s', conversationId);
    return replaceFirstTextLikeMessage(messages, summary);
  }
  return messages;
}

function detectInstituteFieldQuestion(text: string): 'name' | 'shortName' | 'address' | 'status' | 'academicYear' | null {
  const normalized = String(text || '').toLowerCase();
  if (!/\b(institute|inst|school|org|organization|organisation)\b/.test(normalized)) {
    return null;
  }
  if (/\b(short\s*name|shortname)\b/.test(normalized)) {
    return 'shortName';
  }
  if (/\b(academic\s*year|acad(?:emic)?\s*year)\b/.test(normalized)) {
    return 'academicYear';
  }
  if (/\baddress\b/.test(normalized)) {
    return 'address';
  }
  if (/\bstatus\b/.test(normalized)) {
    return 'status';
  }
  if (/\bname\b/.test(normalized) && !/\b(info|information|details?)\b/.test(normalized)) {
    return 'name';
  }
  return null;
}

function buildInstituteFieldAnswer(
  text: string,
  instituteContext: InstituteContextSnapshot | null
): string {
  const field = detectInstituteFieldQuestion(text);
  if (!hasOkInstituteData(instituteContext) || !field || !instituteContext || !instituteContext.data) {
    return 'That institute field is not available in the current context.';
  }
  const data = instituteContext.data;
  if (field === 'name') {
    const value = readDisplayValue(data.name);
    return value ? 'The institute name is ' + value + '.' : 'The institute name is not available in the current context.';
  }
  if (field === 'shortName') {
    const value = readDisplayValue(data.shortName);
    return value ? 'The institute short name is ' + value + '.' : 'The institute short name is not available in the current context.';
  }
  if (field === 'address') {
    const value = formatInstituteAddress(data.address) || readDisplayValue(data.address);
    return value ? 'The institute address is ' + value + '.' : 'The institute address is not available in the current context.';
  }
  if (field === 'status') {
    const value = readDisplayValue(data.status);
    return value ? 'The institute status is ' + value + '.' : 'The institute status is not available in the current context.';
  }
  const year = formatAcademicYear(data.academicYearFrom, data.academicYearTo);
  return year && year !== 'Unknown'
    ? 'The academic year is ' + year + '.'
    : 'The academic year is not available in the current context.';
}

function parseStructuredLiveOutput(modelText: string): { messages: any[]; actions: any[]; surface?: any } | null {
  const parsed = parseJsonFromModelText(modelText);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate: any = parsed;
  if (Array.isArray(candidate.messages) || Array.isArray(candidate.actions)) {
    return {
      messages: Array.isArray(candidate.messages) ? candidate.messages : [],
      actions: Array.isArray(candidate.actions) ? candidate.actions : [],
      surface: candidate.surface && typeof candidate.surface === 'object' ? candidate.surface : undefined
    };
  }

  if (
    candidate.type === 'assistant_response'
    && (Array.isArray(candidate.messages) || Array.isArray(candidate.actions))
  ) {
    return {
      messages: Array.isArray(candidate.messages) ? candidate.messages : [],
      actions: Array.isArray(candidate.actions) ? candidate.actions : [],
      surface: candidate.surface && typeof candidate.surface === 'object' ? candidate.surface : undefined
    };
  }

  return null;
}

function parseJsonFromModelText(modelText: string): any {
  const trimmed = typeof modelText === 'string' ? modelText.trim() : '';
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // fall through
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    const fencedJson = fencedMatch[1].trim();
    try {
      return JSON.parse(fencedJson);
    } catch (error) {
      // fall through
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const possibleJson = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(possibleJson);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function sanitizeMessages(rawMessages: any[]): AssistantMessageBlock[] {
  const sanitized: AssistantMessageBlock[] = [];
  rawMessages.forEach((raw: any) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    if (raw.type === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
      sanitized.push(createTextBlock(raw.text));
      return;
    }
    if (raw.type === 'markdown' && typeof raw.markdown === 'string' && raw.markdown.trim()) {
      sanitized.push({ type: 'markdown', markdown: raw.markdown.trim() });
      return;
    }
    if (raw.type === 'link') {
      const label = typeof raw.label === 'string' ? raw.label.trim() : '';
      const href = normalizeRoute(raw.href);
      const target = raw.target === 'external' ? 'external' : 'internal';
      if (label && target === 'internal' && isAllowedRoute(href)) {
        sanitized.push({
          type: 'link',
          id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined,
          label: label,
          href: href,
          target: 'internal'
        } as AssistantMessageBlock);
      }
      return;
    }
    if (raw.type === 'suggestions' && Array.isArray(raw.items)) {
      const items = raw.items
        .map((rawItem: any) => sanitizeSuggestionItem(rawItem))
        .filter((item: any) => !!item);
      const cleanItems = dedupeAndCapSuggestions(items);
      if (cleanItems.length) {
        sanitized.push({
          type: 'suggestions',
          id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined,
          items: cleanItems
        } as AssistantMessageBlock);
      }
      return;
    }
    if (
      raw.type === 'form'
      && typeof raw.formId === 'string'
      && typeof raw.submitAction === 'string'
      && typeof raw.correlationId === 'string'
      && Array.isArray(raw.fields)
      && raw.formId.trim()
      && raw.submitAction.trim()
      && raw.correlationId.trim()
    ) {
      sanitized.push(raw as AssistantMessageBlock);
      return;
    }
    if (
      raw.type === 'confirmation'
      && typeof raw.text === 'string'
      && typeof raw.confirmAction === 'string'
      && typeof raw.cancelAction === 'string'
      && typeof raw.correlationId === 'string'
      && raw.text.trim()
      && raw.confirmAction.trim()
      && raw.cancelAction.trim()
      && raw.correlationId.trim()
    ) {
      sanitized.push({
        type: 'confirmation',
        text: raw.text.trim(),
        confirmAction: raw.confirmAction.trim(),
        cancelAction: raw.cancelAction.trim(),
        correlationId: raw.correlationId.trim()
      } as AssistantMessageBlock);
    }
  });
  return sanitized;
}

function sanitizeSuggestionItem(rawItem: any): any | null {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }
  const id = typeof rawItem.id === 'string' ? rawItem.id.trim() : '';
  const label = typeof rawItem.label === 'string' ? rawItem.label.trim() : '';
  const action = typeof rawItem.action === 'string' ? rawItem.action.trim().toLowerCase() : '';
  const payload = rawItem.payload && typeof rawItem.payload === 'object' ? rawItem.payload as Record<string, unknown> : {};
  if (!id || !label || !action) {
    return null;
  }

  if (action === 'send_message') {
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      return null;
    }
    return { id: id, label: label, action: 'send_message', payload: { text: text } };
  }

  if (action === 'navigate') {
    const href = normalizeRoute(String(payload.href || payload.route || ''));
    const target = payload.target === 'external' ? 'external' : 'internal';
    if (target !== 'internal' || !isAllowedRoute(href)) {
      return null;
    }
    return { id: id, label: label, action: 'send_message', payload: { text: suggestionPromptForRoute(href, label) } };
  }

  return null;
}

function sanitizeActions(rawActions: any[]): AssistantAction[] {
  const sanitized: AssistantAction[] = [];
  rawActions.forEach((raw: any) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    if (raw.type === 'change_state' && isPlainObject(raw.patch)) {
      sanitized.push({ type: 'change_state', patch: raw.patch });
      return;
    }
    if (raw.type === 'navigate') {
      const route = normalizeRoute(raw.route || raw.href);
      if (isAllowedRoute(route)) {
        sanitized.push({ type: 'navigate', route });
      }
    }
  });
  return sanitized;
}

function applyIntentRepairs(
  userText: string,
  currentRoute: string,
  messages: AssistantMessageBlock[],
  actions: AssistantAction[],
  instituteContext: InstituteContextSnapshot | null,
  viewContext: HostViewContext | null,
  moduleFlags: HostModuleFlagsContext,
  contextFlags: HostFlagsContext,
  formOptions?: FormOptionsContext | null
): { messages: AssistantMessageBlock[]; actions: AssistantAction[]; debug: ViewQaDebug } {
  const repairedMessages = messages.slice();
  const repairedActions = actions.slice();
  const viewQa = inspectViewQa(userText, viewContext);
  const debug: ViewQaDebug = {
    active: !!viewQa,
    source: hasTextLikeMessage(repairedMessages) ? 'llm' : 'n/a',
    rowCount: viewQa ? viewQa.rowCount : 0,
    nameMatched: viewQa ? viewQa.nameMatched : false,
    dateConstrained: viewQa ? viewQa.dateConstrained : false,
    dateMatched: viewQa ? viewQa.dateMatched : false
  };
  const isUnderFees = typeof moduleFlags.underFees === 'boolean'
    ? moduleFlags.underFees
    : (typeof contextFlags.underFees === 'boolean'
      ? contextFlags.underFees
      : currentRoute.indexOf('/fees') === 0);

  if (isCollectFeesIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(
      isUnderFees
        ? 'Opening the payment recording screen in Fees.'
        : 'Fee collection is done in Fees. Opening the add payment screen so you can record a payment there.'
    ));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home')
    ]));
    appendNavigateAction(repairedActions, FEES_COLLECT_ROUTE);
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isMarksCardIntent(userText)) {
    if (!hasTextLikeMessage(repairedMessages)) {
      const mentionsFa1 = userText.toLowerCase().indexOf('fa1') >= 0;
      repairedMessages.unshift(createTextBlock(
        mentionsFa1
          ? 'Marks cards are sent from Connect. Opening the marks-card recipients screen so you can continue with FA1 selection there. (Demo: no email is sent yet.)'
          : 'Marks cards are sent from Connect. Opening the marks-card recipients screen. (Demo: no email is sent yet.)'
      ));
    }
    removeSuggestionBlocks(repairedMessages);
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Open Home', 'take me home'),
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Fees', 'take me to fees')
    ]));
    appendNavigateAction(repairedActions, CONNECT_MARKS_CARD_ROUTE);
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isInstituteInfoIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(buildInstituteSummaryMessage(instituteContext, false)));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Collect fees', 'collect fees'),
      createSendMessageSuggestion('Open Home', 'take me home')
    ]));
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isBuddyWorkspaceIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock('Opening the buddy enrolment workspace. Paste your notes in the buddy box, then Parse.'));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home'),
      createSendMessageSuggestion('Open Fees', 'take me to fees')
    ]));
    repairedActions.length = 0;
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isStudentEnrolIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(studentEnrolOpenMessage(formOptions)));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home'),
      createSendMessageSuggestion('Open Fees', 'take me to fees')
    ]));
    repairedActions.length = 0;
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isOrgAddIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(orgAddOpenMessage(formOptions)));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home'),
      createSendMessageSuggestion('Open Fees', 'take me to fees')
    ]));
    repairedActions.length = 0;
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isInstitutePageNavigationIntent(userText)) {
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock('Opening the institute page.'));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home')
    ]));
    appendNavigateAction(repairedActions, INSTITUTE_MANAGE_ROUTE);
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isFeesTransactionsNavigationIntent(userText)) {
    const alreadyOnPage = normalizeRoute(currentRoute) === FEES_TRANSACTIONS_ROUTE;
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(alreadyOnPage ? 'You are already on Fee Transactions.' : 'Opening Fee Transactions.'));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Collect fees', 'collect fees'),
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Open Home', 'take me home')
    ]));
    if (!alreadyOnPage) {
      appendNavigateAction(repairedActions, FEES_TRANSACTIONS_ROUTE);
    } else {
      repairedActions.length = 0;
    }
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isFeesNavigationIntent(userText)) {
    const alreadyOnFees = normalizeRoute(currentRoute) === FEES_OVERVIEW_ROUTE;
    if (!hasTextLikeMessage(repairedMessages)) {
      repairedMessages.push(createTextBlock(alreadyOnFees ? 'You are already on Fees.' : 'Opening Fees.'));
    }
    removeSuggestionBlocks(repairedMessages);
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Open fee transactions', 'take me to fee transactions'),
      createSendMessageSuggestion('Collect fees', 'collect fees'),
      createSendMessageSuggestion('Institute info', 'institute info')
    ]));
    if (alreadyOnFees) {
      repairedActions.length = 0;
    } else {
      appendNavigateAction(repairedActions, FEES_OVERVIEW_ROUTE);
    }
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isHomeNavigationIntent(userText)) {
    const alreadyOnHome = normalizeRoute(currentRoute) === HOME_ROUTE;
    repairedMessages.length = 0;
    repairedMessages.push(createTextBlock(alreadyOnHome ? 'You are already on Home.' : 'Opening Home.'));
    repairedMessages.push(createSuggestionsBlock([
      createSendMessageSuggestion('Open Fees', 'take me to fees'),
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Send marks cards', 'send marks cards')
    ]));
    if (alreadyOnHome) {
      repairedActions.length = 0;
    } else {
      appendNavigateAction(repairedActions, HOME_ROUTE);
    }
    return { messages: repairedMessages, actions: repairedActions, debug: debug };
  }

  if (isUnknownNavigationIntent(userText)) {
    return {
      messages: buildUnknownNavigationFallbackBlocks(),
      actions: [],
      debug: debug
    };
  }

  // Live mode is model-first for view Q&A. Deterministic view logic is only a
  // fallback when the model did not return any text-like message.
  if (
    hasTextLikeMessage(repairedMessages)
    && viewQa
    && viewQa.nameMatched
    && (!viewQa.dateConstrained || viewQa.dateMatched)
    && hasNotFoundLikeTextMessage(repairedMessages)
  ) {
    const safetyAnswer = answerFeesAmountQuestion(userText, viewContext);
    if (safetyAnswer && !isUnresolvedViewAnswer(safetyAnswer)) {
      debug.source = 'safety_fees';
      return {
        messages: [createTextBlock(safetyAnswer)],
        actions: repairedActions,
        debug: debug
      };
    }
  }

  if (!hasTextLikeMessage(repairedMessages)) {
    const viewSummary = summarizeVisibleView(userText, viewContext);
    if (viewSummary) {
      debug.source = 'fallback_summary';
      return {
        messages: [createTextBlock(viewSummary)],
        actions: repairedActions,
        debug: debug
      };
    }
    const feeAnswer = (isUnderFees || isFeesViewContext(viewContext))
      ? answerFeesAmountQuestion(userText, viewContext)
      : null;
    if (feeAnswer) {
      debug.source = 'fallback_fees';
      return {
        messages: [createTextBlock(feeAnswer)],
        actions: repairedActions,
        debug: debug
      };
    }
  }

  return { messages: repairedMessages, actions: repairedActions, debug: debug };
}

function createTextBlock(text: string): AssistantMessageBlock {
  return {
    type: 'text',
    text: text.trim()
  } as AssistantMessageBlock;
}

function createSuggestionsBlock(items: Array<{ id: string; label: string; action: string; payload: Record<string, unknown> }>): AssistantMessageBlock {
  return {
    type: 'suggestions',
    id: 'sugg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    items: dedupeAndCapSuggestions(items)
  } as AssistantMessageBlock;
}

function normalizeSuggestionBlocks(messages: AssistantMessageBlock[]): AssistantMessageBlock[] {
  const result: AssistantMessageBlock[] = [];
  const items: any[] = [];
  messages.forEach((block: AssistantMessageBlock) => {
    if (block.type === 'suggestions' && Array.isArray((block as any).items)) {
      items.push(...(block as any).items);
      return;
    }
    result.push(block);
  });
  const cleanItems = dedupeAndCapSuggestions(items);
  if (cleanItems.length) {
    result.push(createSuggestionsBlock(cleanItems));
  }
  return result;
}

function removeSuggestionBlocks(messages: AssistantMessageBlock[]): void {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].type === 'suggestions') {
      messages.splice(index, 1);
    }
  }
}

function dedupeAndCapSuggestions(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item: any) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const action = typeof item.action === 'string' ? item.action.trim().toLowerCase() : '';
    if (!label || !action) {
      return false;
    }
    const payload = item.payload && typeof item.payload === 'object' ? JSON.stringify(item.payload) : '';
    const key = label.toLowerCase() + '|' + action + '|' + payload;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function removeRedundantNavigateSuggestions(messages: AssistantMessageBlock[], actions: AssistantAction[]): AssistantMessageBlock[] {
  const navigatedRoutes = new Set(
    actions
      .filter((action: AssistantAction) => action && action.type === 'navigate')
      .map((action: AssistantAction) => normalizeRoute((action as any).route))
      .filter((route: string) => !!route)
  );
  if (!navigatedRoutes.size) {
    return messages;
  }

  return messages.reduce((result: AssistantMessageBlock[], block: AssistantMessageBlock) => {
    if (block.type !== 'suggestions' || !Array.isArray((block as any).items)) {
      result.push(block);
      return result;
    }
    const items = dedupeAndCapSuggestions((block as any).items).filter((item: any) => {
      if (item.action !== 'navigate') {
        return true;
      }
      const href = normalizeRoute(String(item.payload && (item.payload.href || item.payload.route) || ''));
      return !navigatedRoutes.has(href);
    });
    if (items.length) {
      result.push(Object.assign({}, block, { items }));
    }
    return result;
  }, []);
}

function createNavigateAction(route: string): AssistantAction {
  const normalizedRoute = normalizeRoute(route);
  if (!isAllowedRoute(normalizedRoute)) {
    throw new Error('Attempted to create navigate action for an unsafe route: ' + normalizedRoute);
  }
  return {
    type: 'navigate',
    route: normalizedRoute
  };
}

function appendNavigateAction(actions: AssistantAction[], route: string): void {
  const normalizedRoute = normalizeRoute(route);
  if (!isAllowedRoute(normalizedRoute)) {
    return;
  }
  if (actions.some((action: AssistantAction) => action && action.type === 'navigate' && normalizeRoute((action as any).route) === normalizedRoute)) {
    return;
  }
  actions.push(createNavigateAction(normalizedRoute));
}

function createSendMessageSuggestion(label: string, text: string): { id: string; label: string; action: string; payload: Record<string, unknown> } {
  return {
    id: 'msg_' + text.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase(),
    label: label.trim(),
    action: 'send_message',
    payload: { text: text.trim() }
  };
}

function suggestionPromptForRoute(href: string, label: string): string {
  if (href === INSTITUTE_MANAGE_ROUTE) {
    return 'institute info';
  }
  if (href === HOME_ROUTE) {
    return 'take me home';
  }
  if (href === FEES_OVERVIEW_ROUTE) {
    return 'take me to fees';
  }
  if (href === FEES_TRANSACTIONS_ROUTE) {
    return 'take me to fee transactions';
  }
  if (href === FEES_COLLECT_ROUTE) {
    return 'collect fees';
  }
  if (href === CONNECT_MARKS_CARD_ROUTE) {
    return 'send marks cards';
  }
  return label.trim();
}

function defaultSafeFallbackText(): string {
  return 'I can open Fees, Institute details, marks-card recipients in Connect, and Home.';
}

function buildUnknownNavigationFallbackBlocks(): AssistantMessageBlock[] {
  return [
    createTextBlock(
      'I can\'t open that destination. Try asking for Fees, Home, institute info, or marks cards.'
    ),
    createSuggestionsBlock([
      createSendMessageSuggestion('Try Fees', 'take me to fees'),
      createSendMessageSuggestion('Institute info', 'institute info'),
      createSendMessageSuggestion('Go Home', 'take me home')
    ])
  ];
}

function hasTextLikeMessage(messages: AssistantMessageBlock[]): boolean {
  return messages.some((message: AssistantMessageBlock) => {
    if (message.type === 'text') {
      return typeof (message as any).text === 'string' && (message as any).text.trim().length > 0;
    }
    if (message.type === 'markdown') {
      return typeof (message as any).markdown === 'string' && (message as any).markdown.trim().length > 0;
    }
    return false;
  });
}

function hasOnlyLowSignalTextLikeMessages(messages: AssistantMessageBlock[]): boolean {
  const textLikeMessages = messages.filter((message: AssistantMessageBlock) => {
    return message.type === 'text' || message.type === 'markdown';
  });
  if (!textLikeMessages.length) {
    return false;
  }
  return textLikeMessages.every((message: AssistantMessageBlock) => {
    const value = message.type === 'text'
      ? String((message as any).text || '')
      : String((message as any).markdown || '');
    return isLowSignalText(value);
  });
}

function isLowSignalText(value: string): boolean {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return true;
  }
  if (/^\[\d+\]$/.test(text)) {
    return true;
  }
  if (/^(?:n\/a|null|undefined)$/i.test(text)) {
    return true;
  }
  if (/^[\[\]\(\)\{\}\d\W_]+$/.test(text) && !/[a-z]/i.test(text)) {
    return true;
  }
  return false;
}

function hasInternalLinkForRoute(messages: AssistantMessageBlock[], route: string): boolean {
  const normalizedRoute = normalizeRoute(route);
  return messages.some((message: AssistantMessageBlock) => {
    if (message.type !== 'link') {
      return false;
    }
    const linkMessage = message as any;
    const href = normalizeRoute(linkMessage.href);
    const target = linkMessage.target === 'external' ? 'external' : 'internal';
    return target === 'internal' && href === normalizedRoute;
  });
}

function normalizeRoute(route: string): string {
  return typeof route === 'string' ? route.trim() : '';
}

function isAllowedRoute(route: string): boolean {
  if (!route || route.charAt(0) !== '/') {
    return false;
  }
  if (/^https?:\/\//i.test(route)) {
    return false;
  }
  return KNOWN_NAVIGATION_ROUTES.some((knownRoute: string) => {
    return route === knownRoute
      || route.indexOf(knownRoute + '?') === 0
      || route.indexOf(knownRoute + '#') === 0;
  });
}

function isPlainObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractTextFallback(value: string): string {
  const raw = typeof value === 'string' ? value : '';
  const cleaned = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) {
    return defaultSafeFallbackText();
  }
  if (looksLikeProtocolJsonBlob(cleaned)) {
    return defaultSafeFallbackText();
  }
  if (isLowSignalText(cleaned)) {
    return defaultSafeFallbackText();
  }
  return cleaned;
}

function looksLikeProtocolJsonBlob(text: string): boolean {
  if (!text) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const startsLikeJson = (
    (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}')
    || (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')
  );
  if (!startsLikeJson) {
    return false;
  }
  try {
    const parsed: any = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.some((item: any) => item && typeof item === 'object' && (item.messages || item.actions || item.type === 'assistant_response'));
    }
    return !!(parsed && typeof parsed === 'object' && (parsed.messages || parsed.actions || parsed.type === 'assistant_response'));
  } catch (error) {
    return false;
  }
}

async function handleEmitEvent(
  socket: any,
  payload: HostEmitEvent
): Promise<void> {
  const conversationId = sanitizeConversationId(payload.conversationId);
  const correlationId = payload.correlationId || null;

  // BW-T3: buddy workspace parse is always canned (same mapper in both modes);
  // live mode must NOT send buddy_parse to the LLM in this ticket (T4 adds the
  // parse child agent).
  if (isBuddyParseEvent(payload)) {
    await handleBuddyParseEvent(socket, payload, conversationId, correlationId);
    return;
  }

  // H-validate: workspace Check runs the validation child (live) or the same
  // rules without an LLM (canned); the reply echoes the workspace surface with
  // records[].valid applied — never a save, never a new field list.
  if (isBuddyValidateEvent(payload)) {
    await handleBuddyValidateEvent(socket, payload, conversationId, correlationId);
    return;
  }

  // BW-T3.5: workspace chrome events (record selection, field patches) are
  // host-local UI state — canned ack only, never OpenRouter, never a new surface.
  if (isBuddyChromeEvent(payload)) {
    logEmitEvent(payload, conversationId, 'buddy-chrome-canned');
    sendCannedEmitEventAck(socket, payload, conversationId, correlationId);
    return;
  }

  if (config.mode === 'live') {
    const livePath = emitEventLivePath(payload);
    const liveOk = await tryLiveEmitEventAck(socket, payload, conversationId, correlationId, livePath);
    if (liveOk) {
      return;
    }
  }

  logEmitEvent(payload, conversationId, 'canned-ack');
  sendCannedEmitEventAck(socket, payload, conversationId, correlationId);
}

function emitEventLivePath(payload: HostEmitEvent): string {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  return eventName === 'form_submit' ? 'live-form-submit' : 'live-emit-event';
}

function sendCannedEmitEventAck(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null
): void {
  sendAssistantResponse(socket, {
    conversationId,
    correlationId,
    messages: [{ type: 'text', text: ackTextForEmitEvent(payload) }],
    actions: []
  });
}

async function tryLiveEmitEventAck(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null,
  livePath: string
): Promise<boolean> {
  const endpoint = resolveChatCompletionsUrl(config.live.baseUrl);
  if (!config.live.apiKey || !config.live.model) {
    logger.error(
      '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
      conversationId,
      livePath,
      'error',
      'Live mode is not configured; falling back to canned ack.'
    );
    return false;
  }

  const contextPayload = emitEventAsContextPayload(payload);
  const userText = buildEmitEventLiveUserText(payload, conversationId, contextPayload);
  try {
    logger.info(
      '[mock-harness] emit_event conversationId=%s path=%s endpoint=%s model=%s',
      conversationId,
      livePath,
      endpoint || '(empty)',
      config.live.model
    );
    const liveResult = await callOpenAICompatibleChat({
      baseUrl: config.live.baseUrl,
      apiKey: config.live.apiKey,
      model: config.live.model,
      temperature: config.live.temperature,
      userText: userText,
      contextRoute: readCurrentRoute(contextPayload),
      contextPersona: readPersona(contextPayload),
      contextFocus: readContextFocus(contextPayload),
      contextModuleFlags: readModuleFlags(contextPayload),
      contextFlags: readContextFlags(contextPayload),
      contextView: readViewContext(contextPayload),
      systemPrompt: liveSystemPrompt,
      logger
    });
    const parsed = parseStructuredLiveOutput(liveResult.text);
    const parsedMessages = sanitizeMessages(parsed ? parsed.messages : []);
    if (!parsed || !hasTextLikeMessage(parsedMessages)) {
      logger.error(
        '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
        conversationId,
        livePath,
        'error',
        'Live emit_event response was empty or unparseable; falling back to canned ack.'
      );
      return false;
    }
    const mapped = mapLiveOutputToAssistant(
      userText,
      readCurrentRoute(contextPayload),
      liveResult.text,
      readInstituteContext(contextPayload),
      readViewContext(contextPayload),
      readModuleFlags(contextPayload),
      readContextFlags(contextPayload)
    );

    const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
    const actions = eventName === 'form_submit' ? [] : mapped.actions;
    logEmitEvent(payload, conversationId, livePath);
    logger.info(
      '[mock-harness] emit_event conversationId=%s path=%s endpoint=%s model=%s status=%s latencyMs=%s mapping=%s',
      conversationId,
      livePath,
      liveResult.endpoint,
      liveResult.model,
      liveResult.statusCode,
      liveResult.latencyMs,
      'success'
    );
    sendAssistantResponse(socket, {
      conversationId,
      correlationId,
      messages: filterSuggestionsForTurn(mapped.messages),
      actions: actions
    });
    return true;
  } catch (error) {
    const liveError = error as LiveChatError;
    const hasDetails = liveError && liveError.details;
    const safeMessage = hasDetails
      ? liveError.details.safeMessage
      : (error && (error as Error).message ? (error as Error).message : 'Unknown live provider failure.');
    logger.error(
      '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
      conversationId,
      livePath,
      'error',
      safeMessage
    );
    if (hasDetails) {
      logger.debug(
        '[mock-harness] emit_event error-details conversationId=%s details=%s',
        conversationId,
        safeStringifyDebug(liveError.details)
      );
    }
    return false;
  }
}

function emitEventAsContextPayload(payload: HostEmitEvent): HostUserMessage {
  return {
    type: 'user_message',
    conversationId: payload.conversationId,
    text: '',
    context: payload.context
  };
}

function buildEmitEventLiveUserText(
  payload: HostEmitEvent,
  conversationId: string,
  contextPayload: HostUserMessage
): string {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  let valuesText = '{}';
  try {
    valuesText = JSON.stringify(payload.values && typeof payload.values === 'object' ? payload.values : {});
  } catch (error) {
    valuesText = '[unserializable]';
  }
  const moduleFlags = readModuleFlags(contextPayload);
  const viewContext = readViewContext(contextPayload);
  const focus = readContextFocus(contextPayload);
  return [
    'Host emit_event (not a chat utterance). Acknowledge receipt only.',
    'Do not claim a student was enrolled or an organization was created. This mock has no confirming backend write.',
    'event=' + (eventName || '(none)'),
    'action=' + (action || '(none)'),
    'correlationId=' + (payload.correlationId || '(none)'),
    'conversationId=' + conversationId,
    'values=' + valuesText,
    'host.route=' + (readCurrentRoute(contextPayload) || '(unknown)'),
    'host.persona=' + (readPersona(contextPayload) || '(unknown)'),
    'host.moduleFlags=' + safeStringifyDebug(moduleFlags),
    'host.focus=' + safeStringifyDebug(focus),
    'host.viewModule=' + (viewContext && viewContext.module ? String(viewContext.module) : '(none)'),
    'host.viewScreen=' + (viewContext && viewContext.screen ? String(viewContext.screen) : '(none)'),
    'Return protocol JSON only. Prefer brief text and optional send_message suggestions (max 3) using only allowlisted capability phrases. Omit surface. Do not navigate.'
  ].join('\n');
}

function logEmitEvent(payload: HostEmitEvent, conversationId: string, path: string): void {
  const context: HostContextBag = payload.context || { route: '' };
  const route = typeof context.route === 'string' ? context.route : '(unknown)';
  const persona = typeof context.persona === 'string' ? context.persona : '(unknown)';
  const focusType = context.focus && typeof (context.focus as any).type === 'string'
    ? String((context.focus as any).type)
    : '(none)';
  const moduleFlags = context.moduleFlags && typeof context.moduleFlags === 'object'
    ? context.moduleFlags as HostModuleFlagsContext
    : {};
  const fallbackFlags = context.flags && typeof context.flags === 'object'
    ? context.flags as HostFlagsContext
    : {};
  const underFeesValue = typeof moduleFlags.underFees === 'boolean'
    ? moduleFlags.underFees
    : fallbackFlags.underFees;
  const underFees = typeof underFeesValue === 'boolean'
    ? String(underFeesValue)
    : '(unknown)';
  const underConnect = typeof moduleFlags.underConnect === 'boolean'
    ? String(moduleFlags.underConnect)
    : '(unknown)';
  const underStudent = typeof moduleFlags.underStudent === 'boolean'
    ? String(moduleFlags.underStudent)
    : '(unknown)';
  const viewModule = context.view && typeof (context.view as any).module === 'string'
    ? String((context.view as any).module)
    : '(none)';
  const viewScreen = context.view && typeof (context.view as any).screen === 'string'
    ? String((context.view as any).screen)
    : '(none)';
  const viewRows = context.view && Array.isArray((context.view as any).rows)
    ? String((context.view as any).rows.length)
    : '0';
  logger.info(
    '[mock-harness] emit_event conversationId=%s path=%s route=%s persona=%s focus=%s underFees=%s underConnect=%s underStudent=%s viewModule=%s viewScreen=%s viewRows=%s',
    conversationId,
    path,
    route,
    persona,
    focusType,
    underFees,
    underConnect,
    underStudent,
    viewModule,
    viewScreen,
    viewRows
  );
}

function ackTextForEmitEvent(payload: HostEmitEvent): string {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  if (eventName === 'form_submit' && action.indexOf('student.enrol') === 0) {
    return 'Received the student enrollment form. (Demo: no student was enrolled.)';
  }
  if (eventName === 'form_submit' && action.indexOf('org.add') === 0) {
    return 'Received the add organization form. (Demo: no organization was created.)';
  }
  if (eventName === 'form_continue') {
    return 'Opened the full form with your entered values.';
  }
  if (eventName === 'record_selected' || action === 'student.enrol.select') {
    return 'Record selected in the buddy workspace.';
  }
  if (eventName === 'field_patched' || action === 'student.enrol.patch') {
    return 'Field updated in the buddy workspace.';
  }
  return 'Event received by mock harness.';
}

// ============================================================================
// BW-T3: buddy enrolment workspace (canned).
// - Chat intents open the workspace surface (isBuddyWorkspaceIntent above).
// - emit_event buddy_parse / student.enrol.parse runs this SMALL CANNED MAPPER
//   (both canned and live mode; live never sends parse to the LLM in this
//   ticket). This is demo-data classification only — NOT the production
//   parser (no alias tables, no shape machine, no token matching) and NOT a
//   port of the buddy HTML sketches. T4 replaces it with the parse child
//   agent; scripts do mechanical work here, agents decide in T4+.
// ============================================================================

interface CannedBuddyRejection {
  fieldId?: string;
  text?: string;
  reason?: string;
}

interface CannedBuddyTextSpan {
  start: number;
  end: number; // end exclusive
}

interface CannedBuddyRecord {
  id: string;
  values: Record<string, string>;
  labels: Record<string, string>;
  rejected: CannedBuddyRejection[];
  leftovers: string[];
  valid: boolean;
  // BW-T3.5: where this record and its mapped tokens live in the echoed
  // buddy.text. The host splices these spans on form edits; it never re-splits text.
  source: {
    record: CannedBuddyTextSpan;
    fields: Record<string, CannedBuddyTextSpan>;
  };
}

interface CannedBuddyParse {
  records: CannedBuddyRecord[];
  parse: {
    mapped: Array<{ fieldId: string; value: string }>;
    rejected: CannedBuddyRejection[];
    leftovers: string[];
    format: string;
  };
}

// BW-T5: course options come from the HOST's context.formOptions.courses
// (same source as student add: course store / CTApi), deduped and capped by
// mapSelectOptions. There is NO canned demo fallback: an empty live list
// leaves selects empty and unresolved mentions rejected, never guessed.
// The mock harness never calls CampusTrack APIs itself.

function isBuddyParseEvent(payload: HostEmitEvent): boolean {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  return eventName === 'buddy_parse' || action === 'student.enrol.parse';
}

// Parse replies (child, canned, and empty-text) carry the same byline so
// "Parsed N students." is never labeled CT-Bot Assistant.
const PARSE_AGENT_BYLINE: HostResponseAgent = { id: 'ct-bot-parse', displayName: 'Parse agent' };

// BW-T3.5: workspace chrome events that never need a model.
function isBuddyChromeEvent(payload: HostEmitEvent): boolean {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  return eventName === 'record_selected' || action === 'student.enrol.select'
    || eventName === 'field_patched' || action === 'student.enrol.patch';
}

function readBuddyParseText(payload: HostEmitEvent): string {
  const values = payload.values && typeof payload.values === 'object' ? payload.values as Record<string, unknown> : {};
  return typeof values.text === 'string' ? values.text : '';
}

// ============================================================================
// H1: canned sanitizer (harness demo-data layout fix-up). Runs FIRST on
// buddy_parse / student.enrol.parse (canned path), then the existing canned
// mapper classifies the sanitized notes as today.
// - Output is notes text only: one student per line in schema order
//   (name, dob, gender, course). Empty slots stay empty (", ,").
// - Nothing is invented: missing slots stay empty (Grace's gender stays
//   empty), impossible dates stay verbatim (31/02/2014), and only REAL
//   ISO/US dates are rewritten (2014-03-12 → 12/03/2014; 2014-02-31 is not
//   coerced). Unclaimed tokens are kept on the line so the parse classifies
//   them as today (leftover/rejected). No course resolution happens here —
//   the parse still resolves courses against the host's live list.
// - Demo classification only: NOT the production parser, NOT OCR, and NOT a
//   second LLM hop. The sanitize dump never leaves the notes text (it is not
//   a Results-pane entry; the chat line stays one short sentence).
// ============================================================================

interface CannedBuddySanitizeResult {
  text: string;
  changed: boolean;
  students: number;
}

function sanitizeCannedDateToken(token: string): string {
  const text = String(token || '').trim();
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const tryOrder = (first: number, second: number, year: number): string => {
    const date = new Date(year, second - 1, first);
    if (date.getFullYear() !== year || date.getMonth() !== second - 1 || date.getDate() !== first) {
      return '';
    }
    const pad = (value: number) => (value < 10 ? '0' : '') + String(value);
    return pad(first) + '/' + pad(second) + '/' + String(year);
  };
  if (iso) {
    return tryOrder(Number(iso[3]), Number(iso[2]), Number(iso[1])) || text;
  }
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    return tryOrder(day, month, year) || tryOrder(month, day, year) || text;
  }
  return text;
}

function sanitizeCannedFieldValue(fieldId: string, value: string): string {
  if (fieldId === 'dob') {
    return sanitizeCannedDateToken(value);
  }
  if (fieldId === 'gender') {
    return parseCannedGender(value) || value;
  }
  return value;
}

function cannedSanitizeSlotIndex(fieldId: string): number {
  if (fieldId === 'dob') {
    return 1;
  }
  if (fieldId === 'gender') {
    return 2;
  }
  if (fieldId === 'courseId') {
    return 3;
  }
  return 0;
}

function removeCannedSpan(text: string, start: number, end: number): string {
  return (text.slice(0, start) + text.slice(end)).replace(/\s{2,}/g, ' ').trim();
}

function stripCannedEdgePunct(token: string): string {
  return String(token || '').replace(/^[^\w&/+.]+|[^\w&/+.]+$/g, '').trim();
}

/* Scans one segment for shape tokens (dob / course / gender) and assigns the
 * first of each to the record slots. Returns the residue for name/noise
 * classification by the caller. Prose gender scan never matches single
 * letters — those are only trusted as standalone segments. */
function scanCannedShapeTokens(segment: string, slots: string[]): { claimed: boolean; residue: string } {
  let rest = String(segment || '');
  let claimed = false;

  const dobMatch = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/.exec(rest);
  if (dobMatch) {
    if (!slots[1]) {
      slots[1] = sanitizeCannedDateToken(dobMatch[0]);
    }
    claimed = true;
    rest = removeCannedSpan(rest, dobMatch.index, dobMatch.index + dobMatch[0].length);
  }

  const courseMatch = /\b(class|course|standard|grade)\b[\s:.\-]*(\S+)(?:\s+(\d{1,2}[A-Za-z]?|[A-Za-z]{1,3}\b))?/i.exec(rest);
  if (courseMatch) {
    if (!slots[3]) {
      const tail = courseMatch[3] ? ' ' + stripCannedEdgePunct(courseMatch[3]) : '';
      slots[3] = (courseMatch[1] + ' ' + stripCannedEdgePunct(courseMatch[2]) + tail).replace(/\s+/g, ' ').trim();
    }
    claimed = true;
    rest = removeCannedSpan(rest, courseMatch.index, courseMatch.index + courseMatch[0].length);
  }

  const genderMatch = /\b(female|girl|male|boy)\b/i.exec(rest);
  if (genderMatch) {
    if (!slots[2]) {
      slots[2] = parseCannedGender(genderMatch[0]);
    }
    claimed = true;
    rest = removeCannedSpan(rest, genderMatch.index, genderMatch.index + genderMatch[0].length);
  }

  // Course labels like "Grade 9 - Secondary" continue after a dash; keep the
  // tail on the course slot so it never leaks into the name.
  const dashTailMatch = /(^|\s)[-–—]\s*([A-Za-z][\w' ]*)$/.exec(rest);
  if (dashTailMatch) {
    const tailText = dashTailMatch[2].trim();
    if (!slots[3]) {
      slots[3] = tailText;
    } else {
      slots[3] = (slots[3] + ' - ' + tailText).replace(/\s+/g, ' ').trim();
    }
    rest = rest.slice(0, dashTailMatch.index).trim();
  }

  return { claimed: claimed, residue: rest };
}

/* Maps one student chunk to a schema-order line: name, dob, gender, course.
 * Filler words are dropped; every other token keeps its text (dates are
 * normalized only when they are real). If no shape token was found at all,
 * the chunk is returned unchanged so today's leftover behaviour is intact. */
function sanitizeCannedChunk(rawChunk: string): string {
  const work = String(rawChunk || '').replace(/\t/g, ', ').trim();
  if (!work) {
    return '';
  }
  const segments = work.split(/[,;|]/).map((segment) => segment.trim()).filter((segment) => !!segment);
  if (!segments.length) {
    return work;
  }
  const slots: string[] = ['', '', '', ''];
  const extras: string[] = [];

  segments.forEach((segment, index) => {
    const labeled = matchLabeledSegment(segment);
    if (labeled) {
      const keyLength = matchLabeledKeyLength(segment);
      const value = keyLength >= 0 ? segment.slice(keyLength).trim() : segment.trim();
      const slotIndex = cannedSanitizeSlotIndex(labeled.fieldId);
      if (!slots[slotIndex]) {
        slots[slotIndex] = sanitizeCannedFieldValue(labeled.fieldId, value);
      }
      return;
    }
    const genderWord = parseCannedGender(segment);
    if (genderWord) {
      if (!slots[2]) {
        slots[2] = genderWord;
      }
      return;
    }
    if (isCannedDateShaped(segment)) {
      if (!slots[1]) {
        slots[1] = sanitizeCannedDateToken(segment);
      }
      return;
    }
    const scan = scanCannedShapeTokens(segment, slots);
    let residue = scan.residue
      .replace(/\b(please|enrol|enrols|enroll|enrolls|enrolled|enrolling|admit|admits|admitted|admission|add|adds|born|dob|date|birth|of|on|in|at|the|to|for|and|with|student|students|is|are|a|an|her|his|from|join|joining|new|into|year|name|gender|class|course|standard|grade|section|needs|wants|record|records|these|this)\b/gi, ' ')
      .replace(/[()\[\]{}.,;:"“”]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!residue) {
      return;
    }
    if (!slots[0] && looksLikeCannedName(residue)) {
      slots[0] = residue;
      return;
    }
    const words = residue.split(/\s+/).length;
    if (index === segments.length - 1 && !slots[3] && /[A-Za-z]/.test(residue) && words <= 4) {
      slots[3] = residue;
      return;
    }
    extras.push(residue);
  });

  if (!slots[1] && !slots[2] && !slots[3]) {
    return work;
  }
  const line = slots.concat(extras).join(', ')
    .replace(/^(?:\s*,\s*)+/, '')
    .replace(/(?:\s*,\s*)+$/, '');
  return line || work;
}

/* Splits one line into student chunks when the line clearly lists several
 * students (at least two date tokens, chunk boundaries at "and"/comma before
 * a two-capitalized-word name, and each following chunk owning a date token). */
function splitCannedStudentChunks(line: string): string[] {
  const work = String(line || '').replace(/\t/g, ', ').trim();
  if (!work) {
    return [];
  }
  const dateCount = (work.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/g) || []).length;
  if (dateCount < 2) {
    return [work];
  }
  const boundaryRe = /(?:\s+and\s+|,\s*)(?=[A-Z][a-zA-Z'.’-]*\s+[A-Z][a-zA-Z'.’-]*)/g;
  const cuts: Array<{ start: number; next: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = boundaryRe.exec(work)) !== null) {
    cuts.push({ start: match.index, next: match.index + match[0].length });
  }
  if (!cuts.length) {
    return [work];
  }
  const chunks: string[] = [];
  let begin = 0;
  for (let i = 0; i < cuts.length; i++) {
    const end = i + 1 < cuts.length ? cuts[i + 1].start : work.length;
    const tail = work.slice(cuts[i].next, end);
    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}/.test(tail)) {
      chunks.push(work.slice(begin, cuts[i].start).trim());
      begin = cuts[i].next;
    }
  }
  chunks.push(work.slice(begin).trim());
  return chunks.filter((chunk) => !!chunk);
}

function sanitizeCannedStudentLine(line: string): string {
  const stripped = line.replace(/^[-*•·]+\s*/, '').replace(/^\d+[.)]\s+/, '').trim();
  const chunks = splitCannedStudentChunks(stripped);
  const lines = chunks.map((chunk) => sanitizeCannedChunk(chunk)).filter((chunk) => !!chunk);
  if (!lines.length) {
    return stripped;
  }
  return lines.join('\n');
}

function cannedBuddySanitize(rawText: string): CannedBuddySanitizeResult {
  const original = String(rawText || '');
  const outLines: string[] = [];
  let labeledSlots: string[] | null = null;

  const flushLabeled = (): void => {
    if (labeledSlots) {
      outLines.push(
        labeledSlots.join(', ')
          .replace(/^(?:\s*,\s*)+/, '')
          .replace(/(?:\s*,\s*)+$/, '')
      );
      labeledSlots = null;
    }
  };

  original.split('\n').forEach((rawLine) => {
    const trimmed = rawLine.trim();
    // Blank lines, cue/header lines, and rule lines pass through untouched —
    // the canned mapper skips them exactly as today, and byte-identical notes
    // keep good CSV pastes an identity (trim-only) sanitization.
    if (!trimmed) {
      flushLabeled();
      outLines.push('');
      return;
    }
    if (trimmed.indexOf('|') !== -1 && /\bdob\b/i.test(trimmed)) {
      flushLabeled();
      outLines.push(trimmed);
      return;
    }
    if (/^(---+|\*\*\*+)$/.test(trimmed)) {
      flushLabeled();
      outLines.push(trimmed);
      return;
    }
    const labeled = matchLabeledSegment(trimmed);
    if (labeled) {
      if (!labeledSlots) {
        labeledSlots = ['', '', '', ''];
      }
      if (labeled.fieldId === 'name' && labeledSlots[0]) {
        flushLabeled();
        labeledSlots = ['', '', '', ''];
      }
      const keyLength = matchLabeledKeyLength(trimmed);
      const value = keyLength >= 0 ? trimmed.slice(keyLength).trim() : trimmed.trim();
      const slotIndex = cannedSanitizeSlotIndex(labeled.fieldId);
      if (!labeledSlots[slotIndex]) {
        labeledSlots[slotIndex] = sanitizeCannedFieldValue(labeled.fieldId, value);
      }
      return;
    }
    flushLabeled();
    outLines.push(sanitizeCannedStudentLine(trimmed));
  });
  flushLabeled();

  const text = outLines.join('\n');
  return {
    text: text,
    changed: text !== original.trim(),
    students: text.split('\n').filter((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        return false;
      }
      if (trimmedLine.indexOf('|') !== -1 && /\bdob\b/i.test(trimmedLine)) {
        return false;
      }
      return !/^(---+|\*\*\*+)$/.test(trimmedLine);
    }).length
  };
}

async function handleBuddyParseEvent(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null
): Promise<void> {
  const buddyText = readBuddyParseText(payload);
  // H-validate echo: remember the notes so a later Check echo carries the
  // same buddy.text (never wipes the textarea).
  if (buddyText.trim()) {
    rememberBuddyNotes(conversationId, buddyText);
  }
  const courseOptions = courseOptionsFromUserMessage(emitEventAsContextPayload(payload));

  // BW-T4: live mode answers via the parse child (PARSE_AGENT.md). Empty text
  // fails closed without calling the child; any child failure falls back to
  // the canned mapper, so chips always appear.
  // H2: live mode sanitizes FIRST (sanitize child, SANITIZE_AGENT.md) and the
  // existing parse child then parses the sanitized schema lines. A sanitizer
  // failure falls back to parsing the raw notes (today's path); canned mode
  // keeps the H1 cannedBuddySanitize path below untouched.
  // H4: ONE field list — the workspace surface fields drive the surface, the
  // sanitize hop, and the parse hop; no second schema.
  // H5: on LIVE hops the fields come from the main agent's open-workspace
  // surface (remembered per conversation) — buddyWorkspaceFields() is the
  // canned stand-in only and is never rebuilt on live paths. If the live
  // open turn carried no usable fields, fail closed: empty records and an
  // honest text line.
  if (config.mode === 'live' && config.live.apiKey && config.live.model && buddyText.trim()) {
    const fields = rememberedBuddyFields(conversationId);
    if (!fields.length) {
      logEmitEvent(payload, conversationId, 'buddy-parse-canned');
      sendAssistantResponse(socket, {
        conversationId,
        correlationId,
        messages: [{ type: 'text', text: 'I do not have a field list for this workspace yet — open the buddy enrolment workspace first, then paste your notes.' }],
        actions: [],
        surface: buildBuddyWorkspaceSurface(buddyText, [], undefined, courseOptions, []),
        agent: PARSE_AGENT_BYLINE
      });
      return;
    }
    let parseText = buddyText;
    let sanitizeChatPrefix = '';
    const sanitized = await tryBuddySanitizeChild(payload, conversationId, buddyText, fields);
    if (sanitized !== null && sanitized.trim()) {
      parseText = sanitized;
      if (sanitized.trim() !== buddyText.trim()) {
        const normalizedLines = countBuddySchemaLines(sanitized);
        sanitizeChatPrefix = 'Normalized ' + normalizedLines + ' line' + (normalizedLines === 1 ? '' : 's') + '. ';
      }
    }
    const childOk = await tryBuddyParseChild(socket, payload, conversationId, correlationId, parseText, courseOptions, sanitizeChatPrefix, fields);
    if (childOk) {
      return;
    }
  }

  logEmitEvent(payload, conversationId, 'buddy-parse-canned');

  if (!buddyText.trim()) {
    sendAssistantResponse(socket, {
      conversationId,
      correlationId,
      messages: [{ type: 'text', text: 'Nothing to parse yet — paste your notes in the buddy box first.' }],
      actions: [],
      surface: buildBuddyWorkspaceSurface(buddyText, [], undefined, courseOptions),
      agent: PARSE_AGENT_BYLINE
    });
    return;
  }

  // H1: sanitizer runs FIRST, then the existing canned mapper classifies the
  // sanitized notes as today. The surface echoes the sanitized notes so the
  // record/field spans stay consistent with buddy.text.
  const sanitized = cannedBuddySanitize(buddyText);
  const parsed = cannedBuddyParse(sanitized.text, courseOptions);
  const count = parsed.records.length;
  let text = count === 1 ? 'Parsed 1 student.' : 'Parsed ' + count + ' students.';
  if (sanitized.changed) {
    text = 'Normalized ' + sanitized.students + ' line' + (sanitized.students === 1 ? '' : 's') + '. ' + text;
  }
  sendAssistantResponse(socket, {
    conversationId,
    correlationId,
    messages: [{ type: 'text', text }],
    actions: [],
    surface: buildBuddyWorkspaceSurface(sanitized.text, parsed.records, parsed.parse, courseOptions),
    agent: PARSE_AGENT_BYLINE
  });
}

// ============================================================================
// H2: sanitize child agent (SANITIZE_AGENT.md). Runs FIRST in live mode on
// buddy_parse: it normalizes the raw notes to schema lines (one student per
// line; name, dob, gender, course; empty slots stay empty) so the existing
// parse child parses clean lines into the same workspace JSON as today.
// The sanitizer sees the raw notes plus the schema and returns plain text;
// it never resolves courses (the parse child keeps that against the host's
// live list) and never invents values. Any sanitizer failure falls back to
// parsing the raw notes (today's path). Canned mode keeps the H1
// cannedBuddySanitize path untouched.
// ============================================================================

function readSanitizeAgentPrompt(): string {
  try {
    const prompt = fs.readFileSync(path.join(__dirname, 'SANITIZE_AGENT.md'), 'utf8');
    return prompt && prompt.trim() ? prompt : '';
  } catch (error) {
    logger.error('[mock-harness] emit_event path=buddy-sanitize-child-fallback message=SANITIZE_AGENT.md unreadable');
    return '';
  }
}

function buildBuddySanitizeChildUserText(buddyText: string, fields: BuddySurfaceField[]): string {
  return [
    'Sanitize the enrolment notes below into clean schema lines.',
    'Slot order = the workspace fields below (one slot per field, in that order).',
    'One person per line; slots separated by ", "; empty slots stay empty (", ,").',
    'Never invent or guess a value; impossible dates stay verbatim (31/02/2014 stays 31/02/2014); normalize only REAL dates for date-typed fields.',
    'fields (id, label, type) in slot order: ' + JSON.stringify(fields.map((field) => ({ id: field.id, label: field.label, type: field.type }))),
    'Respond with the sanitized notes text ONLY (plain text, no JSON, no fences, no commentary).',
    '<<<BUDDY_TEXT>>>',
    buddyText,
    '<<<BUDDY_TEXT>>>'
  ].join('\n');
}

/* Fail-closed: the sanitized notes must be plain schema lines (no JSON, no
 * fences), one student per line with at most one slot per workspace field.
 * Anything else invalidates the hop and the host falls back to the raw notes. */
function validateBuddySanitizedText(modelText: string, maxSlots: number): string | null {
  const text = String(modelText || '')
    .split('\n')
    .filter((line) => !/^\s*```/.test(line))
    .join('\n')
    .trim();
  if (!text || text.charAt(0) === '{') {
    return null;
  }
  const lines = text.split('\n');
  if (lines.length > 100) {
    return null;
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }
    if (line.length > 200 || line.split(',').length > maxSlots) {
      return null;
    }
  }
  return text;
}

async function tryBuddySanitizeChild(
  payload: HostEmitEvent,
  conversationId: string,
  buddyText: string,
  fields: BuddySurfaceField[]
): Promise<string | null> {
  const systemPrompt = readSanitizeAgentPrompt();
  if (!systemPrompt) {
    return null;
  }
  try {
    const liveResult = await callOpenAICompatibleChat({
      baseUrl: config.live.baseUrl,
      apiKey: config.live.apiKey,
      model: config.live.model,
      systemPrompt: systemPrompt,
      userText: buildBuddySanitizeChildUserText(buddyText, fields),
      temperature: config.live.temperature,
      // H2: the sanitizer replies in plain schema lines, not JSON.
      structuredOutput: false,
      logger: logger
    });
    const sanitized = validateBuddySanitizedText(liveResult.text, fields.length);
    if (!sanitized) {
      logger.error(
        '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
        conversationId,
        'buddy-sanitize-child-fallback',
        'error',
        'Sanitizer output was empty, non-plain-text, or not schema lines.'
      );
      return null;
    }
    logEmitEvent(payload, conversationId, 'buddy-sanitize-child');
    logger.info(
      '[mock-harness] emit_event conversationId=%s path=%s endpoint=%s model=%s status=%s latencyMs=%s lines=%s',
      conversationId,
      'buddy-sanitize-child',
      liveResult.endpoint,
      liveResult.model,
      liveResult.statusCode,
      liveResult.latencyMs,
      sanitized.split('\n').filter((line) => line.trim()).length
    );
    return sanitized;
  } catch (error) {
    const liveError = error as LiveChatError;
    const safeMessage = liveError && liveError.details
      ? liveError.details.safeMessage
      : (error && (error as Error).message ? (error as Error).message : 'Unknown sanitize child failure.');
    logger.error(
      '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
      conversationId,
      'buddy-sanitize-child-fallback',
      'error',
      safeMessage
    );
    return null;
  }
}

/* Counts the student lines in sanitized notes (schema lines only; cue/header
 * and rule lines are excluded, matching the canned H1 counting). */
function countBuddySchemaLines(text: string): number {
  return String(text || '').split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }
    if (trimmed.indexOf('|') !== -1 && /\bdob\b/i.test(trimmed)) {
      return false;
    }
    return !/^(---+|\*\*\*+)$/.test(trimmed);
  }).length;
}

// ============================================================================
// H-validate: validation child agent (VALIDATE_AGENT.md). Host does NOT
// decide valid/invalid from a TypeScript required list — the Check hop does,
// and the panel buttons follow that result. Payload carries the CURRENT
// fields[] + records[] from the open surface (never buddy text); the reply
// echoes the workspace surface (same surface id) with records[].valid applied
// and per-record reasons kept for the chip ⚠. Live runs the validation
// child; any child failure falls back to the same rules without an LLM
// (fail closed per record: missing id / bad JSON → valid: false).
// ============================================================================

const VALIDATE_AGENT_BYLINE: HostResponseAgent = { id: 'ct-bot-validate', displayName: 'Validate agent' };

interface BuddyValidateInput {
  fields: BuddySurfaceField[];
  records: any[];
  surfaceId: string;
  activeRecordId: string;
  buddyText: string;
  parse?: Record<string, unknown>;
}

interface BuddyValidateResult {
  id: string;
  valid: boolean;
  reasons: string[];
}

function isBuddyValidateEvent(payload: HostEmitEvent): boolean {
  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const action = typeof payload.action === 'string' ? payload.action.trim() : '';
  return eventName === 'buddy_validate' || action === 'student.enrol.validate';
}

function readBuddyValidatePayload(payload: HostEmitEvent, conversationId: string): BuddyValidateInput | null {
  const values = payload.values && typeof payload.values === 'object' ? payload.values as Record<string, unknown> : {};
  const fields = sanitizeBuddyFieldsList(values.fields);
  if (!fields.length) {
    return null;
  }
  const rawRecords = Array.isArray(values.records) ? values.records : [];
  const records = rawRecords
    .filter((item: any) => item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim())
    .slice(0, 100)
    .map((item: any) => item);
  if (!records.length) {
    return null;
  }
  return {
    fields: fields,
    records: records,
    surfaceId: typeof values.surfaceId === 'string' ? values.surfaceId.trim() : '',
    activeRecordId: typeof values.activeRecordId === 'string' ? values.activeRecordId.trim() : '',
    // Echo the request's buddy text; when the request omitted it, fall back to
    // the last remembered notes so the echo never wipes the textarea.
    buddyText: typeof values.buddyText === 'string' && values.buddyText.trim()
      ? values.buddyText
      : rememberedBuddyNotes(conversationId),
    parse: values.parse && typeof values.parse === 'object' ? values.parse as Record<string, unknown> : undefined
  };
}

/* The same validation rules the child agent follows, without an LLM. Used in
 * canned mode and as the fail-closed fallback when the live child fails. */
function cannedBuddyValidateRecords(input: BuddyValidateInput): BuddyValidateResult[] {
  const results: BuddyValidateResult[] = [];
  input.records.forEach((record: any) => {
    const values = record.values && typeof record.values === 'object' ? record.values : {};
    const rejected = Array.isArray(record.rejected) ? record.rejected : [];
    const reasons: string[] = [];
    input.fields.forEach((field) => {
      const value = String(values[field.id] || '').trim();
      const staleRejection = rejected.filter((item: any) =>
        item && String(item.fieldId || '').trim().toLowerCase() === field.id.toLowerCase()
        && String(item.text || '').trim());
      // A select resolves when the CURRENT value matches an option by value
      // or label; a date resolves when it is a real calendar date.
      const dateInvalid = field.type === 'date' && !!value && !parseCannedDate(value);
      const selectUnresolved = field.type === 'select' && !!value
        && Array.isArray(field.options) && field.options.length > 0
        && !field.options.some((option) =>
          option.value.toLowerCase() === value.toLowerCase() || option.label.toLowerCase() === value.toLowerCase());
      if (dateInvalid) {
        reasons.push(field.label + ' is not a valid date.');
      } else if (selectUnresolved) {
        reasons.push(field.label + ' is not an allowed option.');
      } else if (!value) {
        if (field.required) {
          reasons.push(field.label + ' is required.');
        }
        if (staleRejection.length) {
          staleRejection.forEach((item: any) => {
            reasons.push(field.label + ' rejected: "' + String(item.text).trim() + '".');
          });
        }
      } else if (staleRejection.length) {
        // Non-empty and not date-invalid/select-unresolved: stale parse-time
        // rejections count only while the value stays unverifiable (e.g. a
        // select whose option list is empty) — a good edit clears the flag.
        const valueResolves = field.type !== 'select'
          || (!!value && Array.isArray(field.options) && field.options.length > 0 && !selectUnresolved);
        if (!valueResolves) {
          staleRejection.forEach((item: any) => {
            reasons.push(field.label + ' rejected: "' + String(item.text).trim() + '".');
          });
        }
      }
    });
    results.push({ id: String(record.id), valid: reasons.length === 0, reasons: reasons });
  });
  return results;
}

function readValidateAgentPrompt(): string {
  try {
    const prompt = fs.readFileSync(path.join(__dirname, 'VALIDATE_AGENT.md'), 'utf8');
    return prompt && prompt.trim() ? prompt : '';
  } catch (error) {
    logger.error('[mock-harness] emit_event path=buddy-validate-child-fallback message=VALIDATE_AGENT.md unreadable');
    return '';
  }
}

function buildBuddyValidateChildUserText(input: BuddyValidateInput): string {
  return [
    'Validate the buddy workspace records below against this field list.',
    'fields (id, label, type, required, options): ' + JSON.stringify(input.fields),
    'records (id, values, labels, rejected): ' + JSON.stringify(input.records.map((record: any) => ({
      id: record.id,
      values: record.values || {},
      labels: record.labels || {},
      rejected: record.rejected || []
    }))),
    'Respond with JSON only: { records: [{ id, valid, reasons[] }] } — one entry per input record; a record is valid only with no reasons; never invent ids.'
  ].join('\n');
}

function parseBuddyValidateChildOutput(modelText: string, input: BuddyValidateInput): BuddyValidateResult[] | null {
  const parsed = parseJsonFromModelText(modelText);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).records)) {
    return null;
  }
  const raw = (parsed as any).records;
  if (raw.length > 100) {
    return null;
  }
  const byId: Record<string, BuddyValidateResult> = {};
  raw.forEach((item: any) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim()) {
      return;
    }
    const reasons = Array.isArray(item.reasons)
      ? item.reasons.filter((reason: any) => typeof reason === 'string' && reason.trim()).slice(0, 10)
      : [];
    byId[item.id.trim()] = { id: item.id.trim(), valid: reasons.length === 0 && item.valid === true, reasons: reasons };
  });
  // Fail closed per record: a missing entry (or a bad one) is invalid.
  return input.records.map((record: any) => {
    const id = String(record.id);
    return byId[id] || { id: id, valid: false, reasons: ['Validation result missing for this record.'] };
  });
}

/* Applies the validation flags onto the echoed records (fail closed per
 * record), rebuilds the workspace surface with the SAME surface id, and
 * replies with one short text line. Live and canned callers share this. */
function replyBuddyValidate(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null,
  input: BuddyValidateInput,
  results: BuddyValidateResult[]
): void {
  const byId: Record<string, BuddyValidateResult> = {};
  results.forEach((result) => {
    byId[result.id] = result;
  });
  const appliedRecords = input.records.map((record: any) => {
    const result = byId[String(record.id)];
    const valid = !!result && result.valid === true;
    const reasons = result ? result.reasons : ['Validation result missing for this record.'];
    return {
      ...record,
      valid: valid,
      validationChecked: true,
      validationReasons: valid ? [] : reasons.slice(0, 10)
    };
  });
  const invalidCount = appliedRecords.filter((record: any) => record.valid === false).length;
  const validCount = appliedRecords.length - invalidCount;
  const text = invalidCount === 0
    ? 'Checked ' + appliedRecords.length + ' record' + (appliedRecords.length === 1 ? '' : 's') + ': all valid.'
    : 'Checked ' + appliedRecords.length + ' record' + (appliedRecords.length === 1 ? '' : 's') + ': '
      + validCount + ' valid, ' + invalidCount + ' invalid.';
  const surface = buildBuddyWorkspaceSurface(
    input.buddyText,
    appliedRecords,
    input.parse as any,
    courseOptionsFromUserMessage(emitEventAsContextPayload(payload)),
    input.fields
  );
  if (input.surfaceId) {
    surface.id = input.surfaceId;
    surface.correlationId = input.surfaceId;
  }
  if (input.activeRecordId) {
    surface.activeRecordId = input.activeRecordId;
  }
  sendAssistantResponse(socket, {
    conversationId,
    correlationId,
    messages: [{ type: 'text', text: text }],
    actions: [],
    surface: surface,
    agent: VALIDATE_AGENT_BYLINE
  });
}

/* Live validation child (same client pattern as the parse child). Returns the
 * per-record results, or null when the child failed (caller falls back to the
 * canned rules). */
async function tryBuddyValidateChild(
  payload: HostEmitEvent,
  conversationId: string,
  input: BuddyValidateInput
): Promise<BuddyValidateResult[] | null> {
  const systemPrompt = readValidateAgentPrompt();
  if (!systemPrompt) {
    return null;
  }
  try {
    const liveResult = await callOpenAICompatibleChat({
      baseUrl: config.live.baseUrl,
      apiKey: config.live.apiKey,
      model: config.live.model,
      systemPrompt: systemPrompt,
      userText: buildBuddyValidateChildUserText(input),
      temperature: config.live.temperature,
      logger: logger
    });
    const results = parseBuddyValidateChildOutput(liveResult.text, input);
    if (!results) {
      logger.error(
        '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
        conversationId,
        'buddy-validate-child-fallback',
        'error',
        'Child output was empty, non-JSON, or missing records.'
      );
      return null;
    }
    logEmitEvent(payload, conversationId, 'buddy-validate-child');
    logger.info(
      '[mock-harness] emit_event conversationId=%s path=%s endpoint=%s model=%s status=%s latencyMs=%s records=%s',
      conversationId,
      'buddy-validate-child',
      liveResult.endpoint,
      liveResult.model,
      liveResult.statusCode,
      liveResult.latencyMs,
      results.length
    );
    return results;
  } catch (error) {
    const liveError = error as LiveChatError;
    const safeMessage = liveError && liveError.details
      ? liveError.details.safeMessage
      : (error && (error as Error).message ? (error as Error).message : 'Unknown validate child failure.');
    logger.error(
      '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
      conversationId,
      'buddy-validate-child-fallback',
      'error',
      safeMessage
    );
    return null;
  }
}

async function handleBuddyValidateEvent(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null
): Promise<void> {
  const input = readBuddyValidatePayload(payload, conversationId);
  if (!input) {
    // Fail closed without a hop: no usable fields/records in the payload.
    logEmitEvent(payload, conversationId, 'buddy-validate-canned');
    sendCannedEmitEventAck(socket, payload, conversationId, correlationId);
    return;
  }
  // Remember this conversation's field list (do not drop it after
  // submit/parse errors) — the validate payload carries the current list.
  rememberBuddyFieldsList(conversationId, input.fields);
  let results: BuddyValidateResult[] | null = null;
  if (config.mode === 'live' && config.live.apiKey && config.live.model) {
    results = await tryBuddyValidateChild(payload, conversationId, input);
  }
  if (!results) {
    logEmitEvent(payload, conversationId, 'buddy-validate-canned');
    // Canned mode (or live child failure): the same rules without an LLM.
    results = cannedBuddyValidateRecords(input);
  }
  replyBuddyValidate(socket, payload, conversationId, correlationId, input, results);
}

// ============================================================================
// BW-T4: parse child agent (PARSE_AGENT.md). Called only for buddy_parse in
// live mode with non-empty text; deterministic mode never reaches this.
// ============================================================================

interface BuddyParseChildResult {
  chatText: string;
  records: CannedBuddyRecord[];
  parse: CannedBuddyParse['parse'];
}

function readParseAgentPrompt(): string {
  try {
    const prompt = fs.readFileSync(path.join(__dirname, 'PARSE_AGENT.md'), 'utf8');
    return prompt && prompt.trim() ? prompt : '';
  } catch (error) {
    logger.error('[mock-harness] emit_event path=buddy-parse-child-fallback message=PARSE_AGENT.md unreadable');
    return '';
  }
}

function buildBuddyParseChildUserText(
  buddyText: string,
  fields: BuddySurfaceField[],
  courseOptions: FormSelectOption[]
): string {
  return [
    'Build the buddy-enrol-workspace JSON for the notes below.',
    'buddy.text (echo EXACTLY, byte for byte, inside <<<BUDDY_TEXT>>> markers):',
    '<<<BUDDY_TEXT>>>',
    buddyText,
    '<<<BUDDY_TEXT>>>',
    'fields (the workspace field list; map line slots onto these ids in this order): ' + JSON.stringify(fields),
    'Select fields resolve ONLY against these host options (do not invent values): ' + JSON.stringify(courseOptions),
    'If a select mention matches none of these ids or labels, reject it and quote it in leftovers.',
    'Respond with JSON only: { chatText, surface: { type, buddy.text, records[] with source spans, parse } }.'
  ].join('\n');
}

async function tryBuddyParseChild(
  socket: any,
  payload: HostEmitEvent,
  conversationId: string,
  correlationId: string | null,
  buddyText: string,
  courseOptions: FormSelectOption[],
  sanitizeChatPrefix?: string,
  fields?: BuddySurfaceField[]
): Promise<boolean> {
  const systemPrompt = readParseAgentPrompt();
  if (!systemPrompt) {
    return false;
  }
  try {
    const liveResult = await callOpenAICompatibleChat({
      baseUrl: config.live.baseUrl,
      apiKey: config.live.apiKey,
      model: config.live.model,
      systemPrompt: systemPrompt,
      userText: buildBuddyParseChildUserText(buddyText, fields || [], courseOptions),
      temperature: config.live.temperature,
      logger: logger
    });
    const child = parseBuddyChildOutput(liveResult.text, buddyText, courseOptions);
    if (!child) {
      logger.error(
        '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
        conversationId,
        'buddy-parse-child-fallback',
        'error',
        'Child output was empty, non-JSON, or failed span validation.'
      );
      return false;
    }
    logEmitEvent(payload, conversationId, 'buddy-parse-child');
    logger.info(
      '[mock-harness] emit_event conversationId=%s path=%s endpoint=%s model=%s status=%s latencyMs=%s records=%s',
      conversationId,
      'buddy-parse-child',
      liveResult.endpoint,
      liveResult.model,
      liveResult.statusCode,
      liveResult.latencyMs,
      child.records.length
    );
    const count = child.records.length;
    let text = child.chatText || (count === 1 ? 'Parsed 1 student.' : 'Parsed ' + count + ' students.');
    if (sanitizeChatPrefix) {
      // H2: one short normalize line from the sanitize hop, in the same
      // message as the parse line (no sanitizer dump; Results untouched).
      text = sanitizeChatPrefix + text;
    }
    sendAssistantResponse(socket, {
      conversationId,
      correlationId,
      messages: [{ type: 'text', text: text }],
      actions: [],
      surface: buildBuddyWorkspaceSurface(buddyText, child.records, child.parse, courseOptions, fields),
      agent: PARSE_AGENT_BYLINE
    });
    return true;
  } catch (error) {
    const liveError = error as LiveChatError;
    const safeMessage = liveError && liveError.details
      ? liveError.details.safeMessage
      : (error && (error as Error).message ? (error as Error).message : 'Unknown parse child failure.');
    logger.error(
      '[mock-harness] emit_event conversationId=%s path=%s mapping=%s message=%s',
      conversationId,
      'buddy-parse-child-fallback',
      'error',
      safeMessage
    );
    return false;
  }
}

/* Validates and sanitizes the child's output. Any malformed record or bad span
 * invalidates the WHOLE output (fail closed → canned fallback). The host
 * renumbers record ids, recomputes `valid`, and rebuilds courseId labels from
 * the canned list so the surface the FE receives is always consistent. */
function parseBuddyChildOutput(modelText: string, buddyText: string, courseOptions: FormSelectOption[]): BuddyParseChildResult | null {
  const parsed = parseJsonFromModelText(modelText);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const candidate: any = parsed;
  const surface = candidate.surface && typeof candidate.surface === 'object' ? candidate.surface : null;
  if (!surface || String(surface.type || '') !== 'buddy-enrol-workspace') {
    return null;
  }
  const echoed = surface.buddy && typeof surface.buddy === 'object'
    ? (surface.buddy as any).text
    : null;
  if (typeof echoed !== 'string' || echoed !== buddyText) {
    return null; // must echo the text exactly or spans are meaningless
  }

  const rawRecords = Array.isArray(surface.records) ? surface.records : [];
  if (rawRecords.length > 100) {
    return null;
  }
  const records: CannedBuddyRecord[] = [];
  const parseMapped: Array<{ fieldId: string; value: string }> = [];
  const parseRejected: CannedBuddyRejection[] = [];
  const parseLeftovers: string[] = [];

  for (let index = 0; index < rawRecords.length; index++) {
    const record = sanitizeBuddyChildRecord(rawRecords[index], index, buddyText, courseOptions);
    if (!record) {
      return null;
    }
    records.push(record);
    ['name', 'dob', 'gender', 'courseId'].forEach((fieldId) => {
      if (record.values[fieldId].trim()) {
        parseMapped.push({
          fieldId: fieldId,
          value: fieldId === 'courseId' ? (record.labels.courseId || record.values[fieldId]) : record.values[fieldId]
        });
      }
    });
    record.rejected.forEach((rejection) => parseRejected.push(rejection));
    record.leftovers.forEach((leftover) => parseLeftovers.push(leftover));
  }

  const childFormat = surface.parse && typeof surface.parse === 'object'
    ? String((surface.parse as any).format || '')
    : '';
  const allowedFormats = ['csv', 'delimited', 'lines', 'prose', 'mixed'];
  const format = allowedFormats.indexOf(childFormat) !== -1 ? childFormat : 'mixed';

  return {
    chatText: typeof candidate.chatText === 'string' ? candidate.chatText.trim() : '',
    records: records,
    parse: {
      mapped: parseMapped,
      rejected: parseRejected,
      leftovers: parseLeftovers,
      format: format
    }
  };
}

function isValidBuddySpan(span: any, textLength: number): boolean {
  return !!span && typeof span === 'object'
    && typeof span.start === 'number' && isFinite(span.start)
    && typeof span.end === 'number' && isFinite(span.end)
    && span.start >= 0 && span.end >= span.start && span.end <= textLength;
}

function sanitizeBuddyChildRecord(
  raw: any,
  index: number,
  buddyText: string,
  courseOptions: FormSelectOption[]
): CannedBuddyRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const source = raw.source && typeof raw.source === 'object' ? raw.source : null;
  if (!source || !isValidBuddySpan(source.record, buddyText.length)) {
    return null;
  }
  const recordSpan = source.record;
  const values: Record<string, string> = { name: '', dob: '', gender: '', courseId: '' };
  const rawValues = raw.values && typeof raw.values === 'object' ? raw.values : {};
  ['name', 'dob', 'gender', 'courseId'].forEach((fieldId) => {
    const value = (rawValues as any)[fieldId];
    if (typeof value === 'string' || typeof value === 'number') {
      values[fieldId] = String(value).slice(0, 120);
    }
  });
  // BW-T5: courseId must be one of the host's allowed ids; a returned id that
  // matches nothing is rejected (value cleared, mention kept as rejection) —
  // the child cannot invent courses.
  let inventedCourse = '';
  if (values.courseId && !courseOptions.some((option) => option.value === values.courseId)) {
    inventedCourse = values.courseId;
    values.courseId = '';
  }

  // Field spans must exist, be in range, and sit inside the record span.
  const fields: Record<string, CannedBuddyTextSpan> = {};
  const rawFields = source.fields && typeof source.fields === 'object' ? source.fields : {};
  const fieldIds = Object.keys(rawFields).filter((key) => ['name', 'dob', 'gender', 'courseId'].indexOf(key) !== -1);
  for (let i = 0; i < fieldIds.length; i++) {
    const key = fieldIds[i];
    const span = (rawFields as any)[key];
    if (!isValidBuddySpan(span, buddyText.length)
      || span.start < recordSpan.start || span.end > recordSpan.end) {
      return null;
    }
    // A span for a cleared (invented) course id is dropped with the value.
    if (key === 'courseId' && !values.courseId) {
      continue;
    }
    fields[key] = { start: span.start, end: span.end };
  }
  // A mapped value without a span is invalid (span contract).
  const mappedIds = ['name', 'dob', 'gender', 'courseId'].filter((fieldId) => !!values[fieldId].trim());
  for (let i = 0; i < mappedIds.length; i++) {
    if (!fields[mappedIds[i]]) {
      return null;
    }
  }

  const rejected: CannedBuddyRejection[] = (Array.isArray(raw.rejected) ? raw.rejected : [])
    .filter((item: any) => item && typeof item === 'object' && typeof item.text === 'string')
    .slice(0, 20)
    .map((item: any) => ({
      fieldId: typeof item.fieldId === 'string' ? item.fieldId.slice(0, 40) : undefined,
      text: String(item.text).slice(0, 200),
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 200) : undefined
    }));
  if (inventedCourse) {
    rejected.push({ fieldId: 'courseId', text: inventedCourse, reason: 'Unresolved course.' });
  }

  const leftovers: string[] = (Array.isArray(raw.leftovers) ? raw.leftovers : [])
    .filter((item: any) => typeof item === 'string' && item.trim())
    .slice(0, 20)
    .map((item: any) => String(item).slice(0, 200));

  const labels: Record<string, string> = {};
  if (values.courseId) {
    // Labels are rebuilt from the host list only; the child cannot invent courses.
    labels.courseId = courseLabelForId(values.courseId, courseOptions);
  }

  return {
    id: 'r' + (index + 1),
    values: values,
    labels: labels,
    rejected: rejected,
    leftovers: leftovers,
    valid: ['name', 'dob', 'gender', 'courseId'].every((fieldId) => !!values[fieldId].trim())
      && rejected.length === 0,
    source: {
      record: { start: recordSpan.start, end: recordSpan.end },
      fields: fields
    }
  };
}

/* Small canned mapper (BW-T3, spans added in BW-T3.5). One line per student;
 * comma/pipe segments are classified by shape: real-calendar date → dob,
 * female|girl/male|boy → gender, class|course|grade|standard prefix → course
 * (exact match against the HOST's live course options only), explicit name
 * key or first unclaimed
 * capitalized segment → name. Anything unclaimed is a leftover. Nothing is
 * invented. Every mapped token also reports its end-exclusive character span
 * in the submitted buddy.text so the host can splice form edits without
 * re-splitting text. */
function cannedBuddyParse(rawText: string, courseOptions: FormSelectOption[]): CannedBuddyParse {
  const records: CannedBuddyRecord[] = [];
  const parseMapped: Array<{ fieldId: string; value: string }> = [];
  const parseRejected: CannedBuddyRejection[] = [];
  const parseLeftovers: string[] = [];
  const text = String(rawText || '');
  let lineStart = 0;

  text.split('\n').forEach((rawLine) => {
    const lineStartAbs = lineStart;
    lineStart += rawLine.length + 1; // +1 for the '\n' itself
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }
    // Skip a cue/header line like "name | dob (dd/mm/yyyy) | gender | course".
    if (trimmed.indexOf('|') !== -1 && /\bdob\b/i.test(trimmed)) {
      return;
    }
    if (/^(---+|\*\*\*+)$/.test(trimmed)) {
      return;
    }
    const trimStartAbs = lineStartAbs + (rawLine.length - rawLine.trimStart().length);

    const record: CannedBuddyRecord = {
      id: 'r' + (records.length + 1),
      values: { name: '', dob: '', gender: '', courseId: '' },
      labels: {},
      rejected: [],
      leftovers: [],
      valid: false,
      source: {
        record: { start: trimStartAbs, end: trimStartAbs + trimmed.length },
        fields: {}
      }
    };

    // Scan segments of the trimmed line, keeping absolute token offsets.
    let pos = 0;
    while (pos < trimmed.length) {
      let next = trimmed.length;
      for (let i = pos; i < trimmed.length; i++) {
        const ch = trimmed.charAt(i);
        if (ch === ',' || ch === '|') {
          next = i;
          break;
        }
      }
      const rawSegment = trimmed.slice(pos, next);
      const segStartAbs = trimStartAbs + pos;
      pos = next + 1;
      const segment = rawSegment.trim();
      if (!segment) {
        continue;
      }
      const tokenStart = segStartAbs + (rawSegment.length - rawSegment.trimStart().length);
      const tokenEnd = tokenStart + segment.length;
      classifyCannedSegment(record, segment, { start: tokenStart, end: tokenEnd }, parseRejected, courseOptions);
    }

    record.valid = ['name', 'dob', 'gender', 'courseId'].every((fieldId) => !!record.values[fieldId].trim())
      && record.rejected.length === 0;
    records.push(record);

    ['name', 'dob', 'gender', 'courseId'].forEach((fieldId) => {
      if (record.values[fieldId].trim()) {
        parseMapped.push({
          fieldId: fieldId,
          value: fieldId === 'courseId' ? (record.labels.courseId || record.values[fieldId]) : record.values[fieldId]
        });
      }
    });
    record.leftovers.forEach((leftover) => parseLeftovers.push(leftover));
  });

  return {
    records: records,
    parse: {
      mapped: parseMapped,
      rejected: parseRejected,
      leftovers: parseLeftovers,
      format: 'mixed'
    }
  };
}

function classifyCannedSegment(
  record: CannedBuddyRecord,
  segment: string,
  tokenSpan: CannedBuddyTextSpan,
  parseRejected: CannedBuddyRejection[],
  courseOptions: FormSelectOption[]
): void {
  const labeled = matchLabeledSegment(segment);
  if (labeled) {
    // Span only the value part of "key: value", not the key.
    const keyLength = matchLabeledKeyLength(segment);
    const valueStart = keyLength >= 0 ? keyLength : 0;
    assignCannedField(
      record,
      labeled.fieldId,
      labeled.value,
      { start: tokenSpan.start + valueStart, end: tokenSpan.start + valueStart + labeled.value.length },
      parseRejected,
      courseOptions
    );
    return;
  }

  const dob = parseCannedDate(segment);
  if (dob) {
    assignCannedField(record, 'dob', dob, tokenSpan, parseRejected, courseOptions);
    return;
  }
  if (isCannedDateShaped(segment)) {
    // Explicit but calendar-invalid date (e.g. 31/02/2014) → rejected, never guessed, no field span.
    record.rejected.push({ fieldId: 'dob', text: segment, reason: 'Not a valid date.' });
    parseRejected.push({ fieldId: 'dob', text: segment, reason: 'Not a valid date.' });
    return;
  }

  const gender = parseCannedGender(segment);
  if (gender) {
    assignCannedField(record, 'gender', gender, tokenSpan, parseRejected, courseOptions);
    return;
  }

  const course = parseCannedCourse(segment, courseOptions);
  if (course.matched) {
    assignCannedField(record, 'courseId', course.value, tokenSpan, parseRejected, courseOptions);
    return;
  }
  if (course.rejected) {
    record.rejected.push({ fieldId: 'courseId', text: course.rejected, reason: 'Unresolved course.' });
    record.leftovers.push(segment);
    parseRejected.push({ fieldId: 'courseId', text: course.rejected, reason: 'Unresolved course.' });
    return;
  }

  if (!record.values.name && looksLikeCannedName(segment)) {
    assignCannedField(record, 'name', segment, tokenSpan, parseRejected, courseOptions);
    return;
  }

  record.leftovers.push(segment);
}

function matchLabeledSegment(segment: string): { fieldId: string; value: string } | null {
  const match = /^(name|student\s*name|full\s*name|dob|date\s*of\s*birth|gender|sex|course|class|standard|grade)\s*[:=-]\s*(.+)$/i.exec(segment.trim());
  if (!match) {
    return null;
  }
  const key = match[1].toLowerCase().replace(/\s+/g, ' ');
  const value = match[2].trim();
  if (!value) {
    return null;
  }
  if (key === 'name' || key === 'student name' || key === 'full name') {
    return { fieldId: 'name', value: value };
  }
  if (key === 'dob' || key === 'date of birth') {
    return { fieldId: 'dob', value: value };
  }
  if (key === 'gender' || key === 'sex') {
    return { fieldId: 'gender', value: value };
  }
  return { fieldId: 'courseId', value: value };
}

/* Length of the "key: " prefix of a labeled segment, so spans cover only the value. */
function matchLabeledKeyLength(segment: string): number {
  const match = /^(name|student\s*name|full\s*name|dob|date\s*of\s*birth|gender|sex|course|class|standard|grade)\s*[:=-]\s*/i.exec(segment.trim());
  return match ? match[0].length : -1;
}

/* dd/mm/yyyy (calendar-checked) or yyyy-mm-dd; invalid dates are rejected, not guessed. */
function isCannedDateShaped(segment: string): boolean {
  const text = segment.trim();
  return /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.test(text) || /^(\d{4})-(\d{2})-(\d{2})$/.test(text);
}

function parseCannedDate(segment: string): string {
  const text = segment.trim();
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let day = 0;
  let month = 0;
  let year = 0;
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (iso) {
    day = Number(iso[3]);
    month = Number(iso[2]);
    year = Number(iso[1]);
  } else {
    return '';
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return '';
  }
  const pad = (value: number) => (value < 10 ? '0' : '') + String(value);
  return pad(day) + '/' + pad(month) + '/' + String(year);
}

function parseCannedGender(segment: string): string {
  const text = segment.trim().toLowerCase();
  if (text === 'female' || text === 'girl' || text === 'f') {
    return 'Female';
  }
  if (text === 'male' || text === 'boy' || text === 'm') {
    return 'Male';
  }
  return '';
}

function parseCannedCourse(segment: string, courseOptions: FormSelectOption[]): { matched: boolean; value: string; rejected: string } {
  const text = segment.trim();
  if (!text) {
    return { matched: false, value: '', rejected: '' };
  }
  // Exact match against the HOST's live course options on the raw text first
  // ("Grade 6"), then on the keyword-stripped rest ("class Grade 6"). Only an
  // explicit course mention that matches nothing is rejected; anything else is
  // not course-shaped. An empty host list matches nothing (honest rejection).
  const candidates = [text];
  const stripMatch = /^(class|course|standard|grade)\b[\s:.-]*/i.exec(text);
  if (stripMatch) {
    const rest = text.slice(stripMatch[0].length).trim();
    if (rest) {
      candidates.push(rest);
    }
  }
  const found = candidates
    .map((candidate) => courseOptions.filter((option) => option.label.toLowerCase() === candidate.toLowerCase()
      || option.value.toLowerCase() === candidate.toLowerCase()))
    .filter((matches) => matches.length);
  if (found.length) {
    return { matched: true, value: found[0][0].value, rejected: '' };
  }
  if (stripMatch) {
    return { matched: false, value: '', rejected: text };
  }
  return { matched: false, value: '', rejected: '' };
}

function looksLikeCannedName(segment: string): boolean {
  const words = segment.trim().split(/\s+/);
  if (words.length < 1 || words.length > 4) {
    return false;
  }
  return words.every((word) => /^[A-Z][a-zA-Z'.’-]*$/.test(word));
}

function assignCannedField(
  record: CannedBuddyRecord,
  fieldId: string,
  value: string,
  span: CannedBuddyTextSpan | null,
  parseRejected: CannedBuddyRejection[],
  courseOptions: FormSelectOption[]
): void {
  const text = String(value || '').trim();
  if (!text) {
    return;
  }
  if (fieldId === 'dob') {
    const normalized = parseCannedDate(text);
    if (normalized) {
      record.values.dob = normalized;
      if (span) {
        record.source.fields.dob = span;
      }
      return;
    }
    record.rejected.push({ fieldId: 'dob', text: text, reason: 'Not a valid date.' });
    parseRejected.push({ fieldId: 'dob', text: text, reason: 'Not a valid date.' });
    return;
  }
  if (fieldId === 'gender') {
    const gender = parseCannedGender(text);
    if (gender) {
      record.values.gender = gender;
      if (span) {
        record.source.fields.gender = span;
      }
      return;
    }
    record.rejected.push({ fieldId: 'gender', text: text, reason: 'Unknown gender.' });
    parseRejected.push({ fieldId: 'gender', text: text, reason: 'Unknown gender.' });
    return;
  }
  if (fieldId === 'courseId') {
    const course = parseCannedCourse(text, courseOptions);
    if (course.matched) {
      record.values.courseId = course.value;
      record.labels.courseId = courseLabelForId(course.value, courseOptions);
      if (span) {
        record.source.fields.courseId = span;
      }
      return;
    }
    record.rejected.push({ fieldId: 'courseId', text: text, reason: 'Unresolved course.' });
    parseRejected.push({ fieldId: 'courseId', text: text, reason: 'Unresolved course.' });
    return;
  }
  record.values[fieldId] = text;
  if (span) {
    record.source.fields[fieldId] = span;
  }
}

function courseLabelForId(id: string, courseOptions: FormSelectOption[]): string {
  const found = courseOptions.filter((option) => option.value === id);
  return found.length ? found[0].label : id;
}

/* H4: ONE field list for the buddy workspace surface, the sanitize hop, and
 * the parse hop — the ids below are the workspace field definition itself,
 * never duplicated in hop builders or agent markdown. Whatever this list is
 * on the surface this turn is what sanitize and parse use. */
interface BuddySurfaceField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  options?: FormSelectOption[];
}

function buddyWorkspaceFields(courseOptions: FormSelectOption[]): BuddySurfaceField[] {
  return [
    { id: 'name', label: 'Name', type: 'text', required: true, maxLength: 50 },
    { id: 'dob', label: 'Date of Birth', type: 'date', required: true, placeholder: 'dd/mm/yyyy' },
    {
      id: 'gender',
      label: 'Gender',
      type: 'select',
      required: true,
      options: [
        { value: 'Female', label: 'Female' },
        { value: 'Male', label: 'Male' }
      ]
    },
    {
      id: 'courseId',
      label: 'Course',
      type: 'select',
      required: true,
      // Host's live course list (deduped, capped 100). Empty stays empty -
      // no canned demo fallback; the mock harness never calls CampusTrack APIs.
      options: courseOptions
    }
  ];
}

/* H5: live workspace fields remembered from the main agent's JSON (per
 * conversation). The sanitize/parse hops and the parse reply surface reuse
 * this same array — no TS field list is rebuilt on live paths. Canned mode
 * keeps buddyWorkspaceFields() as the canned stand-in. */
const liveBuddyFieldsByConversation = new Map<string, BuddySurfaceField[]>();

/* H-validate echo: last remembered buddy notes per conversation, so a
 * buddy_validate reply can echo the same buddy.text as the request (or the
 * last parse) instead of wiping the textarea. */
const lastBuddyNotesByConversation = new Map<string, string>();

function rememberBuddyNotes(conversationId: string, buddyText: string): void {
  const text = String(buddyText || '');
  if (!text.trim()) {
    return;
  }
  if (lastBuddyNotesByConversation.size >= 50) {
    const oldest = lastBuddyNotesByConversation.keys().next().value;
    if (oldest) {
      lastBuddyNotesByConversation.delete(oldest);
    }
  }
  lastBuddyNotesByConversation.set(conversationId, text);
}

function rememberedBuddyNotes(conversationId: string): string {
  return lastBuddyNotesByConversation.get(conversationId) || '';
}

/* Validates + normalizes a raw fields array (id/label/type required; options
 * deduped and capped). No logging, no store. */
function sanitizeBuddyFieldsList(rawFields: unknown): BuddySurfaceField[] {
  if (!Array.isArray(rawFields)) {
    return [];
  }
  const fields: BuddySurfaceField[] = [];
  rawFields.slice(0, 20).forEach((item: any) => {
    if (item && typeof item === 'object'
        && typeof item.id === 'string' && item.id.trim()
        && typeof item.label === 'string' && item.label.trim()
        && typeof item.type === 'string' && item.type.trim()) {
      const field: BuddySurfaceField = { id: item.id.trim(), label: item.label.trim(), type: item.type.trim() };
      if (item.required === true) {
        field.required = true;
      }
      if (Array.isArray(item.options) && item.options.length) {
        field.options = mapSelectOptions(item.options);
      }
      fields.push(field);
    }
  });
  return fields;
}

function rememberBuddyFieldsList(conversationId: string, rawFields: unknown): BuddySurfaceField[] {
  const fields = sanitizeBuddyFieldsList(rawFields);
  if (!fields.length) {
    return [];
  }
  if (liveBuddyFieldsByConversation.size >= 50) {
    const oldest = liveBuddyFieldsByConversation.keys().next().value;
    if (oldest) {
      liveBuddyFieldsByConversation.delete(oldest);
    }
  }
  liveBuddyFieldsByConversation.set(conversationId, fields);
  logger.info(
    '[mock-harness] live workspace fields conversationId=%s fields=%s',
    conversationId,
    fields.map((field) => field.id).join(',')
  );
  return fields;
}

function rememberBuddyFieldsFromSurface(
  conversationId: string,
  surface: InstituteSurface | Record<string, unknown> | undefined
): void {
  if (!surface || typeof surface !== 'object') {
    return;
  }
  if (String((surface as any).type || '') !== 'buddy-enrol-workspace') {
    return;
  }
  rememberBuddyFieldsList(conversationId, (surface as any).fields);
}

function rememberedBuddyFields(conversationId: string): BuddySurfaceField[] {
  return liveBuddyFieldsByConversation.get(conversationId) || [];
}

function buildBuddyWorkspaceSurface(
  buddyText: string,
  records: CannedBuddyRecord[],
  parse: CannedBuddyParse['parse'] | undefined,
  courseOptions: FormSelectOption[],
  fieldsOverride?: BuddySurfaceField[]
): Record<string, unknown> {
  const surfaceId = 'buddy_ws_' + Date.now();
  const safeRecords = Array.isArray(records) ? records : [];
  // H5: an explicit override (the model's fields on live paths) wins — even
  // an empty array (fail-closed). Only undefined keeps the canned stand-in.
  // Host select options overwrite options only, never the field ids.
  const surfaceFields = Array.isArray(fieldsOverride)
    ? fieldsOverride.map((field) => (
      field.type === 'select' && field.id === 'courseId'
        ? { ...field, options: courseOptions }
        : field
    ))
    : buddyWorkspaceFields(courseOptions);
  return {
    type: 'buddy-enrol-workspace',
    id: surfaceId,
    title: 'Enroll from notes',
    formId: 'student-enrol-buddy',
    submitAction: 'student.enrol.submit',
    correlationId: surfaceId,
    buddy: {
      text: String(buddyText || '')
    },
    records: safeRecords,
    ...(safeRecords.length ? { activeRecordId: safeRecords[0].id } : {}),
    fields: surfaceFields,
    parse: parse || { mapped: [], rejected: [], leftovers: [], format: 'mixed' }
  };
}

function readCurrentRoute(payload: HostUserMessage): string {
  const context: HostContextBag = payload.context || { route: '' };
  const route = context && typeof context.route === 'string' ? context.route.trim() : '';
  return route || '';
}

function readPersona(payload: HostUserMessage): string {
  const context: HostContextBag = payload.context || { route: '' };
  const persona = context && typeof context.persona === 'string' ? context.persona.trim() : '';
  return persona || '';
}

function readContextFocus(payload: HostUserMessage): HostFocusContext | null {
  const context: HostContextBag = payload.context || { route: '' };
  const focus = context && (context as any).focus;
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) {
    return null;
  }
  return focus as HostFocusContext;
}

function readContextFlags(payload: HostUserMessage): HostFlagsContext {
  const context: HostContextBag = payload.context || { route: '' };
  const flags = context && (context as any).flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return {};
  }
  return flags as HostFlagsContext;
}

function readModuleFlags(payload: HostUserMessage): HostModuleFlagsContext {
  const context: HostContextBag = payload.context || { route: '' };
  const moduleFlags = context && (context as any).moduleFlags;
  if (!moduleFlags || typeof moduleFlags !== 'object' || Array.isArray(moduleFlags)) {
    return {};
  }
  return moduleFlags as HostModuleFlagsContext;
}

function readViewContext(payload: HostUserMessage): HostViewContext | null {
  const context: HostContextBag = payload.context || { route: '' };
  const view = context && (context as any).view;
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return null;
  }
  return view as HostViewContext;
}

function isFeesViewContext(viewContext: HostViewContext | null): boolean {
  return !!(viewContext && typeof viewContext.module === 'string' && viewContext.module.toLowerCase() === 'fees');
}

function readInstituteContext(payload: HostUserMessage): InstituteContextSnapshot | null {
  const context: HostContextBag = payload.context || { route: '' };
  const institute = context && (context as any).institute;
  if (!institute || typeof institute !== 'object' || Array.isArray(institute)) {
    return null;
  }
  return institute as InstituteContextSnapshot;
}

function isViewSummaryQuestion(text: string): boolean {
  const normalized = (text || '').toLowerCase();
  if (!normalized.trim()) {
    return false;
  }
  return /(what can you see|what do you see|what data do you have|what information do you have|which columns|show .*current view|what.*on (this|the) (screen|page))/i.test(normalized);
}

function summarizeVisibleView(text: string, viewContext: HostViewContext | null): string | null {
  if (!isViewSummaryQuestion(text)) {
    return null;
  }
  if (!viewContext) {
    return 'I do not have a view snapshot for this screen yet.';
  }
  const rows = readViewRows(viewContext);
  const columns = readViewColumns(viewContext, rows);
  const moduleText = readDisplayValue(viewContext.module) || 'unknown module';
  const screenText = readDisplayValue(viewContext.screen) || 'current screen';
  const rowCount = typeof viewContext.rowCount === 'number' && isFinite(viewContext.rowCount)
    ? viewContext.rowCount
    : rows.length;
  const visibleRows = rows.length;
  const truncated = !!viewContext.truncated;
  const maxRows = typeof viewContext.maxRows === 'number' && isFinite(viewContext.maxRows) ? viewContext.maxRows : visibleRows;
  const lines: string[] = [];
  lines.push('You are on ' + moduleText + ' / ' + screenText + '.');
  lines.push(
    truncated
      ? 'I can see ' + visibleRows + ' rows out of ' + rowCount + ' total (capped at ' + maxRows + ').'
      : 'I can see ' + visibleRows + ' rows.'
  );
  if (columns.length) {
    lines.push('Columns: ' + columns.slice(0, 15).join(', ') + (columns.length > 15 ? ', ...' : ''));
  }
  const filterText = summarizeFilters(viewContext.filters);
  if (filterText) {
    lines.push('Active filters: ' + filterText + '.');
  }
  const sampleText = summarizeSampleRows(rows, columns);
  if (sampleText) {
    lines.push(sampleText);
  }
  return lines.join('\n');
}

function hasNotFoundLikeTextMessage(messages: AssistantMessageBlock[]): boolean {
  return messages.some((message: AssistantMessageBlock) => {
    if (message.type !== 'text') {
      return false;
    }
    return isNotFoundLikeText((message as any).text);
  });
}

function isNotFoundLikeText(text: string): boolean {
  const normalized = normalizeSearchText(text || '');
  if (!normalized) {
    return false;
  }
  return normalized.indexOf('couldnt find') >= 0
    || normalized.indexOf('could not find') >= 0
    || normalized.indexOf('not found') >= 0
    || normalized.indexOf('no fee transaction') >= 0
    || normalized.indexOf('no matching') >= 0;
}

function isUnresolvedViewAnswer(text: string): boolean {
  const normalized = normalizeSearchText(text || '');
  if (!normalized) {
    return true;
  }
  return normalized.indexOf('couldnt') >= 0
    || normalized.indexOf('could not') >= 0
    || normalized.indexOf('cannot') >= 0
    || normalized.indexOf('do not have') >= 0
    || normalized.indexOf('please include') >= 0
    || normalized.indexOf('does not include') >= 0
    || normalized.indexOf('not present') >= 0
    || normalized.indexOf('unavailable') >= 0
    || normalized.indexOf('cannot find') >= 0
    || normalized.indexOf('not found') >= 0;
}

interface ViewQaInspection {
  rowCount: number;
  nameMatched: boolean;
  dateConstrained: boolean;
  dateMatched: boolean;
}

function inspectViewQa(text: string, viewContext: HostViewContext | null): ViewQaInspection | null {
  if (!isFeesAmountQuestion(text) || !isFeesViewContext(viewContext)) {
    return null;
  }
  const rows = readViewRows(viewContext as HostViewContext);
  const columns = readViewColumns(viewContext as HostViewContext, rows);
  const candidateName = extractCandidateStudentName(text);
  const normalizedCandidate = normalizeSearchText(candidateName);
  const askedDate = extractDateToken(text);
  const studentNameKey = resolveFirstMatchingKey(columns, [/student.?name/i, /^name$/i]);
  const studentIdKey = resolveFirstMatchingKey(columns, [/student.?id/i, /^stu.?id$/i]);
  const dateKey = resolveFirstMatchingKey(columns, [/tx.?date/i, /transaction.?date/i, /\bdate\b/i]);
  const nameMatchedRows = rows.filter((row: Record<string, unknown>) => {
    const nameText = studentNameKey ? normalizeSearchText(readDisplayValue(row[studentNameKey])) : '';
    const idText = studentIdKey ? normalizeSearchText(readDisplayValue(row[studentIdKey])) : '';
    if (!normalizedCandidate) {
      return false;
    }
    return (nameText && (nameText.indexOf(normalizedCandidate) >= 0 || normalizedCandidate.indexOf(nameText) >= 0))
      || (idText && (idText.indexOf(normalizedCandidate) >= 0 || normalizedCandidate.indexOf(idText) >= 0));
  });
  let dateMatched = false;
  if (askedDate && dateKey) {
    dateMatched = nameMatchedRows.some((row: Record<string, unknown>) => normalizeDateToken(row[dateKey]) === askedDate);
  } else if (askedDate && !dateKey) {
    dateMatched = false;
  } else {
    dateMatched = nameMatchedRows.length > 0;
  }
  return {
    rowCount: rows.length,
    nameMatched: nameMatchedRows.length > 0,
    dateConstrained: !!askedDate,
    dateMatched: dateMatched
  };
}

function isFeesAmountQuestion(text: string): boolean {
  const normalized = (text || '').toLowerCase();
  if (!normalized.trim()) {
    return false;
  }
  if (!/\b(fee|fees|payment|paid|due|balance)\b/.test(normalized)) {
    return false;
  }
  return /\b(paid|due|balance|how much|amount|what(?:'s| is)|payment|on)\b/.test(normalized);
}

function answerFeesAmountQuestion(text: string, viewContext: HostViewContext | null): string | null {
  if (!isFeesAmountQuestion(text)) {
    return null;
  }
  if (!isFeesViewContext(viewContext)) {
    return 'I can answer fee amounts only from a Fees view snapshot. Open a Fees screen with loaded rows and ask again.';
  }

  const rows = readViewRows(viewContext as HostViewContext);
  const columns = readViewColumns(viewContext as HostViewContext, rows);
  if (!rows.length) {
    return 'I do not have fee rows in the current Fees view yet. Open Fees Transactions and keep the list loaded, then ask again.';
  }

  const normalizedQuestion = normalizeSearchText(text);
  const candidateName = extractCandidateStudentName(text);
  const normalizedCandidate = normalizeSearchText(candidateName);
  const studentNameKey = resolveFirstMatchingKey(columns, [/student.?name/i, /^name$/i]);
  const studentIdKey = resolveFirstMatchingKey(columns, [/student.?id/i, /^stu.?id$/i]);
  const paidKey = resolveFirstMatchingKey(columns, [/^paid$/i, /paid.?amount/i, /^amount$/i, /tx.?amount/i]);
  const dueKey = resolveFirstMatchingKey(columns, [/^due$/i, /due.?amount/i, /pending/i, /balance/i]);
  const dateKey = resolveFirstMatchingKey(columns, [/tx.?date/i, /transaction.?date/i, /\bdate\b/i]);
  const askedDate = extractDateToken(text);

  if (!normalizedCandidate) {
    return 'Please include the student name so I can answer from the current Fees rows.';
  }

  if (askedDate && !dateKey) {
    return 'The current Fees view does not include a date column, so I cannot filter by date from this snapshot.';
  }

  let matchingRows = rows.slice();
  if (studentNameKey || studentIdKey) {
    matchingRows = matchingRows.filter((row: Record<string, unknown>) => {
      const studentName = studentNameKey ? normalizeSearchText(readDisplayValue(row[studentNameKey])) : '';
      const studentId = studentIdKey ? normalizeSearchText(readDisplayValue(row[studentIdKey])) : '';
      if (normalizedQuestion && studentName && normalizedQuestion.indexOf(studentName) >= 0) {
        return true;
      }
      if (normalizedQuestion && studentId && normalizedQuestion.indexOf(studentId) >= 0) {
        return true;
      }
      if (normalizedCandidate && studentName && (studentName.indexOf(normalizedCandidate) >= 0 || normalizedCandidate.indexOf(studentName) >= 0)) {
        return true;
      }
      if (normalizedCandidate && studentId && (studentId.indexOf(normalizedCandidate) >= 0 || normalizedCandidate.indexOf(studentId) >= 0)) {
        return true;
      }
      return !normalizedCandidate;
    });
  }

  if (askedDate && dateKey) {
    matchingRows = matchingRows.filter((row: Record<string, unknown>) => {
      const normalizedRowDate = normalizeDateToken(row[dateKey]);
      return normalizedRowDate === askedDate;
    });
    if (!matchingRows.length) {
      return 'I could not find rows for that student/date combination in the current Fees view.';
    }
  }

  if (!matchingRows.length) {
    if (candidateName) {
      return 'I cannot find "' + candidateName + '" in the current Fees rows. Filter/search the transactions list for that student and ask again.';
    }
    return 'I can answer fee paid/due amounts from the visible Fees rows. Please include the student name.';
  }

  const groupedByStudent: Record<string, Array<Record<string, unknown>>> = {};
  matchingRows.forEach((row: Record<string, unknown>) => {
    const key = (studentNameKey && readDisplayValue(row[studentNameKey]))
      || (studentIdKey && readDisplayValue(row[studentIdKey]))
      || 'Selected student';
    if (!groupedByStudent[key]) {
      groupedByStudent[key] = [];
    }
    groupedByStudent[key].push(row);
  });

  const studentNames = Object.keys(groupedByStudent);
  const firstStudent = studentNames[0];
  const firstRows = groupedByStudent[firstStudent];
  const totals = firstRows.reduce((acc: { paid: number; due: number; paidCount: number; dueCount: number }, row: Record<string, unknown>) => {
    const paid = paidKey ? toFiniteNumber(row[paidKey]) : null;
    const due = dueKey ? toFiniteNumber(row[dueKey]) : null;
    if (paid !== null) {
      acc.paid += paid;
      acc.paidCount += 1;
    }
    if (due !== null) {
      acc.due += due;
      acc.dueCount += 1;
    }
    return acc;
  }, { paid: 0, due: 0, paidCount: 0, dueCount: 0 });

  if (!paidKey && !dueKey) {
    return 'The current Fees view does not include paid/due amount columns, so I cannot answer that from this snapshot.';
  }

  if (!totals.paidCount && !totals.dueCount) {
    return 'I found matching student rows, but paid/due values are not present in those rows.';
  }

  const details: string[] = [];
  if (totals.paidCount) {
    details.push('paid ₹' + formatCurrencyLike(Number(totals.paid)));
  }
  if (totals.dueCount) {
    details.push('due ₹' + formatCurrencyLike(Number(totals.due)));
  }
  const rowCountText = firstRows.length + (firstRows.length === 1 ? ' visible row' : ' visible rows');
  let message = 'From the current Fees view, ' + firstStudent + ' has ' + details.join(' and ') + ' (' + rowCountText + ').';
  if (askedDate) {
    message += ' Date filter: ' + askedDate + '.';
  }
  if (studentNames.length > 1) {
    message += ' I found multiple student matches; this summary uses the first match.';
  }
  return message;
}

function extractCandidateStudentName(text: string): string {
  const raw = typeof text === 'string' ? text : '';
  const byMatch = raw.match(/\b(?:by|for|of)\s+([a-z][a-z\s.'-]{1,60})/i);
  const source = byMatch && byMatch[1] ? byMatch[1] : raw;
  const cleaned = source
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b(student|fees?|payment|paid|due|details?|info|information|what|how|much|is|are|the|about|on)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readViewRows(viewContext: HostViewContext): Array<Record<string, unknown>> {
  return Array.isArray(viewContext.rows) ? viewContext.rows as Array<Record<string, unknown>> : [];
}

function readViewColumns(viewContext: HostViewContext, rows: Array<Record<string, unknown>>): string[] {
  if (Array.isArray(viewContext.columns) && viewContext.columns.length) {
    return viewContext.columns
      .filter((column: any) => typeof column === 'string')
      .map((column: string) => column.trim())
      .filter((column: string) => !!column);
  }
  const seen: Record<string, boolean> = {};
  const columns: string[] = [];
  rows.forEach((row: Record<string, unknown>) => {
    Object.keys(row).forEach((key: string) => {
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      columns.push(key);
    });
  });
  return columns;
}

function resolveFirstMatchingKey(columns: string[], patterns: RegExp[]): string {
  for (let i = 0; i < columns.length; i++) {
    const key = columns[i];
    for (let j = 0; j < patterns.length; j++) {
      if (patterns[j].test(key)) {
        return key;
      }
    }
  }
  return '';
}

function extractDateToken(text: string): string {
  const raw = typeof text === 'string' ? text : '';
  const match = raw.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{2,4})\b/);
  if (!match || !match[1]) {
    return '';
  }
  return normalizeDateToken(match[1]) || '';
}

function normalizeDateToken(value: unknown): string {
  const text = readDisplayValue(value);
  if (!text) {
    return '';
  }
  const ymdMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return ymdMatch[1] + '-' + ymdMatch[2] + '-' + ymdMatch[3];
  }
  const dmyMatch = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{2,4})\b/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? '20' + dmyMatch[3] : dmyMatch[3];
    return year + '-' + dmyMatch[2] + '-' + dmyMatch[1];
  }
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function summarizeFilters(filters: unknown): string {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return '';
  }
  const parts: string[] = [];
  Object.keys(filters as Record<string, unknown>).forEach((key: string) => {
    const value = (filters as Record<string, unknown>)[key];
    const text = readDisplayValue(value);
    if (text) {
      parts.push(key + '=' + text);
    }
  });
  return parts.join(', ');
}

function summarizeSampleRows(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (!rows.length) {
    return '';
  }
  const preferredColumns = columns.slice(0, 6);
  const sampleRows = rows.slice(0, 2).map((row: Record<string, unknown>, index: number) => {
    const cells: string[] = [];
    for (let i = 0; i < preferredColumns.length; i++) {
      const key = preferredColumns[i];
      const value = readDisplayValue(row[key]);
      if (!value) {
        continue;
      }
      cells.push(key + ': ' + value);
      if (cells.length >= 4) {
        break;
      }
    }
    return 'Row ' + (index + 1) + ': ' + (cells.length ? cells.join(', ') : '(no scalar fields)');
  });
  return 'Sample rows:\n' + sampleRows.join('\n');
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(String(value).replace(/,/g, '').trim());
  if (!isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function formatCurrencyLike(amount: number): string {
  if (!isFinite(amount)) {
    return '0';
  }
  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0 ? String(rounded.toFixed(0)) : rounded.toFixed(2);
}

function hasOkInstituteData(instituteContext: InstituteContextSnapshot | null): boolean {
  if (!instituteContext || instituteContext.status !== 'ok' || !instituteContext.data || typeof instituteContext.data !== 'object') {
    return false;
  }
  const data = instituteContext.data;
  return !!(
    readDisplayValue(data.name)
    || readDisplayValue(data.shortName)
    || readDisplayValue(data.address)
    || readDisplayValue(data.status)
    || readDisplayValue(data.board)
    || readDisplayValue(data.academicYearFrom)
    || readDisplayValue(data.academicYearTo)
  );
}

function assistantClaimsInstituteUnavailable(messages: AssistantMessageBlock[]): boolean {
  const text = messages
    .map((message: AssistantMessageBlock) => {
      if (message.type === 'text') {
        return String((message as any).text || '');
      }
      if (message.type === 'markdown') {
        return String((message as any).markdown || '');
      }
      return '';
    })
    .join(' ')
    .toLowerCase();
  if (!text.trim()) {
    return true;
  }
  return /\b(unavailable|don't have|do not have|could not load|no institute data|not have institute|i don't have institute|i do not have institute)\b/.test(text);
}

function replaceFirstTextLikeMessage(
  messages: AssistantMessageBlock[],
  text: string
): AssistantMessageBlock[] {
  let replaced = false;
  const next = messages.map((message: AssistantMessageBlock) => {
    if (replaced) {
      return message;
    }
    if (message.type === 'text' || message.type === 'markdown') {
      replaced = true;
      return createTextBlock(text);
    }
    return message;
  });
  if (!replaced) {
    next.unshift(createTextBlock(text));
  }
  return next;
}

function repairInstituteUnavailableText(
  messages: AssistantMessageBlock[],
  instituteContext: InstituteContextSnapshot | null,
  surface: InstituteSurface | Record<string, unknown> | undefined,
  conversationId: string
): AssistantMessageBlock[] {
  const surfaceData = surface && surface.type === 'institute-summary' && (surface as any).data
    ? (surface as any).data
    : null;
  const surfaceHasName = !!(surfaceData && readDisplayValue(surfaceData.name));
  if (!hasOkInstituteData(instituteContext) && !surfaceHasName) {
    return messages;
  }
  const summaryContext = hasOkInstituteData(instituteContext)
    ? instituteContext
    : {
      status: 'ok',
      data: surfaceData || {}
    };
  const name = readDisplayValue(
    (summaryContext && summaryContext.data && summaryContext.data.name) || (surfaceData && surfaceData.name)
  );
  const joined = messages
    .map((message: AssistantMessageBlock) => {
      if (message.type === 'text') {
        return String((message as any).text || '');
      }
      if (message.type === 'markdown') {
        return String((message as any).markdown || '');
      }
      return '';
    })
    .join(' ')
    .toLowerCase();
  const mentionsName = !!(name && joined.indexOf(name.toLowerCase()) >= 0);
  if (mentionsName && !assistantClaimsInstituteUnavailable(messages)) {
    return messages;
  }
  logger.info(
    '[mock-harness] institute text repair conversationId=%s reason=unavailable-or-missing-summary-with-ok-data',
    conversationId
  );
  return replaceFirstTextLikeMessage(messages, buildInstituteSummaryMessage(summaryContext, false));
}

function buildInstituteSummaryMessage(
  instituteContext: InstituteContextSnapshot | null,
  allowDemoFallback: boolean
): string {
  if (instituteContext && instituteContext.status === 'ok' && instituteContext.data && typeof instituteContext.data === 'object') {
    const data = instituteContext.data;
    const lines: string[] = ['Institute summary:'];
    if (readDisplayValue(data.name)) {
      lines.push('• Name: ' + readDisplayValue(data.name));
    }
    if (readDisplayValue(data.shortName)) {
      lines.push('• Short name: ' + readDisplayValue(data.shortName));
    }
    if (readDisplayValue(data.academicYearFrom) || readDisplayValue(data.academicYearTo)) {
      lines.push('• Academic year: ' + formatAcademicYear(data.academicYearFrom, data.academicYearTo));
    }
    if (readDisplayValue(data.status)) {
      lines.push('• Status: ' + readDisplayValue(data.status));
    }
    if (readDisplayValue(data.board)) {
      lines.push('• Board: ' + readDisplayValue(data.board));
    }
    if (lines.length === 1) {
      lines.push('• Institute details are available but did not include summary fields.');
    }
    lines.push('', 'I’ve loaded the institute summary for this account.');
    return lines.join('\n');
  }

  if (instituteContext && instituteContext.status === 'unavailable') {
    const errorMessage = readDisplayValue(instituteContext.message);
    return errorMessage
      ? 'I could not load institute details from the authenticated API (' + errorMessage + ').'
      : 'I could not load institute details from the authenticated API right now.';
  }

  if (allowDemoFallback) {
    return [
      'Institute summary (demo):',
      '• Name: Demo Public School',
      '• Academic year: 2025-26',
      '• Status: Active',
      '• Board: State Board',
      '',
      'Opening Institute management for full details.'
    ].join('\n');
  }

  return 'Institute details are unavailable in context right now.';
}

function buildInstituteSurface(instituteContext: InstituteContextSnapshot | null): InstituteSurface {
  const contextData = instituteContext && instituteContext.status === 'ok' && instituteContext.data
    ? instituteContext.data
    : null;
  const data = contextData || {};
  const id = readDisplayValue(data.id) || 'demo-institute-001';
  const name = readDisplayValue(data.name) || 'Demo Public School';
  return {
    type: 'institute-summary',
    id: 'institute-summary-' + id,
    title: 'Institute overview',
    data: {
      id,
      name,
      address: formatInstituteAddress(data.address) || '123 Campus Drive, Sample City, State, 123456',
      ...(readDisplayValue(data.phone) ? { phone: readDisplayValue(data.phone) } : {}),
      ...(readDisplayValue(data.email) ? { email: readDisplayValue(data.email) } : {}),
      ...(readDisplayValue(data.website) ? { website: readDisplayValue(data.website) } : {}),
      ...(readDisplayValue(data.shortName) ? { shortName: readDisplayValue(data.shortName) } : {}),
      ...(readDisplayValue(data.academicYearFrom) ? { academicYearFrom: readDisplayValue(data.academicYearFrom) } : {}),
      ...(readDisplayValue(data.academicYearTo) ? { academicYearTo: readDisplayValue(data.academicYearTo) } : {}),
      ...(readDisplayValue(data.status) ? { status: readDisplayValue(data.status) } : {}),
      ...(readDisplayValue(data.board) ? { board: readDisplayValue(data.board) } : {})
    }
  };
}

function readFormOptionsContext(payload: HostUserMessage): FormOptionsContext | null {
  const context = payload && payload.context ? payload.context as any : {};
  const formOptions = context && context.formOptions;
  if (!formOptions || typeof formOptions !== 'object' || Array.isArray(formOptions)) {
    return null;
  }
  return formOptions as FormOptionsContext;
}

// BW-T5: the host's deduped, capped course list (same source as student add).
function courseOptionsFromUserMessage(payload: HostUserMessage): FormSelectOption[] {
  const formOptions = readFormOptionsContext(payload);
  return mapSelectOptions(formOptions && formOptions.courses);
}

function mapSelectOptions(raw: unknown): FormSelectOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const options: FormSelectOption[] = [];
  const seenValues: Record<string, boolean> = {};
  const seenLabels: Record<string, boolean> = {};
  for (let i = 0; i < raw.length && options.length < 100; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      continue;
    }
    const valueSource = (item as any).value != null ? (item as any).value : (item as any).id;
    const value = valueSource == null ? '' : String(valueSource).trim();
    const labelSource = (item as any).label != null ? (item as any).label : (item as any).name;
    const label = (labelSource == null ? value : String(labelSource).trim()) || value;
    if (!value || !label) {
      continue;
    }
    // Dedup by value first, then by normalized label (case/whitespace
    // insensitive), keeping the first of each — the same rule the host
    // applies to formOptions.courses, so one list everywhere (thin enrol,
    // workspace, parse child prompt).
    if (seenValues[value]) {
      continue;
    }
    const labelKey = normalizeSelectLabel(label);
    if (labelKey && seenLabels[labelKey]) {
      continue;
    }
    seenValues[value] = true;
    if (labelKey) {
      seenLabels[labelKey] = true;
    }
    options.push({ label: label, value: value });
  }
  return options;
}

function normalizeSelectLabel(label: string): string {
  return String(label || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function studentEnrolOpenMessage(formOptions?: FormOptionsContext | null): string {
  const courses = mapSelectOptions(formOptions && formOptions.courses);
  const text = 'Opening the student enrollment form. Fill in the details in the panel.';
  if (courses.length) {
    return text;
  }
  return text + ' Course options are not available in this session.';
}

function orgAddOpenMessage(formOptions?: FormOptionsContext | null): string {
  const parentOrgs = mapSelectOptions(formOptions && (formOptions.parentOrgs || formOptions.orgs));
  const ownerOrgs = mapSelectOptions(formOptions && (formOptions.ownerOrgs || formOptions.orgs));
  const text = 'Opening the Add Organization form. Fill in the details in the panel.';
  if (parentOrgs.length || ownerOrgs.length) {
    return text;
  }
  return text + ' Parent and owner options are not available in this session.';
}

function buildStudentEnrolFormSurface(formOptions?: FormOptionsContext | null): Record<string, unknown> {
  // Required on src/app/student/add: name, DOB, gender, course.id (Save + HTML required).
  // Optional enrol fields are omitted from this M3 demo schema.
  const courseOptions = mapSelectOptions(formOptions && formOptions.courses);
  return {
    type: 'student-enrol-form',
    id: 'surface_stu_enrol_demo',
    title: 'Enroll Student',
    formId: 'student-enrol-thin',
    submitAction: 'student.enrol.submit',
    correlationId: 'surface_stu_enrol_demo',
    data: {
      name: '',
      dob: '',
      gender: '',
      courseId: ''
    },
    schema: {
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, maxLength: 50, placeholder: 'first  middle  last' },
        { id: 'dob', label: 'Date Of Birth', type: 'date', required: true, placeholder: 'dd/mm/yyyy' },
        {
          id: 'gender',
          label: 'Gender',
          type: 'select',
          required: true,
          placeholder: '',
          options: [
            { label: 'Female', value: 'Female' },
            { label: 'Male', value: 'Male' }
          ]
        },
        {
          id: 'courseId',
          label: 'Course',
          type: 'select',
          required: true,
          placeholder: '-- Select course --',
          options: courseOptions
        }
      ]
    }
  };
}

function buildOrgAddFormSurface(formOptions?: FormOptionsContext | null): Record<string, unknown> {
  // Org Details on src/app/org/add: Name, Short Name, Parent, Owner.
  const parentOrgs = mapSelectOptions(formOptions && (formOptions.parentOrgs || formOptions.orgs));
  const ownerOrgs = mapSelectOptions(formOptions && (formOptions.ownerOrgs || formOptions.orgs));
  const orgOptions = ownerOrgs.length ? ownerOrgs : parentOrgs;
  return {
    type: 'org-add-form',
    id: 'surface_org_add_demo',
    title: 'Add Organization',
    formId: 'org-add-thin',
    submitAction: 'org.add.submit',
    correlationId: 'surface_org_add_demo',
    data: {
      name: '',
      shortName: '',
      parentId: '',
      ownerId: ''
    },
    schema: {
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, maxLength: 50 },
        { id: 'shortName', label: 'Short Name', type: 'text', required: true, maxLength: 6, helperText: 'Up to 6 characters' },
        { id: 'parentId', label: 'Parent', type: 'select', placeholder: 'None', options: parentOrgs },
        { id: 'ownerId', label: 'Owner', type: 'select', placeholder: 'None', options: orgOptions }
      ]
    }
  };
}

function formatInstituteAddress(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const address = value as Record<string, unknown>;
  return [
    address.line1 || address.Line1 || address.line,
    address.line2 || address.Line2,
    address.city || address.City,
    address.state || address.State,
    address.pincode || address.Pincode || address.pinCode || address.PinCode || address.postalCode || address.PostalCode,
    address.country || address.Country
  ].map(readDisplayValue).filter((part: string) => !!part).join(', ');
}

function readDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value).trim();
  return text;
}

function formatAcademicYear(fromValue: unknown, toValue: unknown): string {
  const fromText = readDisplayValue(fromValue);
  const toText = readDisplayValue(toValue);
  if (fromText && toText) {
    return fromText + ' - ' + toText;
  }
  return fromText || toText || 'Unknown';
}

function composeAssistantResponse(
  payload: Omit<HarnessAssistantResponse, 'type' | 'hostProtocolVersion'>
): HarnessAssistantResponse {
  return {
    type: 'assistant_response',
    conversationId: payload.conversationId,
    correlationId: payload.correlationId,
    hostProtocolVersion,
    messages: payload.messages,
    actions: payload.actions,
    surface: payload.surface,
    agent: payload.agent
  };
}

async function sendAssistantResponseForTurn(
  socket: any,
  userId: string,
  userMessage: HostUserMessage,
  payload: Omit<HarnessAssistantResponse, 'type' | 'hostProtocolVersion'>
): Promise<void> {
  const conversationId = sanitizeConversationId(payload.conversationId || userMessage.conversationId);
  const userText = typeof userMessage.text === 'string' ? userMessage.text.trim() : '';
  const messages = filterSuggestionsForTurn(payload.messages);
  const response = composeAssistantResponse({
    conversationId,
    correlationId: payload.correlationId,
    messages,
    actions: payload.actions,
    surface: payload.surface
  });

  logger.info(
    '[mock-harness] assistant response hasSurface=%s surfaceType=%s',
    !!response.surface,
    response.surface && response.surface.type ? response.surface.type : '(none)'
  );

  let persistedUserTurn = false;
  try {
    await upsertConversationForTurn(conversationId, userId, userText);
    await appendUserMessage(conversationId, userId, userText, userMessage.messageId);
    persistedUserTurn = true;
    logger.info('[mock-harness] persisted user turn conversationId=%s user=%s', conversationId, userId);
  } catch (error) {
    logger.error('[mock-harness] failed to persist user turn conversationId=%s user=%s', conversationId, userId);
    logger.debug('[mock-harness] persistence error details=%s', safeStringifyDebug(error));
  }

  if (!persistedUserTurn) {
    logger.error(
      '[mock-harness] skipped assistant persistence because user turn was not persisted conversationId=%s user=%s',
      conversationId,
      userId
    );
    // Keep the live chat usable even when local persistence is unavailable.
    socket.send(JSON.stringify(response));
    return;
  }

  try {
    await appendAssistantMessage(conversationId, userId, toPersistedAssistantPayload(response));
    logger.info('[mock-harness] persisted assistant turn conversationId=%s user=%s', conversationId, userId);
  } catch (error) {
    logger.error('[mock-harness] failed to persist assistant turn conversationId=%s user=%s', conversationId, userId);
    logger.debug('[mock-harness] persistence error details=%s', safeStringifyDebug(error));
  }

  // Send after the write attempt so a subsequent FE history refresh observes
  // the complete turn whenever persistence succeeds.
  socket.send(JSON.stringify(response));
}

function filterSuggestionsForTurn(
  messages: AssistantMessageBlock[]
): AssistantMessageBlock[] {
  return messages.reduce((result: AssistantMessageBlock[], block: AssistantMessageBlock) => {
    if (block.type !== 'suggestions' || !Array.isArray((block as any).items)) {
      result.push(block);
      return result;
    }
    const incoming = (block as any).items;
    const items = dedupeAndCapSuggestions(incoming).filter((item: any) => {
      if (item.action !== 'send_message') {
        return false;
      }
      const text = item.payload && typeof item.payload.text === 'string' ? item.payload.text : '';
      return isAllowlistedSuggestionText(text);
    });
    const dropped = incoming.length - items.length;
    if (dropped > 0) {
      logger.info(
        '[mock-harness] suggestion filter dropped=%s kept=%s',
        dropped,
        items.length
      );
    }
    if (items.length) {
      result.push(Object.assign({}, block, { items }));
    }
    return result;
  }, []);
}

const ALLOWLISTED_SUGGESTION_TEXTS: string[] = [
  'take me to fees',
  'open fees',
  'collect fees',
  'take me to fee transactions',
  'take me home',
  'go home',
  'open home',
  'institute info',
  'tell me about the institute',
  'add student',
  'enrol student',
  'enroll student',
  'add organization',
  'add org',
  'add organisation',
  'send marks cards'
];

function normalizeSuggestionText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isAllowlistedSuggestionText(text: string): boolean {
  const normalized = normalizeSuggestionText(text);
  if (!normalized) {
    return false;
  }
  return ALLOWLISTED_SUGGESTION_TEXTS.some((allowed: string) => {
    return normalizeSuggestionText(allowed) === normalized;
  });
}

function assistantTextRefusesNavigation(messages: AssistantMessageBlock[]): boolean {
  const text = messages
    .map((message: AssistantMessageBlock) => {
      if (message.type === 'text') {
        return String((message as any).text || '');
      }
      if (message.type === 'markdown') {
        return String((message as any).markdown || '');
      }
      return '';
    })
    .join(' ')
    .toLowerCase();
  return /\b(can't|cannot|could not|unable|unsupported|not available|don't know|do not know)\b/.test(text)
    && /\b(open|go to|navigate|route|destination|page|location)\b/.test(text);
}

function sendAssistantResponse(
  socket: any,
  payload: Omit<HarnessAssistantResponse, 'type' | 'hostProtocolVersion'>
): void {
  socket.send(JSON.stringify(composeAssistantResponse(payload)));
}

function sendError(
  socket: any,
  conversationId: string,
  code: HarnessErrorResponse['code'],
  message: string
): void {
  const response: HarnessErrorResponse = {
    type: 'error',
    conversationId,
    code,
    message
  };

  socket.send(JSON.stringify(response));
}

function sanitizeConversationId(value?: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return createConversationId();
}

function createConversationId(): string {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function safeStringifyDebug(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '[unserializable]';
  }
}

function getAllowedRequestHeaders(): string[] {
  // Canonical header names; browser may send lower-cased names in Access-Control-Request-Headers
  return [
    'Content-Type',
    'Accept',
    'AccessCode',
    'AccessToken',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'X-Requested-With',
    'X-Custom-Header'
  ];
}

function buildCorsHeaders(req: any): Record<string, string> {
  const requestOrigin = readHeaderValue(req && req.headers ? req.headers : {}, 'origin');
  const defaultLocalOrigins = ['http://localhost:4200', 'http://127.0.0.1:4200'];
  const allowedOrigins = ALLOWED_CORS_ORIGIN === 'http://localhost:4200'
    ? defaultLocalOrigins
    : [ALLOWED_CORS_ORIGIN];
  // Prefer reflecting the Origin when it matches allowed origins (safe for local dev). Fallback to configured ALLOWED_CORS_ORIGIN.
  const allowOrigin = requestOrigin && allowedOrigins.indexOf(requestOrigin) >= 0
    ? requestOrigin
    : (ALLOWED_CORS_ORIGIN || '*');

  // Determine whether credentials are allowed: only allow credentials when origin is explicit (not '*')
  const allowCredentials = allowOrigin && allowOrigin !== '*';

  const allowHeadersList = getAllowedRequestHeaders();
  const allowHeaders = allowHeadersList.join(', ');

  const headers: Record<string, string> = {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
    'access-control-expose-headers': 'Content-Length, Content-Type',
    'vary': 'Origin'
  };

  if (allowCredentials) {
    headers['access-control-allow-credentials'] = 'true';
  }

  return headers;
}

function writeCors(
  res: any,
  statusCode: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): void {
  res.writeHead(statusCode, Object.assign({}, corsHeaders, extraHeaders));
}

function sendJson(
  res: any,
  statusCode: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): void {
  writeCors(res, statusCode, corsHeaders, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += String(chunk || '');
      if (data.length > 1024 * 1024) {
        reject(new Error('Request body exceeds 1MB limit.'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', (error: Error) => reject(error));
  });
}

httpServer.listen(config.port, config.host, () => {
  logger.info('[mock-harness] ws://%s:%s', config.host, config.port);
  logger.info('[mock-harness] http://%s:%s (REST history)', config.host, config.port);
  logger.info('[mock-harness] protocol=%s capabilities=%s', hostProtocolVersion, hostProtocolCapabilities.join(','));
  logger.info('[mock-harness] mode=%s live.provider=%s live.model=%s', config.mode, config.live.provider, config.live.model || '(missing)');
  logger.info('[mock-harness] persistence.sqlite=%s', HARNESS_DB_PATH);
  if (config.mode === 'live') {
    logger.debug('[mock-harness] live.chatCompletionsUrl=%s', resolveChatCompletionsUrl(config.live.baseUrl));
  }
});
