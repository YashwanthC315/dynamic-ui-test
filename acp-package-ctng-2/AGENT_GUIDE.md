# ACP Chat Panel - Universal Application Integration Agent Guide (v0.2.1)

## Goal

Integrate the `@acp/chat-panel` (v0.2.1) package into an application shell so that:
1. The sidebar has a single AI chat toggle button.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The panel provides **in-conversation search**, **chat history switching**, **in-flight thinking indicator**, **cancellation**, and **interactive suggestion chips**.
4. The application's routed content fills the remaining workspace space without internal layout reflow.
5. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel inside the workspace stage.
6. Workspace and Actions panes support **compact rail collapsing (`−`)**, **wide expansion (`⤢`)**, **kebab overflow menus (`⋮`)**, and **one-click rail restore**.
7. The post-commit Action Area (activity log) renders status items and action menus.
8. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables) with fully opaque surfaces.

This guide supports **all Angular versions** (both Standalone Angular 14–19+ and NgModule Angular 4–16).

## v0.2.1 behavior rules

1. Chat starts closed. Do not put `open` on `<acp-chat-panel>` in initial markup and do not open it from an initialization hook.
2. The host application owns exactly one AI Agent/chat toggle button. Place it at the bottom of the host sidebar; the package does not supply it.
3. The host button toggles the chat element's `open` property. The element's close control emits `acp-open-change` with `false`.
4. Opening Chat never opens Workspace or Actions.
5. Workspace opens only after `acp-form-requested` or an equivalent explicit host update. An explicit user close is respected.
6. An activity-bearing `acp-actions-requested` opens Actions beside Workspace. Actions stays open until the user explicitly minimizes or closes it.
7. Chat, Workspace, and Actions are independently resizable. Bind `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` when width state is stored by the host.
8. Closed elements occupy zero width. Do not reserve fixed-width shell columns around closed elements.

---

## Required Layout Architecture

The workspace row must follow this exact horizontal sequence:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | stage                                            |
| [AI]    | docked next to     | - dynamic form / Buddy workspace (with - / ⤢)    |
| button  | sidebar            | - Actions pane (with - / ⤢ / ⋮)                  |
|         |                    | - routed content (scrolls, no grid reflow)       |
+---------+--------------------+--------------------------------------------------+
```

### Prohibited Layouts (Do NOT do these):
- ❌ **Wrong 1**: `sidebar | routed content | chat on far right` (chat must be on the left of content).
- ❌ **Wrong 2**: Floating dialog, drawer overlay, modal, or CDK overlay.
- ❌ **Wrong 3**: Dynamic forms opening at the far-right edge of the viewport instead of next to chat.
- ❌ **Wrong 4**: Placing the chat inside a routed page component (it must live in the app shell).
- ❌ **Wrong 5**: Replacing or closing Workspace when Actions opens (they are persistent adjacent columns).

---

## Design Tokens Contract

All styling must be driven by design tokens via CSS variables. Never hardcode application colors or sizes in the template.

Map the host application's existing design tokens (or custom values) to the `--acp-*` tokens in your global stylesheet (e.g. `src/styles.css` or `src/styles.scss`):

```css
:root {
  /* Surfaces & Backgrounds (MUST BE OPAQUE - NO TRANSPARENCY) */
  --acp-surface-bg: var(--app-surface, #ffffff);
  --acp-panel-bg: var(--app-panel-bg, #f5f7fb);
  --acp-header-bg: var(--app-header-bg, #ffffff);
  --acp-stage-bg: var(--app-stage-bg, #ffffff);
  --acp-bubble-user-bg: var(--app-primary-light, #eaf0fa);
  --acp-bubble-agent-bg: var(--app-surface, #ffffff);
  --acp-input-bg: var(--app-surface, #ffffff);
  --acp-rail-bg: var(--app-panel-bg, #f8fafc);
  --acp-rail-hover-bg: #eef1f5;

  /* Typography & Colors */
  --acp-text-primary: var(--app-text-primary, #173b70);
  --acp-text-secondary: var(--app-text-secondary, #6d7f99);
  --acp-text-muted: var(--app-text-muted, #7888a0);
  --acp-text-on-primary: #ffffff;
  --acp-font-family: var(--app-font-family, -apple-system, BlinkMacSystemFont, Arial, sans-serif);

  /* Borders & Radii */
  --acp-border-color: var(--app-border, #d8dfeb);
  --acp-border-radius-sm: 4px;
  --acp-border-radius-md: 6px;
  --acp-border-radius-lg: 8px;
  --acp-border-radius-pill: 9999px;

  /* Primary Accent & Focus */
  --acp-primary-accent: var(--app-primary, #173b70);
  --acp-primary-hover: var(--app-primary-hover, #122d56);
  --acp-primary-light: #e4edfc;
  --acp-focus-ring: 0 0 0 2px rgba(23, 59, 112, 0.25);

  /* Status & Action Area Tones */
  --acp-status-success: var(--app-success, #2e7d32);
  --acp-status-success-bg: #f1f8f1;
  --acp-status-warning: var(--app-warning, #b8860b);
  --acp-status-warning-bg: #fdf8ee;
  --acp-status-error: var(--app-danger, #c62828);
  --acp-status-error-bg: #fdf1f1;
  --acp-status-info: var(--app-info, #4670b8);
  --acp-status-info-bg: #f0f4fa;

  /* Shell & Rails */
  --acp-app-header-height: var(--app-header-height, 42px);
  --acp-rail-width: 52px;
}
```

### Opaque Surface Protection (Global Rule)
Add this override in your global stylesheet to guarantee no see-through surfaces:

```css
.acp-workspace__form,
.acp-workspace__form .acp-container,
acp-dynamic-container {
  background-color: var(--acp-stage-bg) !important;
  color: var(--acp-text-primary) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

---

## Step 1: Package Registration & Schema

The package exports standard **Web Components (Custom Elements)**. It works in any Angular version without framework version mismatch.

### 1.1 Import Bundle in App Entrypoint (`src/main.ts`)
```typescript
import '@acp/chat-panel';
```

### 1.2 Enable `CUSTOM_ELEMENTS_SCHEMA` in Host Module or Component
```typescript
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  declarations: [AppShellComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

---

## Step 2: App Shell Template Composition

Place the layout inside your shell template (`app.component.html` or `app-shell.component.html`):

```html
<div class="app-shell">
  <!-- 1. Host Header -->
  <header class="app-header">
    <div class="logo">App</div>
  </header>

  <!-- 2. Shell Body -->
  <div class="app-shell__body">
    <!-- 2a. Host Sidebar with AI Toggle -->
    <nav class="app-sidebar">
      <button
        type="button"
        class="nav-item nav-item--ai"
        [class.active]="chatOpen"
        (click)="onChatOpenChange(!chatOpen)"
        aria-label="Toggle AI Agent"
      >
        <span class="nav-icon">🤖</span>
        <span class="nav-label">AI Agent</span>
      </button>
    </nav>

    <!-- 2b. Full-Height ACP Workspace Row -->
    <div class="acp-workspace">
      <!-- Chat Panel Column -->
      <div class="acp-workspace__chat">
        <acp-chat-panel
          [open]="chatOpen"
          [width]="chatWidth"
          [agentDisplay]="agentName"
          [pending]="isPending"
          [messages]="messages"
          [chatHistory]="chatHistory"
          (acp-open-change)="onChatOpenChange($event.detail)"
          (acp-width-change)="chatWidth = $event.detail"
          (acp-new-chat)="onNewChat()"
          (acp-message-sent)="onChatMessage($event.detail)"
          (acp-suggestion-click)="onSuggestionClick($event.detail)"
          (acp-navigate)="onNavigate($event.detail)"
          (acp-cancel-request)="onCancelRequest()"
          (acp-restore-conversation)="onRestoreConversation($event.detail)"
          (acp-form-requested)="onFormRequested($event.detail)"
        ></acp-chat-panel>
      </div>

      <!-- Stage Column (Routed Content + Persistent Surfaces) -->
      <section class="acp-workspace__stage">
        <!-- Main Content Outlet -->
        <main class="acp-workspace__content">
          <router-outlet></router-outlet>
        </main>

        <!-- Persistent Surface Layer -->
        <div class="acp-workspace__surface-layer">
          <!-- Dynamic Workspace / Surface -->
          <div
            class="acp-workspace__surface"
            [class.acp-workspace-rail]="workspaceMinimized"
          >
            <acp-dynamic-container
              [open]="workspaceOpen"
              [minimized]="workspaceMinimized"
              [formWidth]="workspaceWidth"
              [formSpec]="activeFormSpec"
              (acp-open-change)="workspaceOpen = $event.detail"
              (acp-form-width-change)="workspaceWidth = $event.detail"
              (acp-open-actions)="openActionsPane()"
              (acp-workspace-maximize)="onWorkspaceMaximize()"
              (acp-restore-default-split)="restoreDefaultSplit()"
              (acp-submitted)="onFormSubmitted($event.detail)"
              (acp-actions-requested)="onActionsRequested($event.detail)"
            ></acp-dynamic-container>

            <!-- Or Buddy Student Enrollment Workspace:
            <buddy-enrol-workspace-surface
              (buddy-parse)="onBuddyParse($event.detail)"
              (buddy-check)="onBuddyCheck($event.detail)"
              (buddy-submit)="onBuddySubmit($event.detail)"
              (buddy-submit-all)="onBuddySubmitAll($event.detail)"
              (acp-actions-requested)="onActionsRequested($event.detail)"
            ></buddy-enrol-workspace-surface>
            -->
          </div>

          <!-- Actions Pane (Activity Log) -->
          <div
            class="acp-workspace__actions"
            [class.acp-actions-rail]="actionsMinimized"
          >
            <acp-actions-pane
              [open]="actionsOpen"
              [width]="actionsWidth"
              [items]="activityItems"
              [minimized]="actionsMinimized"
              (acp-open-change)="actionsOpen = $event.detail"
              (acp-actions-width-change)="actionsWidth = $event.detail"
              (acp-actions-close)="actionsOpen = false"
              (acp-action-click)="onActionClick($event.detail)"
              (acp-restore-default-split)="restoreDefaultSplit()"
            ></acp-actions-pane>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
```

---

## Step 3: Shell Component Controller

```typescript
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  AcpChatMessage,
  AcpChatHistoryItem,
  AcpActivityItem,
  AcpFormSpec
} from '@acp/chat-panel';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit {
  // Default/initial state: all three panels start closed. The sidebar's
  // AI toggle button is the only way to open the chat panel.
  chatOpen = false;
  chatWidth = 380;
  agentName = 'Assistant';
  isPending = false;

  workspaceOpen = false;
  workspaceWidth = 540;
  workspaceMinimized = false;
  actionsOpen = false;
  actionsWidth = 280;
  actionsMinimized = false;

  activeFormSpec: AcpFormSpec | null = null;
  activityItems: AcpActivityItem[] = [];
  chatHistory: AcpChatHistoryItem[] = [];

  messages: AcpChatMessage[] = [
    {
      id: 'intro',
      role: 'assistant',
      text: "Hello! How can I assist you with your operations today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      blocks: [
        {
          type: 'text',
          text: "Hello! How can I assist you with your operations today?"
        },
        {
          type: 'suggestions',
          suggestions: [
            {
              id: 'sug-1',
              label: 'Enroll student',
              action: { id: 'act-1', label: 'Enroll student', payload: { type: 'internal.prompt', prompt: 'Enroll student' } }
            },
            {
              id: 'sug-2',
              label: 'View transactions',
              action: { id: 'act-2', label: 'View transactions', payload: { type: 'navigate', href: '/fees/transactions' } }
            }
          ]
        }
      ]
    }
  ];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadChatHistory();
  }

  loadChatHistory() {
    this.http.get<AcpChatHistoryItem[]>('/api/conversations').subscribe({
      next: (list) => this.chatHistory = list,
      error: () => {}
    });
  }

  onNewChat() {
    this.messages = [];
  }

  onChatOpenChange(open: boolean) {
    this.chatOpen = open;
  }

  onChatMessage(text: string) {
    const userMsg: AcpChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.messages = [...this.messages, userMsg];
    this.isPending = true;

    this.http.post<any>('/api/agent/chat', {
      userText: text,
      route: this.router.url
    }).subscribe({
      next: (reply) => {
        this.isPending = false;
        this.messages = [
          ...this.messages,
          {
            id: `reply-${Date.now()}`,
            role: 'assistant',
            text: reply.text,
            blocks: reply.blocks,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      },
      error: () => {
        this.isPending = false;
        this.messages = [
          ...this.messages,
          {
            id: `err-${Date.now()}`,
            role: 'error',
            text: 'Failed to reach agent service.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      }
    });
  }

  onSuggestionClick(detail: any) {
    const sug = detail.suggestion;
    if (sug && sug.action && sug.action.payload && sug.action.payload.type === 'navigate') {
      this.router.navigateByUrl(sug.action.payload.href);
    }
  }

  onNavigate(detail: { href: string }) {
    this.router.navigateByUrl(detail.href);
  }

  onCancelRequest() {
    this.isPending = false;
  }

  onRestoreConversation(detail: { conversationId: string }) {
    this.http.get<any>(`/api/conversations/${detail.conversationId}`).subscribe((data) => {
      this.messages = data.messages || [];
    });
  }

  onFormRequested(detail: { formSpec: AcpFormSpec }) {
    this.activeFormSpec = detail.formSpec;
    this.workspaceOpen = true;
    this.workspaceMinimized = false;
  }

  openActionsPane() {
    this.actionsOpen = true;
    this.actionsMinimized = false;
  }

  onWorkspaceMaximize() {
    // Optional host persistence/analytics hook. Actions remains unchanged.
  }

  restoreDefaultSplit() {
    this.workspaceMinimized = false;
    this.actionsMinimized = false;
  }

  onFormSubmitted(detail: any) {
    // Keep Workspace open so the user can review or edit the submitted data.
  }

  onActionsRequested(detail: { open: boolean; item: AcpActivityItem }) {
    this.actionsOpen = true;
    this.actionsMinimized = false;
    this.activityItems = [detail.item, ...this.activityItems];
  }

  onActionClick(detail: { item: AcpActivityItem; actionId: string }) {
    if (detail.actionId === 'focus_record') {
      // Handle record focus
    }
  }
}
```

---

## Step 4: Window Management (Rails & Restore)

The ACP v0.2.1 package incorporates advanced window management:

1. **Minimize (`−`)**: Collapses the pane into a slim vertical rail (`52px` wide) displaying a vertical label and close button.
2. **Maximize (`⤢`)**: Expands that pane to its configured maximum without closing the adjacent pane.
3. **Restore**: Clicking anywhere on a minimized rail's header restores the pane to its standard width.
4. **Kebab Menu (`⋮`)**:
   - On Workspace: provides **"Open Actions"** to view activity log without submitting.
   - On Actions: provides **"Copy all saved names"** (automatically copies saved student names to system clipboard).

### Default/Initial State

On first load — before the user clicks the sidebar's AI toggle — **all three
surfaces (chat, Workspace, Actions) must be closed**: `chatOpen`,
`workspaceOpen`, and `actionsOpen` all start `false`. Do not set `chatOpen =
true` (or persist any of these flags in eagerly-loaded state) — the sidebar
button is the only trigger that should open the chat panel.

### Independent Close State

Each custom element owns its `open` state. Closing Chat must not close or
minimize Workspace or Actions. Closing Workspace must not close Actions, and
Actions remains visible until its own close control is used. Keep all three
elements mounted so sibling request events can reach them; the package makes a
closed element zero width.

### Reflow on Open/Close/Minimize

Keep the wrappers mounted and let each element's `open` property control
visibility. Do not give wrappers fixed `width`, `min-width`, or `flex-basis`.
The package collapses closed elements to zero and minimized elements to the
tokenized rail width.

---

## Step 5: Verification Checklist

- [ ] Chat panel renders docked next to sidebar and fills full viewport height (`100%`).
- [ ] Composer stays anchored to the bottom.
- [ ] In-flight thinking indicator pill (`Thinking...`) appears when `[pending]="true"`.
- [ ] In-conversation search filters messages in real time.
- [ ] History button opens recent conversations dropdown.
- [ ] Suggestion chips render with `→` icon and fire actions on click.
- [ ] Dynamic forms and Buddy workspace open in stage overlay without replacing router content.
- [ ] Minimize (`−`) collapses panes into rails with vertical text.
- [ ] Actions pane renders status items with kind tints (`success`, `warning`, `error`, `info`).
- [ ] Kebab menu allows copying all saved names to clipboard.
- [ ] All colors derive from `--acp-*` design tokens with opaque backgrounds.
- [ ] On initial app load, the AI Agent, Workspace, and Actions panels are all **closed** (nothing auto-opens).
- [ ] The Send button is visible and clickable at the default chat width and after resizing to the minimum width.
- [ ] Closing Chat does not implicitly close Workspace or Actions; each pane's close button controls its own state.
- [ ] Minimizing Workspace or Actions reclaims the freed width immediately — no residual empty space in the stage.
- [ ] Opening, closing, and minimizing any pane reflows the layout without a manual resize/refresh.
