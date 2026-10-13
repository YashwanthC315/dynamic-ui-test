const DEFAULT_TIMEOUT_MS = 120000;

function makeId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return prefix + '_' + random;
}

function emit(target, name, detail) {
  if (!target || typeof target.dispatchEvent !== 'function') return;
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

function messageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string' && message.text.trim()) return message.text.trim();
  return (Array.isArray(message.blocks) ? message.blocks : [])
    .map((block) => {
      if (block && typeof block.text === 'string') return block.text;
      if (block && typeof block.markdown === 'string') return block.markdown;
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function stripAcpCodeFence(raw) {
  const text = String(raw || '').trim();
  if (text.indexOf('```') !== 0) return text;
  const firstLineEnd = text.indexOf('\n');
  const closingIndex = text.lastIndexOf('```');
  if (closingIndex <= 0) return text;
  return text.slice(firstLineEnd >= 0 ? firstLineEnd + 1 : 3, closingIndex).trim();
}

function mapSuggestion(item, index) {
  const label = String(item && item.label || '').trim();
  if (!label) return null;
  const payload = item && item.payload && typeof item.payload === 'object' ? item.payload : {};
  const action = String(item && item.action || payload.type || 'send_message');
  const text = String(payload.text || item.text || '').trim();
  const href = String(payload.href || item.href || '').trim();
  return {
    id: String(item.id || 'suggestion-' + (index + 1)),
    label,
    action: {
      id: String(item.id || 'suggestion-action-' + (index + 1)),
      label,
      payload: action === 'navigate' || href
        ? { type: 'navigate', href }
        : { type: 'internal.prompt', prompt: text }
    }
  };
}

export function parseAcpHarnessReply(raw, conversationId) {
  const text = stripAcpCodeFence(raw);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (error) { parsed = null; }

  if (!parsed || typeof parsed !== 'object') {
    return { blocks: text ? [{ type: 'text', text }] : [], surface: null, actions: [], agent: null };
  }

  if (Array.isArray(parsed.suggestions)) {
    const suggestions = parsed.suggestions.map(mapSuggestion).filter(Boolean);
    return {
      blocks: suggestions.length ? [{ type: 'suggestions', suggestions }] : [],
      surface: null,
      actions: [],
      agent: parsed.agent || null,
      suggestionOnly: true
    };
  }

  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const blocks = messages.reduce((result, message) => {
    if (!message || typeof message !== 'object') return result;
    if (message.type === 'text' && typeof message.text === 'string') {
      result.push({ type: 'text', text: message.text });
    } else if (message.type === 'markdown' && typeof message.markdown === 'string') {
      result.push({ type: 'markdown', markdown: message.markdown });
    } else if (message.type === 'link') {
      result.push({ type: 'link', label: message.label, href: message.href, route: message.href });
    } else if (message.type === 'suggestions') {
      const items = Array.isArray(message.items) ? message.items : message.suggestions;
      const suggestions = (Array.isArray(items) ? items : []).map(mapSuggestion).filter(Boolean);
      if (suggestions.length) result.push({ type: 'suggestions', suggestions });
    } else if (message.type === 'form') {
      result.push({ type: 'form', title: message.title, fields: message.fields || [] });
    } else if (message.type === 'confirmation') {
      result.push({ type: 'confirmation', text: message.text });
    }
    return result;
  }, []);

  return {
    blocks: blocks.length ? blocks : [{ type: 'text', text: 'The agent returned no displayable message.' }],
    surface: parsed.surface && typeof parsed.surface === 'object' ? parsed.surface : null,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    agent: parsed.agent || null,
    suggestionOnly: false,
    conversationId: parsed.conversationId || conversationId
  };
}

export function buildAcpFileRunPrompt(history, context, prompt) {
  const parts = (Array.isArray(history) ? history : [])
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant') && String(turn.text || '').trim())
    .map((turn) => turn.role + ': ' + String(turn.text).trim());
  if (context && typeof context === 'object' && Object.keys(context).length) {
    parts.push('[host_context] ' + JSON.stringify(context));
  }
  parts.push(String(prompt || ''));
  return parts.join('\n');
}

export function encodeAcpBearerSubprotocol(token) {
  if (!token) return '';
  try {
    return btoa(unescape(encodeURIComponent(String(token))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (error) {
    return '';
  }
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Agent file-run API URL is missing. Pass environment.AGENT_FILE_RUN_API_URL to connectAcpHarness.');
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('Agent file-run API URL must use http:// or https://. AGENT_HARNESS_WS_URL is not the file-run API.');
  }
  return baseUrl;
}

function toSocketUrl(baseUrl) {
  return normalizeBaseUrl(baseUrl)
    .replace(/^https:/i, 'wss:')
    .replace(/^http:/i, 'ws:');
}

function currentRoute() {
  return typeof location !== 'undefined' && location.pathname ? location.pathname : '/';
}

function makeContext(options, extra) {
  const supplied = typeof options.getContext === 'function' ? options.getContext() : (options.context || {});
  const source = supplied && typeof supplied === 'object' ? supplied : {};
  const route = String(source.route || currentRoute() || '/');
  const lowerRoute = route.toLowerCase();
  const moduleFlags = source.moduleFlags || {
    underFees: lowerRoute.indexOf('/fees') === 0,
    underConnect: lowerRoute.indexOf('/connect') === 0,
    underStudent: lowerRoute.indexOf('/student') === 0 || lowerRoute.indexOf('/students') === 0
  };
  return Object.assign({}, source, {
    route,
    moduleFlags,
    flags: Object.assign({}, source.flags || {}, { underFees: Boolean(moduleFlags.underFees) })
  }, extra || {});
}

function plainAssistantText(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => block && (block.type === 'markdown' ? block.markdown : block.text))
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .trim();
}

function safeInternalHref(href) {
  const value = String(href || '').trim();
  return value.charAt(0) === '/' && value.charAt(1) !== '/' && !/^\/\\/.test(value) ? value : '';
}

function formSpecFromSurface(surface) {
  const schema = surface && surface.schema && typeof surface.schema === 'object' ? surface.schema : {};
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  return {
    formId: String(surface.formId || 'agent-form'),
    title: String(surface.title || 'Complete the requested form'),
    description: String(surface.description || ''),
    submitLabel: 'Submit',
    initialValues: surface.data && typeof surface.data === 'object' ? surface.data : {},
    fields: fields.map((field) => ({
      id: String(field.id || ''),
      label: String(field.label || field.id || ''),
      type: ['text', 'number', 'date', 'checkbox', 'select', 'textarea'].indexOf(field.type) >= 0 ? field.type : 'text',
      required: Boolean(field.required),
      placeholder: field.placeholder,
      options: Array.isArray(field.options) ? field.options : [],
      validation: field.maxLength ? { maxLength: field.maxLength } : undefined
    })).filter((field) => field.id)
  };
}

function makeBuddySurfaceSpec(surface) {
  return {
    formId: 'buddy-enrol',
    title: String(surface.title || 'Enroll students'),
    description: String(surface.helpText || ''),
    fields: []
  };
}

function findBuddyElement(options, workspace) {
  return options.buddyWorkspace
    || (workspace && workspace.querySelector && workspace.querySelector('buddy-enrol-workspace-surface'))
    || null;
}

function historyTitle(messages, fallback) {
  const firstUser = messages.find((message) => message && message.role === 'user');
  const title = messageText(firstUser).replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 64) : fallback;
}

/**
 * Connects an <acp-chat-panel> to the same agent-file-run HTTP + event socket
 * protocol used by the CampusTrack host. Credentials and agent paths must be
 * supplied by the integrating application; none are bundled here.
 */
export function connectAcpHarness(options) {
  const settings = options || {};
  const chat = settings.chat;
  if (!chat || typeof chat.addEventListener !== 'function') {
    throw new TypeError('connectAcpHarness requires an acp-chat-panel element.');
  }
  const environment = settings.environment || {};
  const config = Object.assign({
    baseUrl: environment.AGENT_FILE_RUN_API_URL || '',
    bearerToken: environment.AGENT_FILE_RUN_BEARER_TOKEN || '',
    agentPath: environment.AGENT_FILE_RUN_AGENT_PATH || '',
    suggestionsAgentPath: environment.AGENT_SUGGESTIONS_AGENT_PATH || '',
    timeoutMs: DEFAULT_TIMEOUT_MS
  }, settings.config || {});
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const historyById = new Map();
  let conversationId = settings.conversationId || makeId('conv');
  let messages = Array.isArray(chat.messages) ? chat.messages.slice() : [];
  let activeRun = null;
  let buddyElement = null;

  const setMessages = (next) => {
    messages = next;
    chat.messages = messages;
    updateHistory();
  };

  function updateHistory() {
    if (!conversationId) return;
    const previous = historyById.get(conversationId) || {};
    historyById.set(conversationId, {
      id: conversationId,
      title: historyTitle(messages, previous.title || 'New chat'),
      updatedAt: new Date().toISOString(),
      messages: messages.slice()
    });
    chat.chatHistory = Array.from(historyById.values())
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  function appendError(error) {
    const text = error && error.message ? String(error.message) : 'Agent request failed.';
    setMessages(messages.concat({
      id: makeId('error'),
      role: 'error',
      text,
      timestamp: new Date().toISOString(),
      blocks: [{ type: 'error', message: text }]
    }));
  }

  function cancelRun() {
    const run = activeRun;
    if (!run) return;
    activeRun = null;
    run.cancelled = true;
    if (run.controller) run.controller.abort();
    if (run.socket && run.socket.readyState < WebSocket.CLOSING) run.socket.close();
    chat.pending = false;
  }

  async function runAgentFile(prompt, agentPath, run) {
    if (!agentPath) {
      throw new Error('Agent service is not configured. Provide an agentPath to connectAcpHarness.');
    }
    const tokenRequest = typeof config.getBearerToken === 'function'
      ? config.getBearerToken()
      : config.bearerToken;
    const tokenValue = await Promise.resolve(tokenRequest);
    const bearerToken = String(tokenValue || '').trim();
    if (!bearerToken) throw new Error('Agent service is not configured. Provide a bearerToken or getBearerToken to connectAcpHarness.');
    const requestUrl = baseUrl + '/api/playground/agent-file-runs';
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearerToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_path: agentPath, user_prompt: prompt }),
      signal: run.controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body && (body.message || body.error) ? body.message || body.error : 'HTTP ' + response.status;
      throw new Error('Agent request failed: ' + String(message));
    }
    const runId = body && body.run_id ? String(body.run_id).trim() : '';
    if (!runId) throw new Error('Agent service returned no run_id.');
    return watchAgentRun(runId, run, bearerToken);
  }

  function watchAgentRun(runId, run, bearerToken) {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('This browser does not support WebSocket agent replies.'));
        return;
      }
      const url = toSocketUrl(baseUrl) + '/api/playground/runs/' + encodeURIComponent(runId) + '/events/ws';
      const protocols = ['aetheris.events.v1'];
      const encodedToken = encodeAcpBearerSubprotocol(bearerToken);
      if (encodedToken) protocols.push('aetheris.bearer.' + encodedToken);

      let latestReply = '';
      let settled = false;
      let socket;
      const timeout = setTimeout(() => finish(new Error('Agent service timed out waiting for a reply.')), Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS);

      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (run.socket === socket) run.socket = null;
        if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
        if (error) reject(error);
        else if (latestReply) resolve(latestReply);
        else reject(new Error('Agent run ended without a text response.'));
      }

      try {
        socket = new WebSocket(url, protocols);
        run.socket = socket;
      } catch (error) {
        finish(error);
        return;
      }

      socket.onmessage = (event) => {
        let frame;
        try { frame = JSON.parse(String(event.data || '')); } catch (error) { return; }
        if (frame && frame.kind === 'control' && frame.control === 'stream_end') {
          finish();
          return;
        }
        const item = frame && frame.kind === 'event' && frame.event ? frame.event : null;
        if (!item || item.event_type !== 'llm_responded') return;
        let payload = item.payload;
        try { if (typeof payload === 'string') payload = JSON.parse(payload); } catch (error) { return; }
        if (payload && payload.response_type === 'text' && payload.raw_response != null) {
          latestReply = String(payload.raw_response);
        }
      };
      socket.onerror = () => finish(new Error('Agent reply WebSocket failed for run ' + runId + '.'));
      socket.onclose = () => finish();
      if (run.cancelled) finish(new Error('Agent request was cancelled.'));
    });
  }

  function applySurface(surface) {
    if (!surface || typeof surface !== 'object') return;
    const workspace = settings.workspace || null;
      const actions = settings.actions || null;
      if (surface.type === 'activity-log') {
        if (actions) {
          actions.title = String(surface.title || 'Assembler');
          actions.items = Array.isArray(surface.items) ? surface.items : [];
          if (Array.isArray(surface.menuActions)) actions.menuActions = surface.menuActions;
          actions.open = true;
        }
      } else if (surface.type === 'buddy-enrol-workspace') {
      if (workspace) {
          workspace.surface = null;
        workspace.formSpec = makeBuddySurfaceSpec(surface);
        workspace.open = true;
      }
      buddyElement = findBuddyElement(settings, workspace);
      if (buddyElement) buddyElement.surface = surface;
    } else if (workspace && (surface.type === 'student-enrol-form' || surface.type === 'org-add-form')) {
        workspace.surface = null;
      workspace.formSpec = formSpecFromSurface(surface);
      workspace.open = true;
      } else if (workspace && typeof surface === 'object') {
        workspace.formSpec = null;
        workspace.surface = surface;
        workspace.open = true;
    }
    if (typeof settings.onSurface === 'function') settings.onSurface(surface);
    bindBuddyEvents();
  }

  function dispatchNavigation(href) {
    const safeHref = safeInternalHref(href);
    if (!safeHref) return;
    if (typeof settings.onNavigate === 'function') settings.onNavigate(safeHref);
    else emit(chat, 'acp-navigate', { href: safeHref });
  }

  function applyActions(actions) {
    (Array.isArray(actions) ? actions : []).forEach((action) => {
      if (action && action.type === 'navigate') dispatchNavigation(action.route);
    });
  }

  async function requestPrompt(prompt, runOptions) {
    const requestOptions = runOptions || {};
    const text = String(prompt || '').trim();
    if (!text || activeRun) return;
    const run = { controller: new AbortController(), socket: null, cancelled: false };
    activeRun = run;
    chat.pending = true;

    if (requestOptions.appendUser !== false) {
      setMessages(messages.concat({
        id: makeId('user'),
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
        blocks: [{ type: 'text', text }]
      }));
    }

    try {
      const context = makeContext(settings, requestOptions.context);
      const history = messages
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .map((message) => ({ role: message.role, text: messageText(message) }))
        .filter((turn) => turn.text);
      const priorHistory = requestOptions.appendUser === false ? history : history.slice(0, -1);
      const userPrompt = requestOptions.rawPrompt
        ? text
        : buildAcpFileRunPrompt(priorHistory, context, text);
      const rawResponse = await runAgentFile(userPrompt, requestOptions.agentPath || config.agentPath, run);
      if (activeRun !== run || run.cancelled) return;

      const response = parseAcpHarnessReply(rawResponse, conversationId);
      const agentName = response.agent && (response.agent.displayName || response.agent.name || response.agent.id);
      if (requestOptions.appendReply !== false) {
        setMessages(messages.concat({
          id: makeId('assistant'),
          role: 'assistant',
          text: plainAssistantText(response.blocks),
          blocks: response.blocks,
          timestamp: new Date().toISOString(),
          agent: agentName ? { name: String(agentName) } : null
        }));
      }
      applySurface(response.surface);
      applyActions(response.actions);

      if (config.suggestionsAgentPath && requestOptions.purpose !== 'suggestions'
        && requestOptions.appendReply !== false && !response.suggestionOnly && response.blocks.length) {
        const suggestionText = JSON.stringify({
          userText: text,
          lastAssistantText: plainAssistantText(response.blocks),
          recentHistory: priorHistory.slice(-2),
          route: context.route,
          ...(response.surface ? { surfaceType: response.surface.type, surfaceTitle: response.surface.title } : {})
        });
        const rawSuggestions = await runAgentFile(suggestionText, config.suggestionsAgentPath, run).catch(() => '');
        if (rawSuggestions && activeRun === run && !run.cancelled) {
          const suggestionResponse = parseAcpHarnessReply(rawSuggestions, conversationId);
          const suggestionBlock = suggestionResponse.blocks.find((block) => block.type === 'suggestions');
          const lastAssistant = messages.slice().reverse().find((message) => message.role === 'assistant');
          if (suggestionBlock && lastAssistant) {
            const updated = Object.assign({}, lastAssistant, { blocks: (lastAssistant.blocks || []).concat(suggestionBlock) });
            setMessages(messages.map((message) => message.id === lastAssistant.id ? updated : message));
          }
        }
      }
    } catch (error) {
      if (activeRun === run && !run.cancelled && !requestOptions.silentErrors) appendError(error);
    } finally {
      if (activeRun === run) {
        activeRun = null;
        chat.pending = false;
        if (buddyElement) {
          if (typeof buddyElement.setRequestState === 'function') {
            buddyElement.setRequestState({ parseInFlight: false, checkInFlight: false });
          } else {
            buddyElement.parseInFlight = false;
            buddyElement.checkInFlight = false;
          }
        }
      }
    }
  }

  function handleMessage(event) {
    requestPrompt(typeof event.detail === 'string' ? event.detail : event.detail && event.detail.text);
  }

  function handleSuggestion(event) {
    const detail = event.detail || {};
    const suggestion = detail.suggestion || detail.item || detail;
    const action = suggestion && suggestion.action;
    const payload = action && action.payload ? action.payload : (suggestion && suggestion.payload) || {};
    if (payload.type === 'navigate' || payload.href) dispatchNavigation(payload.href || payload.route);
    else if (payload.prompt || payload.text) requestPrompt(payload.prompt || payload.text);
  }

  function handleNewChat() {
    cancelRun();
    if (messages.length) updateHistory();
    conversationId = makeId('conv');
    messages = [];
    chat.messages = messages;
    if (settings.workspace) settings.workspace.close();
    updateHistory();
  }

  function handleRestore(event) {
    const id = String(event.detail && event.detail.conversationId || '');
    const saved = historyById.get(id);
    if (!saved) return;
    cancelRun();
    updateHistory();
    conversationId = id;
    messages = saved.messages.slice();
    chat.messages = messages;
    updateHistory();
  }

  function handleFormRequested(event) {
    if (!settings.workspace || !event.detail || !event.detail.formSpec) return;
    settings.workspace.formSpec = event.detail.formSpec;
    settings.workspace.open = true;
  }

  function handleBuddyParse(event) {
    const detail = event.detail || {};
    const surface = buddyElement && buddyElement.surface;
    const text = String(detail.text || (buddyElement && buddyElement.buddyText) || '');
    requestPrompt('[event: buddy_parse]' + (text ? '\n' + text : ''), {
      appendUser: false,
      context: { surface },
      appendReply: false
    });
  }

  function handleBuddyCheck() {
    const surface = buddyElement && buddyElement.surface;
    if (!surface) return;
    const fields = Array.isArray(surface.fields) ? surface.fields : [];
    const records = Array.isArray(buddyElement.records) ? buddyElement.records.map((record) => ({
      id: record.id,
      values: {
        name: record.name,
        dob: record.dob,
        gender: record.gender,
        courseId: record.course
      },
      valid: record.valid
    })) : [];
    const prompt = [
      'Validate these workspace records for the Check.',
      '[workspace fields] ' + JSON.stringify(fields),
      '[workspace records] ' + JSON.stringify(records),
      '[active record id] ' + String(buddyElement.activeRecordId || '')
    ].join('\n');
    requestPrompt(prompt, {
      appendUser: false,
      context: { surface: Object.assign({}, surface, { records }) },
      appendReply: false
    });
  }

  function bindBuddyEvents() {
    const next = findBuddyElement(settings, settings.workspace || null);
    if (buddyElement && buddyElement !== next) {
      buddyElement.removeEventListener('buddy-parse', handleBuddyParse);
      buddyElement.removeEventListener('buddy-check', handleBuddyCheck);
    }
    buddyElement = next;
    if (buddyElement) {
      buddyElement.removeEventListener('buddy-parse', handleBuddyParse);
      buddyElement.removeEventListener('buddy-check', handleBuddyCheck);
      buddyElement.addEventListener('buddy-parse', handleBuddyParse);
      buddyElement.addEventListener('buddy-check', handleBuddyCheck);
    }
  }

  chat.addEventListener('acp-message-sent', handleMessage);
  chat.addEventListener('acp-suggestion-click', handleSuggestion);
  chat.addEventListener('acp-cancel-request', cancelRun);
  chat.addEventListener('acp-new-chat', handleNewChat);
  chat.addEventListener('acp-restore-conversation', handleRestore);
  chat.addEventListener('acp-form-requested', handleFormRequested);
  bindBuddyEvents();
  updateHistory();

  return {
    get conversationId() { return conversationId; },
    sendMessage: requestPrompt,
    cancel: cancelRun,
    disconnect() {
      cancelRun();
      chat.removeEventListener('acp-message-sent', handleMessage);
      chat.removeEventListener('acp-suggestion-click', handleSuggestion);
      chat.removeEventListener('acp-cancel-request', cancelRun);
      chat.removeEventListener('acp-new-chat', handleNewChat);
      chat.removeEventListener('acp-restore-conversation', handleRestore);
      chat.removeEventListener('acp-form-requested', handleFormRequested);
      if (buddyElement) {
        buddyElement.removeEventListener('buddy-parse', handleBuddyParse);
        buddyElement.removeEventListener('buddy-check', handleBuddyCheck);
      }
    }
  };
}