# ACP Chat Panel - Universal Application Integration Agent Guide (v0.2.5)

## Goal

Integrate the `@acp/chat-panel` (v0.2.5) package into an application shell so that:
1. The application's existing side navigation has a single AI chat toggle button; create a side panel only when none exists.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The panel connects to the **Agent Harness** via `@acp/chat-panel/harness`, providing real-time streaming replies, suggestion chips, conversation history, cancellation, and in-conversation search.
4. The application's routed content fills the remaining workspace space without internal layout reflow.
5. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel inside the workspace stage.
6. Workspace and Assembler panes support **compact rail collapsing (`−`)**, **wide expansion (`⤢`)**, **kebab overflow menus (`⋮`)**, and **one-click rail restore**.
7. The post-commit Assembler (activity log) renders status items and action menus.
8. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables) with fully opaque surfaces.

This guide supports **all Angular versions** (both Standalone Angular 14–19+ and NgModule Angular 4–16).

---

## v0.2.5 behavior rules

1. **Chat starts closed**: Do not put `open` on `<acp-chat-panel>` in initial markup and do not open it from an initialization hook.
2. **Single toggle button**: The host application owns exactly one AI Agent/chat toggle button. First locate and reuse the application's existing side navigation, sidebar, navigation rail, side rail, side menu, drawer, or left/right navigation panel, even if it uses a different name. Add the button at the bottom of that existing side panel. Create a new side panel only when the host has no side navigation. Never place the button in or create a top bar, header, toolbar, or other horizontal panel.
3. **Open toggle control**: The host button toggles the chat element's `open` property. The element's close control emits `acp-open-change` with `false`.
4. **Chat independent of Workspace/Actions**: Opening Chat never opens Workspace or Actions.
5. **Workspace opens on request**: Workspace opens only after `acp-form-requested`, harness surface detection, or an equivalent explicit host update. An explicit user close is respected.
6. **Assembler is independent**: An activity-bearing `acp-actions-requested`, `acp-open-actions`, or harness `activity-log` surface opens the Assembler beside Workspace. It stays open until the user explicitly minimizes or closes it.
7. **Independent pane resizing**: Chat, Workspace, and Actions are independently resizable. Bind `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` when width state is stored by the host.
8. **Height resizing**: Workspace and Actions are also resizable in height via a bottom edge and a bottom-right corner grip (width + height). Heights default to the full column; bind `acp-form-height-change` (`formHeight`) and `acp-actions-height-change` (`height`) when height state is stored by the host. Height grips are hidden while a pane is minimized or maximized.
9. **Zero width when closed**: Closed elements occupy zero width. Do not reserve fixed-width shell columns around closed elements.
10. **Harness connection ownership**: When using `connectAcpHarness`, the connector owns message history, pending states, streaming replies, suggestion chips, and surface dispatching. The host **must not** bind `[messages]`, `[pending]`, or `(acp-message-sent)` in the template, as doing so overrides live responses with static data.

---

## Required Layout Architecture

The workspace row must follow this exact horizontal sequence:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | stage                                            |
| [AI]    | docked next to     | - dynamic form / Buddy workspace (with - / ⤢)    |
| button  | sidebar            | - Assembler pane (with - / ⤢ / ⋮)                 |
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

## Step 1: Package Registration & Harness Configuration

The package exports standard **Web Components (Custom Elements)** and a framework-agnostic **Harness Bridge (`@acp/chat-panel/harness`)**.

### 1.1 Import Bundle in App Entrypoint (`src/main.ts`)
```typescript
import '@acp/chat-panel';
```

### 1.2 Configure Client Environment (`src/environments/environment.ts`)
Ensure your environment file exports the file-run harness variables required by `@acp/chat-panel/harness`:

```typescript
export const environment = {
  production: false,
  // Other app config...

  // Agent File-Run Harness endpoints:
  AGENT_FILE_RUN_API_URL: 'http://localhost:4001',
  AGENT_FILE_RUN_BEARER_TOKEN: 'your-bearer-token',
  AGENT_FILE_RUN_AGENT_PATH: 'ct-bot/agents/main.exs',
  AGENT_SUGGESTIONS_AGENT_PATH: 'ct-bot/agents/suggestions.exs'
};
```

> **Security Note:** Do not commit production secrets to Git. Use untracked environment overrides (e.g. `environment.local.ts`) or pass tokens via runtime configuration (`getBearerToken`).

### 1.3 Start the Agent Harness Server

**Linux/macOS:**
```bash
cd /path/to/aetheris
mix deps.get
mix compile

export AETHERIS_PLAYGROUND_TOKENS=your-bearer-token
export AETHERIS_AGENTS_ROOT=/path/to/aetheris-agents
export AETHERIS_PROVIDER=openrouter
export OPENROUTER_API_KEY='<your_openrouter_api_key>'
export CT_BOT_MODEL=openai/gpt-4o

mix do app.config + aetheris server --port 4001
```

**Windows PowerShell:**
```powershell
cd C:\path\to\aetheris
mix deps.get
mix compile

$env:AETHERIS_PLAYGROUND_TOKENS = "your-bearer-token"
$env:AETHERIS_AGENTS_ROOT = "C:\path\to\aetheris-agents"
$env:AETHERIS_PROVIDER = "openrouter"
$env:OPENROUTER_API_KEY = "<your_openrouter_api_key>"
$env:CT_BOT_MODEL = "openai/gpt-4o"

mix do app.config + aetheris server --port 4001
```

### 1.4 Enable `CUSTOM_ELEMENTS_SCHEMA` in Host Module or Component
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

### Crucial Rule: Do NOT Bind Messages When Using Harness Bridge
When using `connectAcpHarness`, the connector **directly manages** `chat.messages`, `chat.pending`, and `chat.chatHistory` on the DOM element.
- ❌ **Do NOT write:** `[messages]="messages"` (Angular change detection will overwrite live responses with the host's static array!).
- ❌ **Do NOT write:** `[pending]="isPending"`.
- ❌ **Do NOT write:** `(acp-message-sent)="onChatMessage($event)"` (This would bypass or duplicate the harness request!).

Only bind shell layout state, open flags, width, and navigation:

```html
<div class="app-shell">
  <!-- Existing host top chrome is untouched and intentionally omitted. -->
  <div class="app-shell__body">
    <!-- EXISTING host side navigation with AI Toggle inserted at its bottom.
         Reuse the host's actual element and classes; do not create this nav if
         a sidebar, side rail, drawer, side menu, or navigation panel exists. -->
    <nav class="app-sidebar">
      <!-- Existing host navigation items remain here, unchanged. -->
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

    <!-- Full-Height ACP Workspace Row -->
    <div class="acp-workspace">
      <!-- Chat Panel Column -->
      <div class="acp-workspace__chat">
        <acp-chat-panel
          #chatPanel
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
              #dynamicWorkspace
              [open]="workspaceOpen"
              [minimized]="workspaceMinimized"
              [formWidth]="workspaceWidth"
              [formHeight]="workspaceHeight"
              (acp-open-change)="workspaceOpen = $event.detail"
              (acp-form-width-change)="workspaceWidth = $event.detail"
              (acp-form-height-change)="workspaceHeight = $event.detail"
              (acp-open-actions)="openActionsPane()"
              (acp-workspace-maximize)="onWorkspaceMaximize()"
              (acp-restore-default-split)="restoreDefaultSplit()"
              (acp-submitted)="onFormSubmitted($event.detail)"
              (acp-actions-requested)="onActionsRequested($event.detail)"
            ></acp-dynamic-container>
          </div>

          <!-- Assembler Pane (Activity Log) -->
          <div
            class="acp-workspace__actions"
            [class.acp-actions-rail]="actionsMinimized"
          >
            <acp-actions-pane
              title="Assembler"
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

### Sidebar Discovery Rule

Before editing the shell, inspect its layout and search for existing vertical navigation under names such as `sidebar`, `sidenav`, `side-nav`, `nav-rail`, `navigation-rail`, `side-menu`, `drawer`, `menu-panel`, or equivalent application-specific components and CSS classes. Insert the single AI Agent button into the existing side panel's bottom/footer area, preserving its markup, icon library, sizing, active state, accessibility, and styling.

Do not add the button to a header, top navigation, top toolbar, masthead, or any horizontal panel. Do not create a second sidebar beside an existing side panel. Only if no vertical side navigation exists may the host create a new side panel, and that fallback must contain no new top panel or header.

---

## Step 3: Shell Component Controller

Initialize `connectAcpHarness` inside Angular's `ngAfterViewInit` lifecycle hook so the DOM elements are guaranteed to be mounted:

```typescript
import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { connectAcpHarness, AcpHarnessConnection } from '@acp/chat-panel/harness';
import { AcpActivityItem } from '@acp/chat-panel';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements AfterViewInit, OnDestroy {
  // Chat panel layout state: starts closed
  chatOpen = false;
  chatWidth = 380;
  agentName = 'Assistant';

  // Workspace and Assembler pane layout state
  workspaceOpen = false;
  workspaceWidth = 540;
  workspaceHeight: number | null = null;
  workspaceMinimized = false;

  actionsOpen = false;
  actionsWidth = 280;
  actionsHeight: number | null = null;
  actionsMinimized = false;

  activityItems: AcpActivityItem[] = [];

  private harnessConnection: AcpHarnessConnection | null = null;

  constructor(private router: Router) {}

  ngAfterViewInit() {
    // Locate the custom elements after the DOM view has initialized
    const chatEl = document.querySelector('acp-chat-panel') as HTMLElement & {
      messages?: any[];
      chatHistory?: any[];
      pending?: boolean;
    };
    const workspaceEl = document.querySelector('acp-dynamic-container') as HTMLElement & {
      open?: boolean;
      formSpec?: any;
      close?: () => void;
    };
    const assemblerEl = document.querySelector('acp-actions-pane') as HTMLElement & {
      open?: boolean;
      title?: string;
      items?: any[];
      menuActions?: any[];
    };

    if (chatEl) {
      // Connect to the Agent Harness Bridge
      this.harnessConnection = connectAcpHarness({
        chat: chatEl,
        workspace: workspaceEl,
        actions: assemblerEl,
        environment,
        config: {
          getBearerToken: () => (environment.AGENT_FILE_RUN_BEARER_TOKEN || '').trim()
        },
        getContext: () => ({
          route: this.router.url
        }),
        onNavigate: (href: string) => {
          this.router.navigateByUrl(href);
        },
        onSurface: (surface: any) => {
          if (surface && surface.type === 'activity-log') {
            this.activityItems = Array.isArray(surface.items) ? surface.items : [];
            this.actionsOpen = true;
            this.actionsMinimized = false;
          } else if (surface && surface.title) {
            // The package renders generic information; hosts can add richer domain rendering here.
            this.workspaceOpen = true;
            this.workspaceMinimized = false;
          }
        }
      });
    }
  }

  ngOnDestroy() {
    // Clean up event listeners and ongoing runs when the shell is destroyed
    if (this.harnessConnection) {
      this.harnessConnection.disconnect();
      this.harnessConnection = null;
    }
  }

  onChatOpenChange(open: boolean) {
    this.chatOpen = open;
  }

  onNavigate(detail: { href: string }) {
    this.router.navigateByUrl(detail.href);
  }

  openActionsPane() {
    this.actionsOpen = true;
    this.actionsMinimized = false;
  }

  onWorkspaceMaximize() {
    // Optional persistence hook
  }

  restoreDefaultSplit() {
    this.workspaceMinimized = false;
    this.actionsMinimized = false;
  }

  onFormSubmitted(detail: any) {
    // Keep Workspace open for user review
  }

  onActionsRequested(detail: { open: boolean; item: AcpActivityItem }) {
    this.actionsOpen = true;
    this.actionsMinimized = false;
    this.activityItems = [detail.item, ...this.activityItems];
  }

  onActionClick(detail: { item: AcpActivityItem; actionId: string }) {
    // Host-specific action handling
  }
}
```

---

## Step 4: Window Management (Rails & Restore)

The ACP v0.2.5 package retains advanced window management:

1. **Minimize (`−`)**: Collapses the pane into a slim vertical rail (`52px` wide) displaying a vertical label and close button.
2. **Maximize (`⤢`)**: Expands that pane to its configured maximum without closing the adjacent pane.
3. **Restore**: Clicking anywhere on a minimized rail's header restores the pane to its standard width.
4. **Kebab Menu (`⋮`)**:
   - On Workspace: provides **"Open Actions"** to view activity log without submitting.
   - On Actions: provides **"Copy all saved names"** (automatically copies saved student names to system clipboard).
5. **Resize**: The right edge resizes width; the bottom edge resizes height; the bottom-right corner grip resizes both. Height is clamped between the pane's minimum (`240px` by default) and the viewport bottom. Leave `formHeight` / `height` unset (`null`) to keep the full column height.

### Initial / Close State
- All three surfaces start **closed** (`chatOpen = false`, `workspaceOpen = false`, `actionsOpen = false`).
- Each custom element owns its `open` state. Closing Chat does not close Workspace or Actions.

---

## Step 5: Troubleshooting & Verification Checklist

### Common Pitfall: Why are messages generic or not reaching the harness?

| Symptom | Cause | Solution |
|---|---|---|
| Chat shows only canned introductory text ("Hello! How can I assist you...") | `[messages]="messages"` is bound in the template HTML. | Remove `[messages]` and `[pending]` from `<acp-chat-panel>`. Let `connectAcpHarness` own message state. |
| Chat does not respond to user input or calls `/api/agent/chat` | `(acp-message-sent)` is bound to a mock method. | Remove `(acp-message-sent)` from `<acp-chat-panel>`. The bridge automatically captures `acp-message-sent` events. |
| Console error: `TypeError: connectAcpHarness requires an acp-chat-panel element` | `connectAcpHarness` was called in `ngOnInit()` before DOM was rendered. | Move `connectAcpHarness` call into `ngAfterViewInit()`. |
| Chat displays `Agent service is not configured.` | Missing `AGENT_FILE_RUN_BEARER_TOKEN` or `AGENT_FILE_RUN_AGENT_PATH`. | Configure non-empty token and agent path in `environment.ts` or `config.getBearerToken`. |
| Chat displays `Agent reply WebSocket failed.` | The harness server (port 4001) is not running or CORS rejected the connection. | Start the harness server (`mix do app.config + aetheris server --port 4001`) and verify origins. |

### Verification Checklist
- [ ] In `environment.ts`, `AGENT_FILE_RUN_API_URL` (e.g. `http://localhost:4001`), `AGENT_FILE_RUN_BEARER_TOKEN`, and `AGENT_FILE_RUN_AGENT_PATH` are configured.
- [ ] The harness server is running on the configured port.
- [ ] `connectAcpHarness` is initialized inside `ngAfterViewInit()` and disconnected in `ngOnDestroy()`.
- [ ] In template HTML, `<acp-chat-panel>` has **NO** `[messages]`, `[pending]`, or `(acp-message-sent)` bindings.
- [ ] Sending a message in the chat panel triggers a prompt in the harness and renders live assistant text blocks.
- [ ] Suggestion chips appear and click actions route or prompt correctly.
- [ ] Chat panel renders docked next to sidebar and fills full viewport height (`100%`).
- [ ] On initial load, Chat, Workspace, and Actions all start closed.
