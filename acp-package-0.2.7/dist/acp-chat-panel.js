/**
 * @acp/chat-panel v0.2.7
 * Universal AI Chat Panel, Dynamic Container, Buddy Workspace & Actions Pane
 * Web Components (Custom Elements) distribution for any framework / Angular version (4–19+).
 */

(function () {
  'use strict';

  const DEFAULTS = {
    title: 'AI Agent',
    placeholder: 'How can I help you today?',
    maxLength: 2000,
    width: 380,
    minWidth: 280,
    maxWidth: 900,
  };

  const CONTAINER_DEFAULTS = {
    title: 'Dynamic Form',
    formWidth: 540,
    minFormWidth: 320,
    maxFormWidth: 960,
    minFormHeight: 240,
  };

  const ACTIONS_DEFAULTS = {
    title: 'Assembler',
    width: 280,
    minWidth: 220,
    maxWidth: 720,
    minHeight: 240,
  };

  const PANE_RESIZE_CURSORS = { horizontal: 'ew-resize', vertical: 'ns-resize', both: 'nwse-resize' };

  function paneResizeHandlesHtml(label) {
    return `
      <div class="acp-pane-edge-resize acp-pane-edge-resize--bottom" data-pane-resize="vertical" role="separator" aria-orientation="horizontal" aria-label="Resize ${label} height" tabindex="0"></div>
      <div class="acp-pane-edge-resize acp-pane-edge-resize--corner" data-pane-resize="both" role="separator" aria-label="Resize ${label} width and height"></div>
    `;
  }

  // Drags a pane edge; setWidth/setHeight receive the unclamped target size.
  function startPaneResize(e, axis, host, startWidth, setWidth, setHeight) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startHeight = host.getBoundingClientRect().height;
    document.body.style.cursor = PANE_RESIZE_CURSORS[axis] || '';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      if (axis !== 'vertical') setWidth(startWidth + (ev.clientX - startX));
      if (axis !== 'horizontal') setHeight(startHeight + (ev.clientY - startY));
    };
    const up = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function clampPaneHeight(host, val, min) {
    const maxHeight = Math.max(min, Math.round(window.innerHeight - host.getBoundingClientRect().top - 8));
    return Math.round(Math.min(maxHeight, Math.max(min, Number(val) || min)));
  }

  function availablePaneWidth(element, siblingSelector, minWidth) {
    const stage = element.closest('.acp-workspace__stage');
    const left = element.getBoundingClientRect().left;
    const stageWidth = stage ? stage.clientWidth : Math.max(0, window.innerWidth - left);
    const sibling = stage && stage.querySelector(siblingSelector);
    const siblingWidth = sibling && getComputedStyle(sibling).display !== 'none'
      ? sibling.getBoundingClientRect().width
      : 0;
    return Math.max(minWidth, Math.floor(stageWidth - siblingWidth));
  }

  const FIELD_TYPES = new Set(['text', 'number', 'date', 'checkbox', 'select', 'textarea']);

  function toKebabCase(val) {
    return String(val || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function toTitleCase(val) {
    return String(val || '')
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(val) {
    return String(val != null ? val : '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeFieldSpec(field, index) {
    if (!field || typeof field !== 'object') return null;
    const type = FIELD_TYPES.has(field.type) ? field.type : 'text';
    const id = toKebabCase(field.id || field.label || `field-${index + 1}`) || `field-${index + 1}`;
    const label = String(field.label || toTitleCase(id) || `Field ${index + 1}`);
    return {
      id,
      label,
      type,
      required: Boolean(field.required),
      disabled: Boolean(field.disabled),
      placeholder: field.placeholder != null ? String(field.placeholder) : undefined,
      optionsSource: field.optionsSource != null ? String(field.optionsSource) : undefined,
      validation:
        field.validation && typeof field.validation === 'object'
          ? {
              min: field.validation.min != null ? Number(field.validation.min) : undefined,
              max: field.validation.max != null ? Number(field.validation.max) : undefined,
              maxLength: field.validation.maxLength != null ? Number(field.validation.maxLength) : undefined,
            }
          : undefined,
      options: Array.isArray(field.options)
        ? field.options
            .map((opt) => {
              if (opt && typeof opt === 'object') {
                return {
                  label: String(opt.label != null ? opt.label : opt.value != null ? opt.value : ''),
                  value: String(opt.value != null ? opt.value : opt.label != null ? opt.label : ''),
                };
              }
              return { label: String(opt), value: String(opt) };
            })
            .filter((opt) => opt.value)
        : [],
    };
  }

  function normalizeFormSpec(spec) {
    if (!spec || typeof spec !== 'object') return null;
    const formId = toKebabCase(spec.formId || spec.title || 'dynamic-form') || 'dynamic-form';
    const fields = Array.isArray(spec.fields)
      ? spec.fields.map((f, idx) => normalizeFieldSpec(f, idx)).filter(Boolean)
      : [];
    if (!fields.length && formId !== 'buddy-enrol') return null;
    return {
      formId,
      title: String(spec.title || toTitleCase(formId) || 'Dynamic Form'),
      description: spec.description != null ? String(spec.description) : undefined,
      submitLabel: spec.submitLabel != null ? String(spec.submitLabel) : 'Submit',
      cancelLabel: spec.cancelLabel != null ? String(spec.cancelLabel) : 'Close',
      initialValues: spec.initialValues && typeof spec.initialValues === 'object' ? spec.initialValues : {},
      fields,
    };
  }

  function buildStudentEnrollSpec() {
    return {
      formId: 'student-enroll',
      title: 'Student Enrollment Form',
      description: 'Capture student enrollment records with required academic fields and contact details.',
      submitLabel: 'Submit',
      cancelLabel: 'Close',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Student full name', validation: { maxLength: 100 } },
        { id: 'dob', label: 'Date Of Birth', type: 'date', required: true, placeholder: 'YYYY-MM-DD' },
        {
          id: 'gender',
          label: 'Gender',
          type: 'select',
          required: true,
          options: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          id: 'course',
          label: 'Course',
          type: 'select',
          required: true,
          options: [
            { label: 'Science', value: 'science' },
            { label: 'Commerce', value: 'commerce' },
            { label: 'Arts', value: 'arts' },
          ],
        },
        { id: 'email', label: 'Email', type: 'text', placeholder: 'student@example.com', validation: { maxLength: 120 } },
        { id: 'mobile', label: 'Mobile', type: 'text', placeholder: '10-digit mobile number', validation: { maxLength: 15 } },
        { id: 'fatherName', label: 'Father Name', type: 'text', placeholder: 'Father full name', validation: { maxLength: 100 } },
      ],
    };
  }

  function parseFormTrigger(messageText, prefix) {
    const text = String(messageText || '').trim();
    if (!text) return null;
    const normalizedPrefix = String(prefix || '/form').trim().toLowerCase();
    const candidatePrefixes = [normalizedPrefix, '/forms', '/form']
      .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
      .sort((a, b) => b.length - a.length);

    let matchedPrefix = null;
    for (const cand of candidatePrefixes) {
      if (text.toLowerCase().startsWith(cand)) {
        matchedPrefix = cand;
        break;
      }
    }
    if (!matchedPrefix) return null;

    const payload = text.slice(matchedPrefix.length).replace(/^\s*:\s*/, '').trim();
    if (!payload) return null;

    if (payload.startsWith('{')) {
      try {
        const parsed = JSON.parse(payload);
        return normalizeFormSpec(parsed);
      } catch (e) {
        return null;
      }
    }

    const norm = payload.toLowerCase().replace(/\s+/g, ' ');
    if (norm.includes('enroll') || norm.includes('enrol') || norm.includes('student')) {
      return normalizeFormSpec(buildStudentEnrollSpec());
    }

    const formId = toKebabCase(payload || 'dynamic-form') || 'dynamic-form';
    return normalizeFormSpec({
      formId,
      title: toTitleCase(payload || 'Dynamic Form'),
      submitLabel: 'Submit',
      cancelLabel: 'Close',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter name' },
        { id: 'details', label: 'Details', type: 'textarea', placeholder: 'Add details' },
      ],
    });
  }

  /* ==========================================================================
     Custom Element 1: AcpChatPanel (<acp-chat-panel>)
     ========================================================================== */
  class AcpChatPanel extends HTMLElement {
    static get observedAttributes() {
      return [
        'open',
        'title',
        'placeholder',
        'max-length',
        'width',
        'min-width',
        'max-width',
        'dock',
        'form-trigger-prefix',
        'agent-display',
        'pending'
      ];
    }

    constructor() {
      super();
      this._messages = [];
      this._chatHistory = [];
      this._draft = '';
      this._resizing = false;
      this._rendered = false;
      this._isSearchOpen = false;
      this._searchTerm = '';
      this._isHistoryOpen = false;
    }

    connectedCallback() {
      this._rendered = true;
      this._render();
    }

    attributeChangedCallback() {
      if (this._rendered) this._render();
    }

    get open() { return this.hasAttribute('open'); }
    set open(val) { val ? this.setAttribute('open', '') : this.removeAttribute('open'); }

    get title() { return this.getAttribute('title') || DEFAULTS.title; }
    set title(val) { this.setAttribute('title', val); }

    get agentDisplay() { return this.getAttribute('agent-display') || ''; }
    set agentDisplay(val) { this.setAttribute('agent-display', String(val || '')); }

    get pending() { return this.hasAttribute('pending'); }
    set pending(val) { val ? this.setAttribute('pending', '') : this.removeAttribute('pending'); }

    get placeholder() { return this.getAttribute('placeholder') || DEFAULTS.placeholder; }
    set placeholder(val) { this.setAttribute('placeholder', val); }

    get maxLength() { return Number(this.getAttribute('max-length') || DEFAULTS.maxLength); }
    set maxLength(val) { this.setAttribute('max-length', String(val)); }

    get width() { return Number(this.getAttribute('width') || DEFAULTS.width); }
    set width(val) { this.setAttribute('width', String(val)); }

    get minWidth() { return Number(this.getAttribute('min-width') || DEFAULTS.minWidth); }
    set minWidth(val) { this.setAttribute('min-width', String(val)); }

    get maxWidth() { return Number(this.getAttribute('max-width') || DEFAULTS.maxWidth); }
    set maxWidth(val) { this.setAttribute('max-width', String(val)); }

    get dock() { return this.getAttribute('dock') === 'right' ? 'right' : 'left'; }
    set dock(val) { this.setAttribute('dock', val === 'right' ? 'right' : 'left'); }

    get formTriggerPrefix() { return this.getAttribute('form-trigger-prefix') || '/form'; }
    set formTriggerPrefix(val) { this.setAttribute('form-trigger-prefix', String(val || '/form')); }

    get messages() { return this._messages; }
    set messages(val) {
      this._messages = Array.isArray(val) ? val : [];
      if (this._rendered) this._updateMessagesList();
    }

    get chatHistory() { return this._chatHistory; }
    set chatHistory(val) {
      this._chatHistory = Array.isArray(val) ? val : [];
      if (this._rendered && this._isHistoryOpen) this._renderHistoryList();
    }

    get filteredMessages() {
      const term = this._searchTerm.trim().toLowerCase();
      if (!term) return this._messages;
      return this._messages.filter((m) => {
        let textToSearch = m.text || '';
        if (Array.isArray(m.blocks)) {
          textToSearch += ' ' + m.blocks.map((b) => [b.text, b.markdown, b.message, b.label, b.details].filter(Boolean).join(' ')).join(' ');
        }
        return textToSearch.toLowerCase().includes(term);
      });
    }

    startNewChat() {
      this._draft = '';
      this._searchTerm = '';
      this._isSearchOpen = false;
      this._isHistoryOpen = false;
      this.dispatchEvent(new CustomEvent('acp-new-chat', { bubbles: true, composed: true }));
      this._render();
    }

    toggleSearch() {
      this._isSearchOpen = !this._isSearchOpen;
      if (!this._isSearchOpen) this._searchTerm = '';
      this._isHistoryOpen = false;
      this._render();
      if (this._isSearchOpen) {
        const inp = this.querySelector('.acp-search-input');
        if (inp) inp.focus();
      }
      this.dispatchEvent(new CustomEvent('acp-search-toggle', {
        detail: { open: this._isSearchOpen, term: this._searchTerm },
        bubbles: true,
        composed: true
      }));
    }

    clearSearch() {
      this._searchTerm = '';
      this._updateMessagesList();
      const inp = this.querySelector('.acp-search-input');
      if (inp) inp.value = '';
      const countEl = this.querySelector('.acp-search-count');
      if (countEl) countEl.textContent = '';
    }

    toggleHistory() {
      this._isHistoryOpen = !this._isHistoryOpen;
      if (this._isHistoryOpen) {
        this._isSearchOpen = false;
        this._searchTerm = '';
      }
      this._render();
      this.dispatchEvent(new CustomEvent('acp-history-toggle', {
        detail: { open: this._isHistoryOpen },
        bubbles: true,
        composed: true
      }));
    }

    sendMessage(text) {
      if (!text || typeof text !== 'string') return;
      this._draft = text;
      this._send();
    }

    _render() {
      const curWidth = this.open ? this._clamp(this.width) : 0;
      this.style.display = this.open ? 'flex' : 'none';
      this.style.flexDirection = 'column';
      this.style.height = '100%';
      this.style.minHeight = '0';
      this.style.minWidth = '0';
      this.style.flex = '0 0 auto';
      this.style.alignSelf = 'stretch';
      this.style.boxSizing = 'border-box';
      this.style.width = `${curWidth}px`;
      this.style.flexBasis = `${curWidth}px`;

      const agentTagHtml = this.agentDisplay
        ? `<span class="acp-header__agent-tag">— ${escapeHtml(this.agentDisplay)}</span>`
        : '';

      const searchBarHtml = this._isSearchOpen ? `
        <div class="acp-search-wrap">
          <input type="search" class="acp-search-input" placeholder="Search this conversation" value="${escapeHtml(this._searchTerm)}" aria-label="Search conversation" />
          ${this._searchTerm ? `<button type="button" class="acp-search-clear" data-action="search-clear" title="Clear search">×</button>` : ''}
          <span class="acp-search-count">${this._searchTerm ? `${this.filteredMessages.length} result${this.filteredMessages.length === 1 ? '' : 's'}` : ''}</span>
        </div>
      ` : '';

      const historyFlyoutHtml = this._isHistoryOpen ? `
        <div class="acp-history-flyout">
          <div class="acp-history-head">
            <span>Recent chats</span>
            <button type="button" class="acp-icon-button" data-action="history-close" title="Close history" aria-label="Close history">×</button>
          </div>
          <div class="acp-history-content"></div>
        </div>
      ` : '';

      const pendingPillHtml = this.pending ? `
        <span class="acp-thinking-pill">Thinking...</span>
      ` : '';

      const cancelToolbarHtml = this.pending ? `
        <div class="acp-cancel-toolbar">
          <button type="button" class="acp-cancel-btn" data-action="cancel-request">Cancel</button>
        </div>
      ` : '';

      this.innerHTML = `
        <section class="acp-panel" aria-label="AI Agent chat panel">
          <header class="acp-header">
            <div class="acp-header__top">
              <div class="acp-header__title-block">
                <h3 class="acp-header__title">${escapeHtml(this.title)}</h3>
                ${agentTagHtml}
                ${pendingPillHtml}
              </div>
              <div class="acp-header__actions">
                <button class="acp-icon-button" data-action="new" type="button" title="New chat" aria-label="New chat">+</button>
                <button class="acp-icon-button ${this._isSearchOpen ? 'active' : ''}" data-action="search" type="button" title="Search chats" aria-label="Search chats">🔍</button>
                <button class="acp-icon-button ${this._isHistoryOpen ? 'active' : ''}" data-action="history" type="button" title="Chat history" aria-label="Chat history">🕒</button>
                <button class="acp-icon-button" data-action="help" type="button" title="Help" aria-label="Open help">?</button>
                <button class="acp-icon-button" data-action="close" type="button" title="Close chat" aria-label="Close chat">×</button>
              </div>
            </div>
            ${searchBarHtml}
            ${historyFlyoutHtml}
          </header>
          <div class="acp-messages" data-role="messages-container"></div>
          <footer class="acp-composer">
            ${cancelToolbarHtml}
            <textarea class="acp-input" rows="2" maxlength="${this.maxLength}" placeholder="${escapeHtml(this.placeholder)}" aria-label="Chat message">${escapeHtml(this._draft)}</textarea>
            <div class="acp-composer__bottom">
              <span class="acp-counter">${this._draft.length}/${this.maxLength}</span>
              <button class="acp-send" data-action="send" type="button" ${this._draft.trim() ? '' : 'disabled'}>Send</button>
            </div>
          </footer>
          <div class="acp-resize-handle" data-action="resize" role="separator" aria-orientation="vertical" aria-label="Resize chat panel" tabindex="0"></div>
        </section>
      `;

      this._updateMessagesList();
      if (this._isHistoryOpen) this._renderHistoryList();

      this._bindHeaderEvents();
      this._bindComposerEvents();
      this._bindResizeEvents();
    }

    _bindHeaderEvents() {
      const newBtn = this.querySelector('[data-action="new"]');
      if (newBtn) newBtn.addEventListener('click', () => this.startNewChat());

      const searchBtn = this.querySelector('[data-action="search"]');
      if (searchBtn) searchBtn.addEventListener('click', () => this.toggleSearch());

      const historyBtn = this.querySelector('[data-action="history"]');
      if (historyBtn) historyBtn.addEventListener('click', () => this.toggleHistory());

      const historyCloseBtn = this.querySelector('[data-action="history-close"]');
      if (historyCloseBtn) historyCloseBtn.addEventListener('click', () => this.toggleHistory());

      const helpBtn = this.querySelector('[data-action="help"]');
      if (helpBtn) {
        helpBtn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('acp-help', { bubbles: true, composed: true }));
        });
      }

      const closeBtn = this.querySelector('[data-action="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.open = false;
          this.dispatchEvent(new CustomEvent('acp-open-change', { detail: false, bubbles: true, composed: true }));
        });
      }

      const searchInput = this.querySelector('.acp-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this._searchTerm = e.target.value;
          this._updateMessagesList();
          const countEl = this.querySelector('.acp-search-count');
          if (countEl) {
            countEl.textContent = this._searchTerm.trim()
              ? `${this.filteredMessages.length} result${this.filteredMessages.length === 1 ? '' : 's'}`
              : '';
          }
        });
      }

      const searchClear = this.querySelector('[data-action="search-clear"]');
      if (searchClear) searchClear.addEventListener('click', () => this.clearSearch());
    }

    _renderHistoryList() {
      const container = this.querySelector('.acp-history-content');
      if (!container) return;
      if (!this._chatHistory.length) {
        container.innerHTML = `<p class="acp-history-empty">No saved chats yet.</p>`;
        return;
      }
      container.innerHTML = `
        <ul class="acp-history-list">
          ${this._chatHistory.map((item) => `
            <li>
              <button type="button" class="acp-history-item" data-history-id="${escapeHtml(item.id)}">
                <span class="acp-history-title">${escapeHtml(item.title || 'Untitled chat')}</span>
                <span class="acp-history-date">${escapeHtml(String(item.updatedAt || ''))}</span>
              </button>
            </li>
          `).join('')}
        </ul>
      `;
      container.querySelectorAll('[data-history-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-history-id');
          const item = this._chatHistory.find((c) => String(c.id) === String(id));
          this._isHistoryOpen = false;
          this._render();
          this.dispatchEvent(new CustomEvent('acp-restore-conversation', {
            detail: { conversationId: id, item },
            bubbles: true,
            composed: true,
          }));
        });
      });
    }

    _bindComposerEvents() {
      const input = this.querySelector('.acp-input');
      const counter = this.querySelector('.acp-counter');
      const sendButton = this.querySelector('[data-action="send"]');
      const cancelBtn = this.querySelector('[data-action="cancel-request"]');

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('acp-cancel-request', { bubbles: true, composed: true }));
        });
      }

      if (input) {
        input.addEventListener('input', () => {
          this._draft = input.value;
          if (counter) counter.textContent = `${this._draft.length}/${this.maxLength}`;
          if (sendButton) sendButton.disabled = !this._draft.trim();
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._send();
          }
        });
      }

      if (sendButton) {
        sendButton.addEventListener('click', () => this._send());
      }
    }

    _bindResizeEvents() {
      const handle = this.querySelector('[data-action="resize"]');
      if (!handle) return;
      handle.addEventListener('pointerdown', (e) => this._startResize(e));
      handle.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this._setWidth(this.width - 24);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this._setWidth(this.width + 24);
        }
      });
    }

    _updateMessagesList() {
      const container = this.querySelector('[data-role="messages-container"]');
      if (!container) return;
      const list = this.filteredMessages;
      if (!list.length) {
        container.innerHTML = `<div class="acp-empty-state">I'm ready to help. Tell me what you need, and I'll take it from here.</div>`;
        return;
      }
      container.innerHTML = list.map((m, mIdx) => this._messageHtml(m, mIdx)).join('');
      this._bindMessageActions(container);
      container.scrollTop = container.scrollHeight;
    }

    _messageHtml(m, mIdx) {
      const role = m && m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'assistant';
      const timeStr = m && m.timestamp ? `<time class="acp-message__time">${escapeHtml(String(m.timestamp))}</time>` : '';
      const agentTag = m && m.agent && (m.agent.name || m.agent.id)
        ? `<span class="acp-message__agent" style="color:var(--acp-status-info);font-size:11px;">${escapeHtml(m.agent.name || m.agent.id)}</span>`
        : '';

      let bodyContent = '';
      if (Array.isArray(m.blocks) && m.blocks.length) {
        bodyContent = m.blocks.map((block, bIdx) => this._blockHtml(block, mIdx, bIdx)).join('');
      } else {
        bodyContent = `<p class="acp-text">${escapeHtml(String(m.text || ''))}</p>`;
      }

      return `
        <article class="acp-message acp-message--${role}">
          <div class="acp-message__bubble">
            ${bodyContent}
          </div>
          <div class="acp-message__meta">
            ${timeStr}
            ${agentTag}
          </div>
        </article>
      `;
    }

    _blockHtml(block, mIdx, bIdx) {
      if (!block || typeof block !== 'object') return '';
      switch (block.type) {
        case 'text':
          return `<p class="acp-text">${escapeHtml(block.text || '')}</p>`;
        case 'markdown':
          return `<pre class="acp-markdown">${escapeHtml(block.markdown || block.text || '')}</pre>`;
        case 'status':
          return `<div class="acp-status ${block.level === 'loading' ? 'acp-status--loading' : ''}">${escapeHtml(block.text || '')}</div>`;
        case 'data': {
          const items = Array.isArray(block.items) ? block.items : [];
          return `
            <dl class="acp-data">
              ${items.map((it) => `<div class="acp-data-row"><dt>${escapeHtml(it.key)}</dt><dd>${escapeHtml(String(it.value))}</dd></div>`).join('')}
            </dl>
          `;
        }
        case 'suggestions': {
          const chips = Array.isArray(block.suggestions || block.items) ? (block.suggestions || block.items) : [];
          return `
            <div class="acp-suggestions">
              ${chips.map((s, cIdx) => `
                <button type="button" class="acp-suggestion-chip" data-msg-idx="${mIdx}" data-block-idx="${bIdx}" data-chip-idx="${cIdx}">
                  <i class="acp-suggestion-icon">→</i>
                  ${escapeHtml(s.label || s.text || '')}
                </button>
              `).join('')}
            </div>
          `;
        }
        case 'link':
          return `
            <button type="button" class="acp-link-btn" data-link-href="${escapeHtml(block.href || block.route || '')}">
              ${escapeHtml(block.label || 'Open Link')}
            </button>
          `;
        case 'form': {
          const fields = Array.isArray(block.fields) ? block.fields : [];
          return `
            <div class="acp-inline-form" data-form-title="${escapeHtml(block.title || '')}">
              ${block.title ? `<strong style="font-size:12.5px;">${escapeHtml(block.title)}</strong>` : ''}
              ${fields.map((f) => `
                <div class="acp-inline-form-field">
                  <label>${escapeHtml(f.label)}</label>
                  <input type="${f.type === 'number' ? 'number' : 'text'}" name="${escapeHtml(f.id)}" placeholder="${escapeHtml(f.placeholder || '')}" />
                </div>
              `).join('')}
              <div class="acp-inline-form-actions">
                <button type="button" class="acp-button acp-button--primary" data-action="inline-form-submit" data-msg-idx="${mIdx}">Submit</button>
              </div>
            </div>
          `;
        }
        case 'confirmation':
          return `
            <div class="acp-confirmation">
              <p class="acp-text">${escapeHtml(block.text || '')}</p>
              <div class="acp-confirmation-actions">
                <button type="button" class="acp-button acp-button--primary" data-action="confirm-yes" data-msg-idx="${mIdx}">Confirm</button>
                <button type="button" class="acp-button acp-button--secondary" data-action="confirm-no" data-msg-idx="${mIdx}">Cancel</button>
              </div>
            </div>
          `;
        case 'error':
          return `
            <div class="acp-error">
              <p>${escapeHtml(block.message || '')}</p>
              ${block.details ? `<small>${escapeHtml(block.details)}</small>` : ''}
            </div>
          `;
        default:
          return `<p class="acp-text">${escapeHtml(block.text || block.message || '')}</p>`;
      }
    }

    _bindMessageActions(container) {
      container.querySelectorAll('.acp-suggestion-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const mIdx = Number(chip.getAttribute('data-msg-idx'));
          const bIdx = Number(chip.getAttribute('data-block-idx'));
          const cIdx = Number(chip.getAttribute('data-chip-idx'));
          const message = this.filteredMessages[mIdx];
          const block = message && message.blocks && message.blocks[bIdx];
          const suggestion = block && (block.suggestions || block.items) && (block.suggestions || block.items)[cIdx];
          if (!suggestion) return;

          this.dispatchEvent(new CustomEvent('acp-suggestion-click', {
            detail: { suggestion },
            bubbles: true,
            composed: true,
          }));

          const action = suggestion.action || suggestion;
          const payload = action.payload || {};
          if (payload.type === 'internal.prompt' && payload.prompt) {
            this.sendMessage(String(payload.prompt));
          } else if (payload.type === 'navigate' && (payload.href || payload.route)) {
            this.dispatchEvent(new CustomEvent('acp-navigate', {
              detail: { href: payload.href || payload.route },
              bubbles: true,
              composed: true,
            }));
          }
        });
      });

      container.querySelectorAll('.acp-link-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const href = btn.getAttribute('data-link-href');
          this.dispatchEvent(new CustomEvent('acp-link-click', {
            detail: { href, label: btn.textContent.trim() },
            bubbles: true,
            composed: true,
          }));
        });
      });

      container.querySelectorAll('[data-action="confirm-yes"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('acp-confirmation-action', {
            detail: { confirmed: true },
            bubbles: true,
            composed: true,
          }));
        });
      });

      container.querySelectorAll('[data-action="confirm-no"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('acp-confirmation-action', {
            detail: { confirmed: false },
            bubbles: true,
            composed: true,
          }));
        });
      });
    }

    _send() {
      const val = this._draft.trim();
      if (!val) return;
      this.dispatchEvent(new CustomEvent('acp-message-sent', { detail: val, bubbles: true, composed: true }));
      this._emitFormRequestedIfNeeded(val);
      this._draft = '';
      const input = this.querySelector('.acp-input');
      const counter = this.querySelector('.acp-counter');
      const sendButton = this.querySelector('[data-action="send"]');
      if (input) input.value = '';
      if (counter) counter.textContent = `0/${this.maxLength}`;
      if (sendButton) sendButton.disabled = true;
    }

    _emitFormRequestedIfNeeded(text) {
      const formSpec = parseFormTrigger(text, this.formTriggerPrefix);
      if (!formSpec) return;
      this.dispatchEvent(new CustomEvent('acp-form-requested', {
        detail: { formSpec },
        bubbles: true,
        composed: true,
      }));
    }

    _startResize(e) {
      this._resizing = true;
      this._startX = e.clientX;
      this._startWidth = this.width;
      const move = (ev) => {
        if (this._resizing) {
          const delta = ev.clientX - this._startX;
          this._setWidth(this._startWidth + delta);
        }
      };
      const up = () => {
        this._resizing = false;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    }

    _setWidth(val) {
      const clamped = this._clamp(val);
      if (clamped === this.width) return;
      this.width = clamped;
      this.style.width = `${clamped}px`;
      this.style.flexBasis = `${clamped}px`;
      this.dispatchEvent(new CustomEvent('acp-width-change', { detail: clamped, bubbles: true, composed: true }));
    }

    _clamp(val) {
      return Math.min(this.maxWidth, Math.max(this.minWidth, Number(val) || DEFAULTS.width));
    }
  }

  /* ==========================================================================
     Custom Element 2: AcpDynamicContainer (<acp-dynamic-container>)
     ========================================================================== */
  class AcpDynamicContainer extends HTMLElement {
    static get observedAttributes() {
      return ['open', 'title', 'form-width', 'min-form-width', 'max-form-width', 'form-height', 'min-form-height', 'minimized', 'maximized'];
    }

    constructor() {
      super();
      this._rendered = false;
      this._formSpec = null;
      this._surface = null;
      this._formValues = {};
      this._formResizing = false;
      this._onFormRequested = null;
      this._listenerHost = null;
      this._minimized = false;
      this._maximized = false;
      this._menuOpen = false;
      this._explicitlyClosed = false;
    }

    connectedCallback() {
      this._rendered = true;
      this._attachAutoOpenListener();
      this._render();
    }

    disconnectedCallback() {
      if (this._listenerHost && this._onFormRequested) {
        this._listenerHost.removeEventListener('acp-form-requested', this._onFormRequested);
      }
      this._listenerHost = null;
      this._onFormRequested = null;
    }

    attributeChangedCallback() {
      if (this._rendered) this._render();
    }

    get open() { return this.hasAttribute('open'); }
    set open(val) {
      const wasOpen = this.open;
      if (val) {
        this._explicitlyClosed = false;
        this.setAttribute('open', '');
      } else {
        if (wasOpen) this._explicitlyClosed = true;
        this.removeAttribute('open');
      }
    }

    get minimized() { return this._minimized; }
    set minimized(val) {
      this._minimized = Boolean(val);
      if (this._rendered) this._render();
    }

    get maximized() { return this._maximized; }
    set maximized(val) {
      this._maximized = Boolean(val);
      if (this._rendered) this._render();
    }

    get title() { return this.getAttribute('title') || CONTAINER_DEFAULTS.title; }
    set title(val) { this.setAttribute('title', String(val)); }

    get formWidth() { return Number(this.getAttribute('form-width') || CONTAINER_DEFAULTS.formWidth); }
    set formWidth(val) { this.setAttribute('form-width', String(val)); }

    get minFormWidth() { return Number(this.getAttribute('min-form-width') || CONTAINER_DEFAULTS.minFormWidth); }
    set minFormWidth(val) { this.setAttribute('min-form-width', String(val)); }

    get maxFormWidth() { return Number(this.getAttribute('max-form-width') || CONTAINER_DEFAULTS.maxFormWidth); }
    set maxFormWidth(val) { this.setAttribute('max-form-width', String(val)); }

    get formHeight() {
      const raw = this.getAttribute('form-height');
      return raw ? Number(raw) || null : null;
    }
    set formHeight(val) {
      if (val == null || val === '') this.removeAttribute('form-height');
      else this.setAttribute('form-height', String(val));
    }

    get minFormHeight() { return Number(this.getAttribute('min-form-height') || CONTAINER_DEFAULTS.minFormHeight); }
    set minFormHeight(val) { this.setAttribute('min-form-height', String(val)); }

    get formSpec() { return this._formSpec; }
    set formSpec(val) {
      const norm = normalizeFormSpec(val);
      this._formSpec = norm;
      if (norm) this._surface = null;
      this._formValues = norm && norm.initialValues ? Object.assign({}, norm.initialValues) : {};
      if (this._rendered) this._render();
    }

    get surface() { return this._surface; }
    set surface(val) {
      this._surface = val && typeof val === 'object' ? val : null;
      if (this._surface) this._formSpec = null;
      if (this._rendered) this._render();
    }

    collapse() {
      this._minimized = true;
      this._maximized = false;
      this._render();
    }

    maximize() {
      const stage = this.closest('.acp-workspace__stage');
      const assembler = stage && stage.querySelector('.acp-workspace__actions acp-actions-pane');
      if (assembler && assembler.maximized) assembler.restore();
      this._maximized = true;
      this._minimized = false;
      this._render();
      this.dispatchEvent(new CustomEvent('acp-workspace-maximize', { bubbles: true, composed: true }));
    }

    restore() {
      this._minimized = false;
      this._maximized = false;
      this._render();
      this.dispatchEvent(new CustomEvent('acp-restore-default-split', { bubbles: true, composed: true }));
    }

    close() {
      this._cancel();
    }

    _attachAutoOpenListener() {
      if (this._onFormRequested) return;
      this._listenerHost = this.closest('.acp-workspace') || document;
      this._onFormRequested = (ev) => {
        const detail = ev && ev.detail ? ev.detail : {};
        const formSpec = normalizeFormSpec(detail.formSpec || detail);
        if (!formSpec) return;
        this.surface = null;
        this.formSpec = formSpec;
        if (this._explicitlyClosed) return;
        this.open = true;
        this._minimized = false;
        this.dispatchEvent(new CustomEvent('acp-open-change', { detail: true, bubbles: true, composed: true }));
        if (detail.activityItem) {
          this.dispatchEvent(new CustomEvent('acp-actions-requested', {
            detail: { open: true, item: detail.activityItem },
            bubbles: true,
            composed: true,
          }));
        }
      };
      this._listenerHost.addEventListener('acp-form-requested', this._onFormRequested);
    }

    _render() {
      const hasForm = Boolean(this._formSpec);
      const hasSurface = Boolean(this._surface);
      const isOpen = this.open && (hasForm || hasSurface);
      const width = this._clampFormWidth(this.formWidth);

      const customHeight = isOpen && !this._minimized && !this._maximized ? this.formHeight : null;
      this.style.display = isOpen ? 'block' : 'none';
      this.style.height = customHeight ? `${customHeight}px` : '100%';
      this.style.minHeight = '0';
      this.style.minWidth = '0';
      this.style.alignSelf = customHeight ? 'flex-start' : 'stretch';
      this.style.boxSizing = 'border-box';
      this.style.overflow = 'hidden';
      const paneWidth = this._maximized
        ? availablePaneWidth(this, '.acp-workspace__actions acp-actions-pane', this.minFormWidth)
        : width;
      this.style.flex = isOpen ? `0 0 ${this._minimized ? 52 : paneWidth}px` : '0 0 0';
      this.style.width = isOpen ? `${this._minimized ? 52 : paneWidth}px` : '0';
      this.style.maxWidth = isOpen && !this._minimized && !this._maximized ? '100%' : '';

      if (this._minimized) {
        this.innerHTML = `
          <section class="acp-container acp-workspace-rail" aria-label="Minimized Workspace Rail">
            <header class="acp-container-header" title="Restore workspace" data-action="restore-rail">
              <span class="acp-rail-label">Workspace</span>
              <button class="acp-icon-button" data-action="close" type="button" aria-label="Close workspace">×</button>
            </header>
          </section>
        `;
        const railHead = this.querySelector('[data-action="restore-rail"]');
        if (railHead) {
          railHead.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="close"]')) return;
            this.restore();
          });
        }
        const closeBtn = this.querySelector('[data-action="close"]');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        return;
      }

      this.innerHTML = `
        <section class="acp-container ${isOpen ? 'acp-container--open' : ''}" aria-label="ACP dynamic container">
          <header class="acp-container-header">
            <div class="acp-container-header__title">${escapeHtml((this._formSpec && this._formSpec.title) || (this._surface && this._surface.title) || this.title)}</div>
            <div class="acp-container-header__actions">
              <div class="acp-kebab-wrap">
                <button type="button" class="acp-icon-button" data-action="kebab" title="More options">⋮</button>
                ${this._menuOpen ? `
                  <div class="acp-kebab-menu">
                    <button type="button" class="acp-kebab-item" data-action="open-actions-menu">Open Actions</button>
                  </div>
                ` : ''}
              </div>
              <button class="acp-icon-button" data-action="minimize" type="button" title="Minimize workspace" aria-label="Minimize workspace">−</button>
              <button class="acp-icon-button" data-action="maximize" type="button" title="${this._maximized ? 'Restore workspace' : 'Maximize workspace'}" aria-label="${this._maximized ? 'Restore workspace' : 'Maximize workspace'}">${this._maximized ? '⤡' : '⤢'}</button>
              <button class="acp-icon-button" data-action="close" type="button" title="Close form" aria-label="Close form">×</button>
            </div>
          </header>
          <div class="acp-container-body">
            ${isOpen ? (hasForm ? this._formHtml(width) : this._surfaceHtml()) : `<div class="acp-container-empty">No form or information surface active.</div>`}
          </div>
          ${isOpen && !this._maximized ? paneResizeHandlesHtml('Workspace') : ''}
        </section>
      `;

      this._bindContainerEvents();
    }

    _surfaceHtml() {
      const surface = this._surface || {};
      const description = surface.description || surface.summary;
      const data = surface.data && typeof surface.data === 'object' && !Array.isArray(surface.data)
        ? surface.data
        : {};
      const fields = Array.isArray(surface.schema && surface.schema.fields) ? surface.schema.fields : [];
      const entries = fields.length
        ? fields.map((field) => [String(field.label || field.id || ''), data[field.id]])
        : Object.keys(data).map((key) => [key, data[key]]);
      const rows = Array.isArray(surface.records) ? surface.records
        : (Array.isArray(surface.rows) ? surface.rows : (Array.isArray(surface.items) ? surface.items : []));
      const valueText = (value) => value == null ? '' : (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
      return `
        <div class="acp-info-surface">
          ${description ? `<p class="acp-info-surface__description">${escapeHtml(valueText(description))}</p>` : ''}
          ${entries.length ? `<dl class="acp-info-surface__data">${entries.map(([label, value]) => `
            <div class="acp-info-surface__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(valueText(value)) || '—'}</dd></div>
          `).join('')}</dl>` : ''}
          ${rows.length ? `<div class="acp-info-surface__items">${rows.map((row) => `
            <pre>${escapeHtml(valueText(row))}</pre>
          `).join('')}</div>` : ''}
          ${!description && !entries.length && !rows.length ? '<p class="acp-info-surface__description">Information is available for this surface.</p>' : ''}
        </div>
      `;
    }

    _bindContainerEvents() {
      const kebabBtn = this.querySelector('[data-action="kebab"]');
      if (kebabBtn) {
        kebabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._menuOpen = !this._menuOpen;
          this._render();
        });
      }

      const openActionsMenuItem = this.querySelector('[data-action="open-actions-menu"]');
      if (openActionsMenuItem) {
        openActionsMenuItem.addEventListener('click', () => {
          this._menuOpen = false;
          this.dispatchEvent(new CustomEvent('acp-open-actions', { bubbles: true, composed: true }));
          this._render();
        });
      }

      const minBtn = this.querySelector('[data-action="minimize"]');
      if (minBtn) minBtn.addEventListener('click', () => this.collapse());

      const maxBtn = this.querySelector('[data-action="maximize"]');
      if (maxBtn) {
        maxBtn.addEventListener('click', () => {
          if (this._maximized) this.restore();
          else this.maximize();
        });
      }

      const closeBtn = this.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.addEventListener('click', () => this._cancel());

      const form = this.querySelector('[data-action="form"]');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this._submit(form);
        });
        form.addEventListener('input', (e) => this._captureValue(e.target));
        form.addEventListener('change', (e) => this._captureValue(e.target));
      }

      const cancelBtn = this.querySelector('[data-action="cancel"]');
      if (cancelBtn) cancelBtn.addEventListener('click', () => this._cancel());
      const buddySurface = this.querySelector('buddy-enrol-workspace-surface');
      if (buddySurface) {
        buddySurface.addEventListener('buddy-cancel', () => this._cancel());
      }

      const handle = this.querySelector('[data-action="form-resize"]');
      if (handle) {
        handle.addEventListener('pointerdown', (e) => this._startFormResize(e));
        handle.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this._setFormWidth(this.formWidth - 24);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this._setFormWidth(this.formWidth + 24);
          }
        });
      }

      this.querySelectorAll('[data-pane-resize]').forEach((edge) => {
        const axis = edge.getAttribute('data-pane-resize');
        edge.addEventListener('pointerdown', (e) => startPaneResize(
          e, axis, this, this.formWidth,
          (w) => this._setFormWidth(w),
          (h) => this._setFormHeight(h)
        ));
        edge.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const current = this.getBoundingClientRect().height;
            this._setFormHeight(current + (e.key === 'ArrowDown' ? 24 : -24));
          }
        });
      });
    }

    _captureValue(ctl) {
      if (!ctl || !ctl.name) return;
      this._formValues[ctl.name] = ctl.type === 'checkbox' ? Boolean(ctl.checked) : ctl.value;
    }

    _submit(formEl) {
      if (!this._formSpec || !formEl) return;
      if (!formEl.reportValidity()) return;
      const values = {};
      for (const field of this._formSpec.fields) {
        const ctl = formEl.elements.namedItem(field.id);
        if (!ctl) {
          values[field.id] = this._formValues[field.id] != null ? this._formValues[field.id] : null;
          continue;
        }
        if (field.type === 'checkbox') values[field.id] = Boolean(ctl.checked);
        else if (field.type === 'number') values[field.id] = ctl.value === '' ? null : Number(ctl.value);
        else values[field.id] = ctl.value;
      }
      this.dispatchEvent(new CustomEvent('acp-submitted', {
        detail: { formId: this._formSpec.formId, values },
        bubbles: true,
        composed: true,
      }));
      this.dispatchEvent(new CustomEvent('acp-actions-requested', {
        detail: {
          open: true,
          item: {
            id: `submission-${Date.now()}`,
            kind: 'success',
            text: 'Submitted form successfully.',
            actions: [
              { id: 'focus_record', label: 'Focus' },
              { id: 'copy_names', label: 'Copy' },
            ],
          },
        },
        bubbles: true,
        composed: true,
      }));
    }

    _cancel() {
      this.open = false;
      this.dispatchEvent(new CustomEvent('acp-open-change', { detail: false, bubbles: true, composed: true }));
      this.dispatchEvent(new CustomEvent('acp-cancelled', { bubbles: true, composed: true }));
      this._render();
    }

    _formHtml(width) {
      const spec = this._formSpec;
      if (!spec) return '';
      if (spec.formId === 'student-enroll' || spec.formId === 'buddy-enrol') {
        return `
          <div class="acp-form-shell acp-form-shell--buddy" style="width:${width}px">
            <buddy-enrol-workspace-surface></buddy-enrol-workspace-surface>
            <div class="acp-form-resize-handle" data-action="form-resize" role="separator" aria-orientation="vertical" aria-label="Resize workspace" tabindex="0"></div>
          </div>
        `;
      }
      return `
        <div class="acp-form-shell" style="width:${width}px">
          <div class="acp-form-custom-host" data-acp-custom-host="${escapeHtml(spec.formId)}"></div>
          <form class="acp-form" data-action="form" novalidate>
            <h2 class="acp-form-title">${escapeHtml(spec.title)}</h2>
            ${spec.description ? `<p class="acp-form-description">${escapeHtml(spec.description)}</p>` : ''}
            ${spec.fields.map((f) => this._fieldHtml(f)).join('')}
            <div class="acp-form-actions">
              <button class="acp-button acp-button--secondary" data-action="cancel" type="button">${escapeHtml(spec.cancelLabel || 'Close')}</button>
              <button class="acp-button acp-button--primary" type="submit">${escapeHtml(spec.submitLabel || 'Submit')}</button>
            </div>
          </form>
          <div class="acp-form-resize-handle" data-action="form-resize" role="separator" aria-orientation="vertical" aria-label="Resize form" tabindex="0"></div>
        </div>
      `;
    }

    _fieldHtml(f) {
      const req = f.required ? 'required' : '';
      const dis = f.disabled ? 'disabled' : '';
      const ph = f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : '';
      const maxL = f.validation && f.validation.maxLength ? `maxlength="${f.validation.maxLength}"` : '';
      const val = this._formValues[f.id] != null ? this._formValues[f.id] : '';

      if (f.type === 'textarea') {
        return `<label class="acp-form-field"><span class="acp-form-label">${escapeHtml(f.label)}</span><textarea class="acp-form-control" name="${escapeHtml(f.id)}" rows="3" ${ph} ${req} ${dis} ${maxL}>${escapeHtml(String(val))}</textarea></label>`;
      }
      if (f.type === 'select') {
        const opts = Array.isArray(f.options) ? f.options : [];
        return `<label class="acp-form-field"><span class="acp-form-label">${escapeHtml(f.label)}</span><select class="acp-form-control" name="${escapeHtml(f.id)}" ${req} ${dis}><option value="">Select...</option>${opts.map((o) => `<option value="${escapeHtml(o.value)}" ${String(val) === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;
      }
      if (f.type === 'checkbox') {
        return `<label class="acp-form-field" style="flex-direction:row;align-items:center;gap:8px;"><input class="acp-form-control" style="width:auto;" name="${escapeHtml(f.id)}" type="checkbox" ${Boolean(val) ? 'checked' : ''} ${req} ${dis} /><span class="acp-form-label">${escapeHtml(f.label)}</span></label>`;
      }

      const inputType = f.type === 'number' || f.type === 'date' ? f.type : 'text';
      return `<label class="acp-form-field"><span class="acp-form-label">${escapeHtml(f.label)}</span><input class="acp-form-control" name="${escapeHtml(f.id)}" type="${inputType}" value="${escapeHtml(String(val))}" ${ph} ${req} ${dis} ${maxL} /></label>`;
    }

    _startFormResize(e) {
      this._formResizing = true;
      this._startX = e.clientX;
      this._startFormWidth = this.formWidth;
      const move = (ev) => {
        if (this._formResizing) {
          this._setFormWidth(this._startFormWidth + (ev.clientX - this._startX));
        }
      };
      const up = () => {
        this._formResizing = false;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    }

    _setFormWidth(val) {
      const clamped = this._clampFormWidth(val);
      if (clamped === this.formWidth) return;
      this.formWidth = clamped;
      this.style.width = `${clamped}px`;
      this.style.flexBasis = `${clamped}px`;
      const shell = this.querySelector('.acp-form-shell');
      if (shell) shell.style.width = `${clamped}px`;
      this.dispatchEvent(new CustomEvent('acp-form-width-change', { detail: clamped, bubbles: true, composed: true }));
    }

    _setFormHeight(val) {
      const clamped = clampPaneHeight(this, val, this.minFormHeight);
      if (clamped === this.formHeight) return;
      this.formHeight = clamped;
      this.dispatchEvent(new CustomEvent('acp-form-height-change', { detail: clamped, bubbles: true, composed: true }));
    }

    _clampFormWidth(val) {
      return Math.min(this.maxFormWidth, Math.max(this.minFormWidth, Number(val) || CONTAINER_DEFAULTS.formWidth));
    }
  }

  /* ==========================================================================
     Custom Element 3: BuddyEnrolWorkspaceSurface (<buddy-enrol-workspace-surface>)
     ========================================================================== */
  class BuddyEnrolWorkspaceSurface extends HTMLElement {
    constructor() {
      super();
      this._surface = null;
      this.records = [];
      this.activeRecordId = '';
      this.savedRecordIds = new Set();
      this.buddyText = '';
      this.query = '';
      this.parseInFlight = false;
      this.checkInFlight = false;
      this.page = 0;
      this.pageSize = 5;
    }

    connectedCallback() {
      this._render();
    }

    get surface() { return this._surface; }
    set surface(value) {
      this._surface = value && typeof value === 'object' ? value : null;
      const surface = this._surface || {};
      const incomingRecords = Array.isArray(surface.records) ? surface.records : [];
      this.records = incomingRecords.map((record, index) => {
        const values = record && record.values && typeof record.values === 'object' ? record.values : (record || {});
        const labels = record && record.labels && typeof record.labels === 'object' ? record.labels : {};
        return Object.assign({}, values, {
          id: String(record && record.id || 'record-' + (index + 1)),
          name: String(values.name || (record && record.name) || ''),
          dob: String(values.dob || (record && record.dob) || ''),
          gender: String(values.gender || (record && record.gender) || ''),
          courseId: String(values.courseId || (record && record.courseId) || labels.courseId || ''),
          course: String(labels.courseId || values.course || values.courseId || (record && record.course) || ''),
          email: String(values.email || (record && record.email) || ''),
          mobile: String(values.mobile || (record && record.mobile) || ''),
          fatherName: String(values.fatherName || (record && record.fatherName) || ''),
          valid: record && record.valid,
          saved: Boolean(record && record.saved),
        });
      });
      this.formId = String(surface.formId || this.formId || '');
      this.activeRecordId = String(surface.activeRecordId || (this.records[0] && this.records[0].id) || '');
      this.buddyText = String(surface.buddy && surface.buddy.text || '');
      this.query = '';
      this.page = 0;
      this.savedRecordIds = new Set(this.records.filter((record) => record.saved).map((record) => record.id));
      if (this.isConnected) this._render();
    }

    setRequestState(state) {
      const next = state && typeof state === 'object' ? state : {};
      if (next.parseInFlight !== undefined) this.parseInFlight = Boolean(next.parseInFlight);
      if (next.checkInFlight !== undefined) this.checkInFlight = Boolean(next.checkInFlight);
      if (this.isConnected) this._render();
    }

    get filteredRecords() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.records;
      return this.records.filter((r) =>
        [r.name, r.course, r.dob, r.email, r.mobile].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
      );
    }

    _render() {
      const filtered = this.filteredRecords;
      const totalPages = Math.ceil(filtered.length / this.pageSize) || 1;
      const startIdx = this.page * this.pageSize;
      const pageRecords = filtered.slice(startIdx, startIdx + this.pageSize);
      const active = this.records.find((r) => r.id === this.activeRecordId) || pageRecords[0] || {};

      this.innerHTML = `
        <div class="buddy-ws">
          <div class="buddy-ws-head">
            <h3>${escapeHtml(this.surface && this.surface.title || 'Student Enrollment Workspace')}</h3>
            <p>${escapeHtml(this.surface && this.surface.helpText || 'Paste multi-line text or unformatted student details below, then click Parse.')}</p>
          </div>
          <div class="buddy-ws-buddy">
            <div class="buddy-ws-buddy-head">
              <strong>Raw Text Input</strong>
              <button type="button" class="buddy-ws-btn" data-action="parse" ${this.parseInFlight ? 'disabled' : ''}>
                ${this.parseInFlight ? 'Thinking...' : escapeHtml(this.surface && this.surface.prepareLabel || 'Parse')}
              </button>
            </div>
            <textarea class="buddy-ws-textarea" rows="4" placeholder="${escapeHtml(this.surface && this.surface.inputPlaceholder || '')}">${escapeHtml(this.buddyText)}</textarea>
          </div>
          <div class="buddy-ws-picker">
            <input type="search" class="buddy-ws-search" placeholder="Search name, course…" value="${escapeHtml(this.query)}" />
            <div class="buddy-ws-strip">
              ${pageRecords.map((r, i) => `
                <button type="button" class="buddy-ws-chip ${r.id === this.activeRecordId ? 'active' : ''} ${this.savedRecordIds.has(r.id) ? 'saved' : ''}" data-id="${r.id}">
                  <span>#${startIdx + i + 1}</span>
                  <strong>${escapeHtml(r.name || 'Unnamed')}</strong>
                  <span>(${escapeHtml(r.course || 'No course')})</span>
                  ${this.savedRecordIds.has(r.id) ? '<span class="buddy-ws-chip-saved">✓ Saved</span>' : (r.valid === false ? '<span class="buddy-ws-chip-warn">⚠</span>' : '')}
                </button>
              `).join('')}
            </div>
            ${totalPages > 1 ? `
              <div class="buddy-ws-pager">
                <button type="button" data-action="prev-page" ${this.page === 0 ? 'disabled' : ''}>‹ prev</button>
                <span>Page ${this.page + 1} of ${totalPages} · ${filtered.length} students</span>
                <button type="button" data-action="next-page" ${this.page >= totalPages - 1 ? 'disabled' : ''}>next ›</button>
              </div>
            ` : ''}
          </div>
          <div class="buddy-ws-grid">
            ${(Array.isArray(this.surface && this.surface.fields) && this.surface.fields.length ? this.surface.fields : [
              { id: 'name', label: 'Name', type: 'text' },
              { id: 'dob', label: 'Date of Birth', type: 'date' },
              { id: 'gender', label: 'Gender', type: 'text' },
              { id: 'courseId', label: 'Course', type: 'select', options: [] },
            ]).map((field) => this._fieldHtml(field, active)).join('')}
          </div>
          <div class="buddy-ws-actions">
            <button type="button" class="buddy-ws-btn" data-action="clear">Clear</button>
            <button type="button" class="buddy-ws-btn" data-action="cancel">Cancel</button>
            <button type="button" class="buddy-ws-btn" data-action="check" ${this.checkInFlight ? 'disabled' : ''}>
              ${this.checkInFlight ? 'Validating...' : 'Validate & check for errors'}
            </button>
            <button type="button" class="acp-button acp-button--primary" data-action="submit-active">Submit</button>
            <button type="button" class="acp-button acp-button--primary" data-action="submit-all">Submit All</button>
          </div>
        </div>
      `;

      this._bindBuddyEvents(active);
    }

    _fieldHtml(field, active) {
      const id = String(field && field.id || '');
      if (!id) return '';
      const label = escapeHtml(field.label || id);
      const value = active[id] != null ? String(active[id]) : (id === 'courseId' ? String(active.course || '') : '');
      const required = field.required ? 'required' : '';
      const maxLength = field.maxLength ? `maxlength="${Number(field.maxLength)}"` : '';
      if (field.type === 'select') {
        const options = Array.isArray(field.options) ? field.options.slice() : [];
        if (value && !options.some((option) => String(option.value) === value)) {
          options.unshift({ value, label: String(active.course || value) });
        }
        return `<label class="acp-form-field"><span class="acp-form-label">${label}</span><select class="acp-form-control" name="${escapeHtml(id)}" ${required}><option value="">Select...</option>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === value ? 'selected' : ''}>${escapeHtml(option.label || option.value)}</option>`).join('')}</select></label>`;
      }
      const type = field.type === 'date' || field.type === 'number' ? field.type : 'text';
      const wide = id === 'fatherName' || id === 'address' ? ' buddy-ws-field--wide' : '';
      return `<label class="acp-form-field${wide}"><span class="acp-form-label">${label}</span><input class="acp-form-control" type="${type}" name="${escapeHtml(id)}" value="${escapeHtml(value)}" ${required} ${maxLength} /></label>`;
    }

    _bindBuddyEvents(active) {
      const textarea = this.querySelector('.buddy-ws-textarea');
      if (textarea) {
        textarea.addEventListener('input', (e) => {
          this.buddyText = e.target.value;
        });
      }

      const searchInp = this.querySelector('.buddy-ws-search');
      if (searchInp) {
        searchInp.addEventListener('input', (e) => {
          this.query = e.target.value;
          this.page = 0;
          this._render();
        });
      }

      this.querySelectorAll('.buddy-ws-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeRecordId = btn.getAttribute('data-id');
          this._render();
        });
      });

      const parseBtn = this.querySelector('[data-action="parse"]');
      if (parseBtn) {
        parseBtn.addEventListener('click', () => {
          this.parseInFlight = true;
          this._render();
          this.dispatchEvent(new CustomEvent('buddy-parse', {
            detail: { text: this.buddyText },
            bubbles: true,
            composed: true,
          }));
        });
      }

      const checkBtn = this.querySelector('[data-action="check"]');
      const clearBtn = this.querySelector('[data-action="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const record = this.records.find((item) => item.id === this.activeRecordId);
          if (record) {
            ['name', 'dob', 'gender', 'course', 'email', 'mobile', 'fatherName'].forEach((key) => { record[key] = ''; });
            record.valid = false;
          }
          this.dispatchEvent(new CustomEvent('buddy-clear', {
            detail: { recordId: this.activeRecordId },
            bubbles: true,
            composed: true,
          }));
          this._render();
        });
      }

      const cancelBtn = this.querySelector('[data-action="cancel"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('buddy-cancel', { bubbles: true, composed: true }));
        });
      }

      this.querySelectorAll('.buddy-ws-grid [name]').forEach((input) => {
        input.addEventListener('input', () => {
          if (active && active.id) active[input.name] = input.value;
        });
      });
      if (checkBtn) {
        checkBtn.addEventListener('click', () => {
          this.checkInFlight = true;
          this._render();
          this.dispatchEvent(new CustomEvent('buddy-check', {
            detail: { records: this.records },
            bubbles: true,
            composed: true,
          }));
        });
      }

      const prevBtn = this.querySelector('[data-action="prev-page"]');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (this.page > 0) {
            this.page--;
            this._render();
          }
        });
      }

      const nextBtn = this.querySelector('[data-action="next-page"]');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          this.page++;
          this._render();
        });
      }

      const submitBtn = this.querySelector('[data-action="submit-active"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this.savedRecordIds.add(this.activeRecordId);
          this.dispatchEvent(new CustomEvent('buddy-submit', {
            detail: { recordId: this.activeRecordId, record: active },
            bubbles: true,
            composed: true,
          }));
          this.dispatchEvent(new CustomEvent('acp-actions-requested', {
            detail: {
              open: true,
              item: {
                id: `enrol-save-${Date.now()}`,
                kind: 'success',
                recordId: this.activeRecordId,
                text: `Saved ${active.name || 'student'}.`,
                actions: [{ id: 'focus_record', label: 'Focus' }],
              },
            },
            bubbles: true,
            composed: true,
          }));
          this._render();
        });
      }

      const submitAllBtn = this.querySelector('[data-action="submit-all"]');
      if (submitAllBtn) {
        submitAllBtn.addEventListener('click', () => {
          this.records.forEach((r) => this.savedRecordIds.add(r.id));
          this.dispatchEvent(new CustomEvent('buddy-submit-all', {
            detail: { records: this.records },
            bubbles: true,
            composed: true,
          }));
          this.dispatchEvent(new CustomEvent('acp-actions-requested', {
            detail: {
              open: true,
              item: {
                id: `enrol-save-all-${Date.now()}`,
                kind: 'success',
                text: `Saved all ${this.records.length} students.`,
                actions: [{ id: 'copy_names', label: 'Copy' }],
              },
            },
            bubbles: true,
            composed: true,
          }));
          this._render();
        });
      }
    }
  }

  /* ==========================================================================
     Custom Element 4: AcpActionsPane (<acp-actions-pane>)
     ========================================================================== */
  class AcpActionsPane extends HTMLElement {
    static get observedAttributes() {
      return ['open', 'title', 'width', 'min-width', 'max-width', 'height', 'min-height'];
    }

    constructor() {
      super();
      this._items = [];
      this._menuActions = [{ id: 'copy_all_names', label: 'Copy all saved names' }];
      this._menuOpen = false;
      this._minimized = false;
      this._maximized = false;
      this._rendered = false;
      this._resizing = false;
      this._onActionsRequested = null;
      this._onOpenActions = null;
      this._onWorkspaceOpen = null;
      this._listenerHost = null;
      this._activeTab = 'activity';
    }

    connectedCallback() {
      this._rendered = true;
      this._attachRequestListener();
      this._render();
    }

    disconnectedCallback() {
      if (this._listenerHost && this._onActionsRequested) {
        this._listenerHost.removeEventListener('acp-actions-requested', this._onActionsRequested);
      }
      if (this._listenerHost && this._onOpenActions) {
        this._listenerHost.removeEventListener('acp-open-actions', this._onOpenActions);
      }
      if (this._listenerHost && this._onWorkspaceOpen) {
        this._listenerHost.removeEventListener('acp-open-change', this._onWorkspaceOpen);
      }
      this._listenerHost = null;
      this._onActionsRequested = null;
      this._onOpenActions = null;
      this._onWorkspaceOpen = null;
    }

    attributeChangedCallback() {
      if (this._rendered) this._render();
    }

    get open() { return this.hasAttribute('open'); }
    set open(val) { val ? this.setAttribute('open', '') : this.removeAttribute('open'); }

    get title() { return this.getAttribute('title') || ACTIONS_DEFAULTS.title; }
    set title(val) { this.setAttribute('title', String(val)); }

    get width() { return Number(this.getAttribute('width') || ACTIONS_DEFAULTS.width); }
    set width(val) { this.setAttribute('width', String(val)); }

    get minWidth() { return Number(this.getAttribute('min-width') || ACTIONS_DEFAULTS.minWidth); }
    set minWidth(val) { this.setAttribute('min-width', String(val)); }

    get maxWidth() { return Number(this.getAttribute('max-width') || ACTIONS_DEFAULTS.maxWidth); }
    set maxWidth(val) { this.setAttribute('max-width', String(val)); }

    get height() {
      const raw = this.getAttribute('height');
      return raw ? Number(raw) || null : null;
    }
    set height(val) {
      if (val == null || val === '') this.removeAttribute('height');
      else this.setAttribute('height', String(val));
    }

    get minHeight() { return Number(this.getAttribute('min-height') || ACTIONS_DEFAULTS.minHeight); }
    set minHeight(val) { this.setAttribute('min-height', String(val)); }

    get items() { return this._items; }
    set items(val) {
      this._items = Array.isArray(val) ? val : [];
      this._render();
    }

    get menuActions() { return this._menuActions; }
    set menuActions(val) {
      this._menuActions = Array.isArray(val) ? val : [];
      this._render();
    }

    get minimized() { return this._minimized; }
    set minimized(val) {
      this._minimized = Boolean(val);
      this._render();
    }

    get maximized() { return this._maximized; }
    set maximized(val) {
      this._maximized = Boolean(val);
      this._render();
    }

    collapse() {
      this._minimized = true;
      this._maximized = false;
      this._render();
    }

    maximize() {
      const stage = this.closest('.acp-workspace__stage');
      const workspace = stage && stage.querySelector('.acp-workspace__surface acp-dynamic-container');
      if (workspace && workspace.maximized) workspace.restore();
      this._maximized = true;
      this._minimized = false;
      this._render();
    }

    restore() {
      this._minimized = false;
      this._maximized = false;
      this._render();
      this.dispatchEvent(new CustomEvent('acp-restore-default-split', { bubbles: true, composed: true }));
    }

    close() {
      this.open = false;
      this.dispatchEvent(new CustomEvent('acp-open-change', { detail: false, bubbles: true, composed: true }));
      this.dispatchEvent(new CustomEvent('acp-actions-close', { bubbles: true, composed: true }));
    }

    _attachRequestListener() {
      if (this._onActionsRequested) return;
      this._listenerHost = this.closest('.acp-workspace') || document;
      this._onActionsRequested = (ev) => {
        if (ev.target === this) return;
        const detail = ev && ev.detail ? ev.detail : {};
        if (detail.item && !this._items.some((item) => String(item.id) === String(detail.item.id))) {
          this._items = this._items.concat(detail.item);
        }
        if (detail.open !== false) {
          this.open = true;
          this._minimized = false;
          this.dispatchEvent(new CustomEvent('acp-open-change', { detail: true, bubbles: true, composed: true }));
        }
        this._render();
      };
      this._listenerHost.addEventListener('acp-actions-requested', this._onActionsRequested);
      this._onOpenActions = () => {
        this.open = true;
        this._minimized = false;
        this.dispatchEvent(new CustomEvent('acp-open-change', { detail: true, bubbles: true, composed: true }));
        this._render();
      };
      this._listenerHost.addEventListener('acp-open-actions', this._onOpenActions);
      this._onWorkspaceOpen = (ev) => {
        if (ev.target === this || ev.target.tagName !== 'ACP-DYNAMIC-CONTAINER' || ev.detail !== true || !this._items.length) return;
        this.open = true;
        this._minimized = false;
        this._render();
      };
      this._listenerHost.addEventListener('acp-open-change', this._onWorkspaceOpen);
    }

    _render() {
      const width = this._maximized
        ? availablePaneWidth(this, '.acp-workspace__surface acp-dynamic-container', this.minWidth)
        : this._clampWidth(this.width);
      const customHeight = this.open && !this._minimized && !this._maximized ? this.height : null;
      this.style.height = customHeight ? `${customHeight}px` : '';
      this.style.alignSelf = customHeight ? 'flex-start' : '';
      this.style.display = this.open ? 'block' : 'none';
      this.style.width = this.open ? `${this._minimized ? 52 : width}px` : '0';
      this.style.flex = this.open ? `0 0 ${this._minimized ? 52 : width}px` : '0 0 0';
      this.style.maxWidth = this.open && !this._minimized && !this._maximized ? '100%' : '';

      if (this._minimized) {
        this.innerHTML = `
          <div class="acp-actions-pane acp-actions-rail" aria-label="Minimized Assembler Rail">
            <header class="acp-actions-header" title="Restore Assembler" data-action="restore-rail">
              <span class="acp-rail-label">Assembler</span>
              <button class="acp-icon-button" data-action="close" type="button" aria-label="Close Assembler">×</button>
            </header>
          </div>
        `;
        const railHead = this.querySelector('[data-action="restore-rail"]');
        if (railHead) {
          railHead.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="close"]')) return;
            this.restore();
          });
        }
        const closeBtn = this.querySelector('[data-action="close"]');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        return;
      }

      this.innerHTML = `
        <div class="acp-actions-pane">
          <div class="acp-actions-header">
            <strong>${escapeHtml(this.title)}</strong>
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="acp-kebab-wrap">
                <button type="button" class="acp-icon-button" data-action="kebab" title="More options">⋮</button>
                ${this._menuOpen ? `
                  <div class="acp-kebab-menu">
                    ${this._menuActions.map((m) => `
                      <button type="button" class="acp-kebab-item" data-menu-id="${escapeHtml(m.id)}">
                        ${escapeHtml(m.label)}
                      </button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
              <button class="acp-icon-button" data-action="minimize" type="button" title="Minimize Assembler" aria-label="Minimize Assembler">−</button>
              <button class="acp-icon-button" data-action="maximize" type="button" title="${this._maximized ? 'Restore Assembler' : 'Maximize Assembler'}" aria-label="${this._maximized ? 'Restore Assembler' : 'Maximize Assembler'}">${this._maximized ? '⤡' : '⤢'}</button>
              <button class="acp-icon-button" data-action="close" type="button" title="Close actions" aria-label="Close actions">×</button>
            </div>
          </div>
          <div class="acp-actions-tabs" role="tablist" aria-label="Action views">
            <button type="button" role="tab" data-tab="activity" class="${this._activeTab === 'activity' ? 'active' : ''}">Activity</button>
            <button type="button" role="tab" data-tab="status" class="${this._activeTab === 'status' ? 'active' : ''}">Status</button>
          </div>
          <ul class="acp-actions-list" data-active-tab="${this._activeTab}">
            ${this._items.length ? this._items.map((item) => `
              <li class="acp-action-item acp-action-item--${item.kind || 'info'}">
                <span class="text">${escapeHtml(item.text)}</span>
                <div class="actions">
                  ${(item.actions || []).map((act) => `
                    <button type="button" class="acp-action-btn" data-item-id="${item.id}" data-action-id="${act.id}">
                      ${escapeHtml(act.label)}
                    </button>
                  `).join('')}
                </div>
              </li>
            `).join('') : `<li style="padding:16px;text-align:center;color:var(--acp-text-muted);font-size:12px;">No actions recorded yet.</li>`}
          </ul>
          <div class="acp-pane-resize-handle" data-action="actions-resize" role="separator" aria-orientation="vertical" aria-label="Resize actions pane" tabindex="0"></div>
          ${this._maximized ? '' : paneResizeHandlesHtml('Assembler')}
        </div>
      `;

      this._bindActionsEvents();
    }

    _bindActionsEvents() {
      const kebab = this.querySelector('[data-action="kebab"]');
      if (kebab) {
        kebab.addEventListener('click', (e) => {
          e.stopPropagation();
          this._menuOpen = !this._menuOpen;
          this._render();
        });
      }

      const minBtn = this.querySelector('[data-action="minimize"]');
      if (minBtn) minBtn.addEventListener('click', () => this.collapse());

      const maxBtn = this.querySelector('[data-action="maximize"]');
      if (maxBtn) {
        maxBtn.addEventListener('click', () => {
          if (this._maximized) this.restore();
          else this.maximize();
        });
      }

      const closeBtn = this.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      this.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._activeTab = btn.getAttribute('data-tab') || 'activity';
          this._render();
        });
      });

      const resizeHandle = this.querySelector('[data-action="actions-resize"]');
      if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', (e) => this._startResize(e));
        resizeHandle.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this._setWidth(this.width - 24);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this._setWidth(this.width + 24);
          }
        });
      }

      this.querySelectorAll('[data-pane-resize]').forEach((edge) => {
        const axis = edge.getAttribute('data-pane-resize');
        edge.addEventListener('pointerdown', (e) => startPaneResize(
          e, axis, this, this.width,
          (w) => this._setWidth(w),
          (h) => this._setHeight(h)
        ));
        edge.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const current = this.getBoundingClientRect().height;
            this._setHeight(current + (e.key === 'ArrowDown' ? 24 : -24));
          }
        });
      });

      this.querySelectorAll('[data-menu-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const actId = btn.getAttribute('data-menu-id');
          this._menuOpen = false;
          if (actId === 'copy_all_names' || actId === 'copy_all_names_fallback') {
            this._copyAllNames();
          }
          this.dispatchEvent(new CustomEvent('acp-menu-action-click', {
            detail: { actionId: actId },
            bubbles: true,
            composed: true,
          }));
          this._render();
        });
      });

      this.querySelectorAll('[data-action-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-item-id');
          const actId = btn.getAttribute('data-action-id');
          const item = this._items.find((it) => String(it.id) === String(itemId));
          this.dispatchEvent(new CustomEvent('acp-action-click', {
            detail: { item, actionId: actId },
            bubbles: true,
            composed: true,
          }));
        });
      });
    }

    _copyAllNames() {
      const names = [];
      this._items.forEach((it) => {
        if (it.kind === 'success' && it.text) {
          const clean = it.text.replace(/^Saved\s+/i, '').replace(/[.\s]+$/, '').trim();
          if (clean && !names.includes(clean)) names.push(clean);
        }
      });
      if (names.length && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(names.join(', ')).catch(() => {});
      }
    }

    _startResize(e) {
      this._resizing = true;
      this._startX = e.clientX;
      this._startWidth = this.width;
      const move = (ev) => {
        if (this._resizing) this._setWidth(this._startWidth + (ev.clientX - this._startX));
      };
      const up = () => {
        this._resizing = false;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      e.preventDefault();
    }

    _setWidth(val) {
      const clamped = this._clampWidth(val);
      if (clamped === this.width) return;
      this.width = clamped;
      this.style.width = `${clamped}px`;
      this.style.flexBasis = `${clamped}px`;
      this.dispatchEvent(new CustomEvent('acp-actions-width-change', { detail: clamped, bubbles: true, composed: true }));
    }

    _setHeight(val) {
      const clamped = clampPaneHeight(this, val, this.minHeight);
      if (clamped === this.height) return;
      this.height = clamped;
      this.dispatchEvent(new CustomEvent('acp-actions-height-change', { detail: clamped, bubbles: true, composed: true }));
    }

    _clampWidth(val) {
      return Math.min(this.maxWidth, Math.max(this.minWidth, Number(val) || ACTIONS_DEFAULTS.width));
    }
  }

  // Register Custom Elements globally in the browser's CustomElementRegistry
  if (!customElements.get('acp-chat-panel')) customElements.define('acp-chat-panel', AcpChatPanel);
  if (!customElements.get('acp-dynamic-container')) customElements.define('acp-dynamic-container', AcpDynamicContainer);
  if (!customElements.get('buddy-enrol-workspace-surface')) customElements.define('buddy-enrol-workspace-surface', BuddyEnrolWorkspaceSurface);
  if (!customElements.get('acp-actions-pane')) customElements.define('acp-actions-pane', AcpActionsPane);

  window.AcpChatPanel = AcpChatPanel;
  window.AcpDynamicContainer = AcpDynamicContainer;
  window.BuddyEnrolWorkspaceSurface = BuddyEnrolWorkspaceSurface;
  window.AcpActionsPane = AcpActionsPane;
})();
