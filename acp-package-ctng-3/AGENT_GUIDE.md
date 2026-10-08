# ACP Chat Panel - Universal Application Integration Agent Guide (v0.2.4)

## Goal

Integrate the `@acp/chat-panel` (v0.2.4) package into an application shell so that:
1. The application's existing side navigation has a single AI chat toggle button; create a side panel only when none exists.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The panel provides **in-conversation search**, **chat history switching**, **in-flight thinking indicator**, **cancellation**, and **interactive suggestion chips**.
4. The application's routed content fills the remaining workspace space without internal layout reflow.
5. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel inside the workspace stage.
6. Workspace and Actions panes support **compact rail collapsing (`−`)**, **wide expansion (`⤢`)**, **kebab overflow menus (`⋮`)**, and **one-click rail restore**.
7. The post-commit Action Area (activity log) renders status items and action menus.
8. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables) with fully opaque surfaces.

This guide supports **all Angular versions** (both Standalone Angular 14–19+ and NgModule Angular 4–16).

## v0.2.4 behavior rules

1. Chat starts closed. Do not put `open` on `<acp-chat-panel>` in initial markup and do not open it from an initialization hook.
2. The host application owns exactly one AI Agent/chat toggle button. First locate and reuse the application's existing side navigation, sidebar, navigation rail, side rail, side menu, drawer, or left/right navigation panel, even if it uses a different name. Add the button at the bottom of that existing side panel. Create a new side panel only when the host has no side navigation. Never place the button in or create a top bar, header, toolbar, or other horizontal panel.
3. The host button toggles the chat element's `open` property. The element's close control emits `acp-open-change` with `false`.
4. Opening Chat never opens Workspace or Actions.
5. Workspace opens only after `acp-form-requested` or an equivalent explicit host update. An explicit user close is respected.
6. An activity-bearing `acp-actions-requested` opens Actions beside Workspace. Actions stays open until the user explicitly minimizes or closes it.
7. Chat, Workspace, and Actions are independently resizable. Bind `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` when width state is stored by the host.
8. Workspace and Actions are also resizable in height via a bottom edge and a bottom-right corner grip (width + height). Heights default to the full column; bind `acp-form-height-change` (`formHeight`) and `acp-actions-height-change` (`height`) when height state is stored by the host. Height grips are hidden while a pane is minimized or maximized.
9. Closed elements occupy zero width. Do not reserve fixed-width shell columns around closed elements.

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

### 1.2 Connect to the agent-file-run harness (optional)

When harness integration is requested, complete the configuration below before connecting the chat. Do not leave the URL, token, or agent paths unassigned.

#### Integration agent: required configuration check

1. Inspect the host's environment files and runtime configuration before editing the shell. Preserve supplied settings; apply the local defaults below only where values are missing.
2. Confirm the harness HTTP origin (local default: `http://localhost:4001`), agents checkout location, main agent path, and suggestions agent path. The port belongs in the HTTP origin, not a separate connector setting.
3. If neither runtime configuration nor `AGENT_FILE_RUN_BEARER_TOKEN` supplies a nonblank token, automatically pause setup and ask: "Please set the same bearer token in the harness's AETHERIS_PLAYGROUND_TOKENS and the app's local runtime configuration, then confirm it is configured. Do not paste the token into this chat." Do not request secrets through chat or an agent question tool, invent a token, or proceed with an empty token.
4. Have the user verify locally that the client token matches an allowed harness playground token. Never print either value or commit credentials. `token-abc` below is a placeholder, not a production credential.
5. Keep `OPENROUTER_API_KEY` on the harness server only. Production secrets must use a host-side proxy, not a public frontend bundle.

#### Start the harness

Linux, from the harness checkout:

```bash
cd /path/to/aetheris
mix deps.get
mix compile

export AETHERIS_PLAYGROUND_TOKENS=token-abc
export AETHERIS_AGENTS_ROOT=/path/to/aetheris-agents
export AETHERIS_PROVIDER=openrouter
export OPENROUTER_API_KEY='<use_the_openrouter_api_key_here>'
export CT_BOT_MODEL=openai/gpt-6-luna

mix do app.config + aetheris server --port 4001
```

Replace the API key placeholder locally before running it; in Bash, quote the actual value.

PowerShell, from the harness checkout:

```powershell
cd C:\path\to\aetheris
mix deps.get
mix compile

$env:AETHERIS_PLAYGROUND_TOKENS = "token-abc"
$env:AETHERIS_AGENTS_ROOT = "C:\path\to\aetheris-agents"
$env:AETHERIS_PROVIDER = "openrouter"
$env:OPENROUTER_API_KEY = "<use_the_openrouter_api_key_here>"
$env:CT_BOT_MODEL = "openai/gpt-6-luna"

mix do app.config + aetheris server --port 4001
```

Keep the server terminal open. `AETHERIS_AGENTS_ROOT` must point to the agents checkout root, not its `ct-bot` subfolder. These commands configure five server environment variables.

#### Configure the CampusTrack client

Add these properties to the host's `environment.ts` object (and equivalent build environments), then start or restart the app:

```typescript
AGENT_FILE_RUN_API_URL: 'http://localhost:4001',
AGENT_FILE_RUN_BEARER_TOKEN: 'token-abc',
AGENT_FILE_RUN_AGENT_PATH: 'ct-bot/agents/main.exs',
AGENT_SUGGESTIONS_AGENT_PATH: 'ct-bot/agents/suggestions.exs',
```

Use the actual matching token through untracked local/runtime configuration; do not commit it in an environment file. Both agent paths are relative to `AETHERIS_AGENTS_ROOT`. Agent-internal composition paths belong to the agents checkout/configuration; the connector exposes no composition-path setting. Do not invent environment keys for them.

Import the provided framework-neutral bridge and connect it after the shell elements are mounted. This replaces a separate prompt transport implementation. Use the host's actual environment import path and existing runtime configuration/router:

```typescript
import { connectAcpHarness } from '@acp/chat-panel/harness';
import { environment } from './env/environment';

const connection = connectAcpHarness({
  chat: document.querySelector('acp-chat-panel')!,
  workspace: document.querySelector('acp-dynamic-container')!,
  environment,
  config: {
    getBearerToken: () =>
      (runtimeConfig.agentBearerToken || '').trim() ||
      (environment.AGENT_FILE_RUN_BEARER_TOKEN || '').trim()
  },
  getContext: () => ({ route: router.url, ...(runtimeConfig.hostContext || {}) }),
  onNavigate: (href) => router.navigateByUrl(href)
});
```

The connector reads the four client environment keys above. A `getBearerToken` resolver takes precedence over the environment token, so retain the fallback shown here. The configured service must allow the app origin through CORS and the `aetheris.events.v1` WebSocket subprotocol. `AGENT_HARNESS_WS_URL` is a different legacy chat socket and is not used by this connector. `getContext` can provide app-specific values such as persona and course options. Call `connection.disconnect()` when the shell is destroyed. The connector renders agent-provided form and Buddy workspace surfaces; host applications still own database saves and authorization.

### 1.3 Enable `CUSTOM_ELEMENTS_SCHEMA` in Host Module or Component
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

The markup below is schematic. Do not copy its `<nav>` as a new sidebar: place the chat toggle in the existing host sidebar discovered by the rule below. Preserve the host's own icon component and its classes/colors; the ACP package contains no navigation icon or sidebar styles.
The markup below is schematic. Do not copy its `<nav>` as a new sidebar: place the chat toggle in the existing host sidebar discovered by the rule below. Preserve the host's own icon component and its classes/colors; the ACP package contains no navigation icon or sidebar styles.

When using `connectAcpHarness`, let the connector own `messages`, `pending`, prompt submission, suggestions, and cancellation. Do not also bind host handlers that send the same prompt; use only one transport path.

Place the layout inside your shell template (`app.component.html` or `app-shell.component.html`):

```html
<div class="app-shell">
  <!-- Existing host top chrome is untouched and intentionally omitted. -->
  <div class="app-shell__body">
    <!-- Keep the application's existing vertical sidebar and all its
         navigation markup/icons unchanged. Insert one chat-toggle button
         into that sidebar's existing footer; do not add another <nav>. -->

    <!-- Full-Height ACP Workspace Row -->
    <div class="acp-workspace">
      <!-- Chat Panel Column -->
      <div class="acp-workspace__chat">
        <acp-chat-panel
          [open]="chatOpen"
          [width]="chatWidth"
          [agentDisplay]="agentName"
          (acp-open-change)="onChatOpenChange($event.detail)"
          (acp-width-change)="chatWidth = $event.detail"
          (acp-navigate)="onNavigate($event.detail)"
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
              [formHeight]="workspaceHeight"
              [formSpec]="activeFormSpec"
              (acp-open-change)="workspaceOpen = $event.detail"
              (acp-form-width-change)="workspaceWidth = $event.detail"
              (acp-form-height-change)="workspaceHeight = $event.detail"
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
              [height]="actionsHeight"
              [items]="activityItems"
              [minimized]="actionsMinimized"
              (acp-open-change)="actionsOpen = $event.detail"
              (acp-actions-width-change)="actionsWidth = $event.detail"
              (acp-actions-height-change)="actionsHeight = $event.detail"
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

### Sidebar discovery rule
### Sidebar discovery rule

Before editing the shell, inspect its layout and search for existing vertical
Before editing the shell, inspect its layout and search for existing vertical
navigation under names such as `sidebar`, `sidenav`, `side-nav`, `nav-rail`,
`navigation-rail`, `side-menu`, `drawer`, `menu-panel`, or equivalent
application-specific components and CSS classes. Insert the single AI Agent
Insert the single AI Agent
button into the existing side panel's bottom/footer area, preserving its
markup, icon library, sizing, active state, accessibility, and styling. Do not
replace, recolor, or override the host's navigation icons; verify their normal
contrast in both inactive and active states after adding the chat button.

Do not add the button to a header, top navigation, top toolbar, masthead, or
Do not add the button to a header, top navigation, top toolbar, masthead, or
any horizontal panel. Do not create a second sidebar beside an existing side
panel. Only if no vertical side navigation exists may the host create a new
side panel, and that fallback must contain no new top panel or header.

---

## Step 3: Shell Component Controller
## Step 3: Shell Component Controller

The controller example below demonstrates a host-owned transport only. If using `connectAcpHarness` from Step 1.2, omit its duplicate `onChatMessage` request implementation and let the connector update the chat messages and pending state.

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

The ACP v0.2.4 package retains the advanced window management introduced in v0.2.2:

1. **Minimize (`−`)**: Collapses the pane into a slim vertical rail (`52px` wide) displaying a vertical label and close button.
2. **Maximize (`⤢`)**: Expands that pane to its configured maximum without closing the adjacent pane.
3. **Restore**: Clicking anywhere on a minimized rail's header restores the pane to its standard width.
4. **Kebab Menu (`⋮`)**:
   - On Workspace: provides **"Open Actions"** to view activity log without submitting.
   - On Actions: provides **"Copy all saved names"** (automatically copies saved student names to system clipboard).
5. **Resize**: The right edge resizes width; the bottom edge resizes height; the bottom-right corner grip resizes both. Height is clamped between the pane's minimum (`240px` by default) and the viewport bottom. Leave `formHeight` / `height` unset (`null`) to keep the full column height.

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

- [ ] When harness integration is enabled, the HTTP origin includes the correct port and both agent files resolve relative to the agents checkout root.
- [ ] A missing bearer token pauses integration and prompts for direct local configuration without exposing secrets in chat.
- [ ] The client bearer matches an allowed harness playground token; the model API key remains server-side.
- [ ] With the harness running, a chat prompt completes a file-run request and suggestions use the configured suggestions agent; check CORS/authentication failures if either fails.
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
- [ ] Workspace and Actions resize in height from the bottom edge and in both axes from the corner grip; content scrolls inside the resized pane.
