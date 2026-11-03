# ACP Chat Panel - Universal Application Integration Agent Guide (v0.3.0)

## Mandatory Execution Order and Evidence

Read [INTEGRATION_SPEC.md](./INTEGRATION_SPEC.md) first and implement its sections 1 through 15 in order. Each numbered rule is mandatory; use section 16 as the acceptance checklist. This guide supplies the concrete wiring, not permission to omit rules. Do not infer credentials, endpoints, navigation placement, or persistence.

For this release the package has been prepared without running tests, builds, browsers, authenticated requests, or a harness server, at the request of the package owner. Integration acceptance remains pending the owner's manual checks. Do not describe an unchecked checklist as passed. A later integration request normally includes build/UI checks unless that user also prohibits them.

### v0.3.0 Upgrade Procedure

1. Install `acp-chat-panel-0.3.0.tgz`; do not edit an older release directory or add a second instance of any element. Preserve existing configuration values and secrets.
2. Keep all three elements mounted for the entire shell lifetime. Do not use `*ngIf`, changing `key` values, `innerHTML`, or destroy/recreate logic for pane visibility, dimensions, minimized state, or menus.
3. Bind dimensions only to the numeric properties/events shown below. Never reassign `formSpec`, `surface`, `initialValues`, `records`, or `buddyText` from a resize handler. Never use a resize callback to reconnect the harness or replay an agent response.
4. Workspace width, height, corner drag, keyboard resize, minimize/restore, maximize/restore, menu changes, and close/reopen retain the mounted form body. They must preserve raw text, structured fields, selected record, validation flags, parse/check state, focus, selection, and body scroll during dimension-only updates. Only an intentional new form/surface replaces form content. An equivalent form spec is not a reset instruction.
5. Do not assign `workspaceOpen = true` in a generic response callback. The connector respects `workspace.explicitlyClosed`; synchronize host state from the actual element as demonstrated below. Only an explicit host/user reopen may set `workspace.open = true` after a user close.
6. Do not open Assembler from Workspace open/resize/restore events. Use only an activity-bearing `acp-actions-requested`, `acp-open-actions`, or an `activity-log` surface. Prepend activity items; `activity-log` replaces the list and un-minimizes the Assembler.
7. Run the manual acceptance procedure at the end of this guide during integration. Record each result as passed, failed, or pending, with reasons. Never claim live streaming, history, opacity, or saves were verified by reading code alone.

## Goal

Integrate the `@acp/chat-panel` (v0.3.0) package into an application shell so that:
1. The application's existing side navigation has a single AI chat toggle button; create a side panel only when none exists.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The panel connects to the **Agent Harness** via `@acp/chat-panel/harness`, providing real-time streaming replies, suggestion chips, conversation history, cancellation, and in-conversation search.
4. The application's routed content remains full width beneath Workspace and Assembler and does not shift when either pane opens.
5. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel, over the routed content inside the workspace stage.
6. Workspace and Assembler panes support **compact rail collapsing (`−`)**, **wide expansion (`⤢`)**, **kebab overflow menus (`⋮`)**, and **one-click rail restore**.
7. The post-commit Assembler (activity log) renders status items and action menus.
8. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables) with fully opaque surfaces.

This guide supports **all Angular versions** (both Standalone Angular 14–19+ and NgModule Angular 4–16).

---

## Required Behavior Rules

1. **Chat starts closed**: Do not put `open` on `<acp-chat-panel>` in initial markup and do not open it from an initialization hook.
2. **Single toggle button**: The host application owns exactly one AI Agent/chat toggle button. First locate and reuse the application's existing side navigation, sidebar, navigation rail, side rail, side menu, drawer, or left/right navigation panel, even if it uses a different name. Add the button at the bottom of that existing side panel. Create a new side panel only when the host has no side navigation. Never place the button in or create a top bar, header, toolbar, or other horizontal panel.
3. **Open toggle control**: The host button toggles the chat element's `open` property. The element's close control emits `acp-open-change` with `false`.
4. **Chat independent of Workspace/Assembler**: Opening Chat never opens Workspace or Assembler.
5. **Workspace opens on request**: Workspace opens only after `acp-form-requested`, harness surface detection, or an equivalent explicit host update. An explicit user close is respected.
6. **Assembler is independent**: An activity-bearing `acp-actions-requested`, `acp-open-actions`, or harness `activity-log` surface opens the Assembler beside Workspace. It stays open until the user explicitly minimizes or closes it.
7. **Independent pane resizing**: Chat, Workspace, and Assembler are independently resizable. Bind `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` when width state is stored by the host.
8. **Height resizing**: Workspace and Actions are also resizable in height via a bottom edge and a bottom-right corner grip (width + height). Heights default to the full column; bind `acp-form-height-change` (`formHeight`) and `acp-actions-height-change` (`height`) when height state is stored by the host. Height grips are hidden while a pane is minimized or maximized.
9. **Zero width when closed**: Closed elements occupy zero width. Do not reserve fixed-width shell columns around closed elements.
10. **Harness connection ownership**: When using `connectAcpHarness`, the connector owns message history, pending states, streaming replies, suggestion chips, and surface dispatching. The host **must not** bind `[messages]`, `[pending]`, or `(acp-message-sent)` in the template, as doing so overrides live responses with static data.
11. **Harness-backed conversation history**: Provide the authenticated user's stable owner id through `config.ownerId` or `config.getOwnerId`. The connector lists and restores threads through the Agent File Run harness and sends `owner_id`/`thread_id` with each run. Do not use browser storage as the conversation source of truth.
12. **Stable Workspace identity**: The Workspace header reads `Workspace`; never derive it from the prompt, form spec, or response surface title. Those titles may label content inside Workspace but do not rename its pane.
13. **Stable dock order**: Keep `.acp-workspace__chat` before `.acp-workspace__stage` in the shell row. Package styles enforce this order, and the Workspace/Assembler surface layer starts at the stage's left edge so Workspace opens directly beside Chat.
14. **Form submission gating**: Standard forms start with greyed-out Submit while required fields are invalid. Enrollment records require explicit `valid: true` and complete required fields. Raw-text edits require reparsing; structured field edits and Clear require revalidation, not reparsing unchanged raw text. Validation-only echoes preserve current values. Parsing/checking keeps Submit disabled; Submit All requires every record to pass. Valid submission opens Assembler through the existing activity event. Never override disabled buttons or bypass submission guards in the host.
15. **History after refresh**: The connector refreshes owner-scoped harness threads at startup and each panel reopen. Prefer `config.getOwnerId`; without explicit owner configuration, authenticated `context.host.userId` or `context.userId` is used. If authentication resolves while Chat stays open, call `connection.refreshHistory()` from that callback. Keep the connector alive across panel toggles and call `disconnect()` only when unmounting it. Do not replace history with static bindings or browser storage.
16. **Host-owned persistence is not an integration prerequisite**: `acp-submitted`, `buddy-submit`, and `buddy-submit-all` only report requested values; they do not call application APIs or confirm persistence. Reuse an existing authorized domain service when available. If no save path exists, continue editing and integrating the installed package without asking for approval to defer persistence. Wire the events to explicit non-persisting host handlers, keep Workspace open, and report persistence as unwired in the final handoff. Do not invent an endpoint, silently discard submissions, or display “Saved”/success without server confirmation.

### Integration Execution Policy

An integration request authorizes the necessary host file changes: imports, global styles, shell markup, launch control, event handlers, and connector setup. Perform those changes and run available build and local UI checks even when a domain save API or runtime credentials are unavailable. Missing backend setup must not cause a no-files-changed response. Clearly distinguish completed integration from unverified authenticated requests and unwired persistence in the final handoff. Ask a blocking question only when a required decision prevents the file changes themselves.

---

## Required Layout Architecture

The workspace row must follow this exact horizontal sequence:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | stage (routed content remains full width)        |
| [AI]    | docked next to     | - Workspace / Assembler overlay routed content  |
| button  | sidebar            |   and open beside Chat (with - / ⤢ / ⋮)           |
|         |                    | - routed content stays in place underneath       |
+---------+--------------------+--------------------------------------------------+
```

### Prohibited Layouts (Do NOT do these):
- ❌ **Wrong 1**: `sidebar | routed content | chat on far right` (chat must be on the left of content).
- ❌ **Wrong 2**: Floating dialog, viewport-level drawer, modal, or CDK overlay. Workspace and Assembler are docked overlays inside the stage.
- ❌ **Wrong 3**: Dynamic forms opening at the far-right edge of the viewport instead of next to chat.
- ❌ **Wrong 4**: Placing the chat inside a routed page component (it must live in the app shell).
- ❌ **Wrong 5**: Replacing or closing Workspace when Actions opens (they are persistent adjacent columns).

---

## Design Tokens Contract

Import the package's canonical `tokens.css` and `styles.css` globally in that order; do not copy token defaults into the host. The package maps its `--acp-*` tokens to `--app-*` values and fallbacks. Define the host variables that correspond to the existing application theme, including disabled-control colors, or override the relevant `--acp-*` tokens directly. Keep surfaces opaque and verify the rendered result using computed styles.

```css
/* Replace each host token name with the application's existing design token. */
:root {
  --acp-surface-bg: var(--host-surface-token);
  --acp-panel-bg: var(--host-panel-token);
  --acp-primary-accent: var(--host-primary-token);
  --acp-text-primary: var(--host-text-token);
  --acp-control-disabled-bg: var(--host-disabled-bg-token);
  --acp-control-disabled-border: var(--host-disabled-border-token);
  --acp-control-disabled-text: var(--host-disabled-text-token);
}
```

---

## Step 1: Package Registration & Harness Configuration

### 1.1 Import Bundle in App Entrypoint (`src/main.ts`)
```typescript
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
```

### 1.2 Configure Harness Settings
Follow the host application's existing configuration convention. The Angular `environment.ts` object below is an example, not a requirement. For a fresh install, add the manifest's required keys and optional keys only when their features are used. For an upgrade, compare [config-manifest.json](./config-manifest.json) with the existing host config, add only missing keys, and preserve every existing value.

```typescript
export const environment = {
  production: false,
  // Other app config...

  // Agent File-Run Harness endpoints:
  AGENT_FILE_RUN_API_URL: 'http://localhost:4001',
  AGENT_FILE_RUN_BEARER_TOKEN: '',
  AGENT_FILE_RUN_AGENT_PATH: 'ct-bot/agents/main.exs',
  AGENT_FILE_RUN_OWNER_ID: '',
  AGENT_SUGGESTIONS_AGENT_PATH: 'ct-bot/agents/suggestions.exs'
};
```

> **Security Note:** Never guess, generate, or commit a bearer token. Reuse the host's authorized runtime-token source when available; otherwise leave it empty and continue file integration, local builds, and UI checks. Report authenticated harness verification as pending, and tell the user to configure secrets through the host's secure mechanism, not agent chat. On upgrade, add only missing keys and preserve existing values.

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
        <span class="nav-icon"><!-- Use the existing sidebar icon library. --></span>
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
              (buddy-submit)="onBuddySubmitted($event.detail)"
              (buddy-submit-all)="onBuddySubmitAll($event.detail)"
              (acp-actions-requested)="onActionsRequested($event.detail)"
            ></acp-dynamic-container>
          </div>

          <!-- Assembler Pane (Activity Log) -->
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

### Sidebar Discovery Rule

Before editing the shell, inspect its layout and search for existing vertical navigation under names such as `sidebar`, `sidenav`, `side-nav`, `nav-rail`, `navigation-rail`, `side-menu`, `drawer`, `menu-panel`, or equivalent application-specific components and CSS classes. Insert the single AI Agent button into the existing side panel's bottom/footer area, preserving its markup, icon library, sizing, active state, accessibility, and styling.

Do not add the button to a header, top navigation, top toolbar, masthead, or any horizontal panel. Do not create a second sidebar beside an existing side panel. Only if no vertical side navigation exists may the host create a new side panel, and that fallback must contain no new top panel or header.

---

## Step 3: Shell Component Controller

Initialize `connectAcpHarness` inside Angular's `ngAfterViewInit` lifecycle hook so the DOM elements are guaranteed to be mounted:

The `acp-submitted`, `buddy-submit`, and `buddy-submit-all` events do not call a domain API. Reuse the host's existing authorized save service when available; do not invent an endpoint. If none exists, implement non-persisting handlers that keep Workspace open and visibly report that saving is not configured, using the host's existing feedback mechanism or an Assembler warning. Continue the integration and document the missing save wiring in the final handoff without requiring permission to proceed. “Submission requested” is not a persistence confirmation; only a confirmed service result may produce “Saved” or success feedback.

```typescript
import { Component, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
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
  // Populate from authenticated app state before initializing the connector.
  authenticatedUserId = '';
  runtimeBearerToken = '';
  pendingSubmission: { source: string; detail: any } | null = null;

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

  constructor(private router: Router, private zone: NgZone) {}

  // Invoke from the host's existing authenticated-session subscription.
  onAuthenticationChanged(userId: string, token: string) {
    this.authenticatedUserId = (userId || '').trim();
    this.runtimeBearerToken = (token || '').trim();
    if (this.chatOpen && this.harnessConnection) {
      this.harnessConnection.refreshHistory().catch(() => {
        this.reportWarning('history-unavailable', 'Conversation history could not be refreshed.');
      });
    }
  }

  ngAfterViewInit() {
    // Locate the custom elements after the DOM view has initialized
    const chatEl = document.querySelector('acp-chat-panel') as HTMLElement & {
      messages?: any[];
      chatHistory?: any[];
      pending?: boolean;
    };
    const workspaceEl = document.querySelector('acp-dynamic-container') as HTMLElement & {
      open?: boolean;
      explicitlyClosed?: boolean;
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
          getBearerToken: () => (this.runtimeBearerToken || environment.AGENT_FILE_RUN_BEARER_TOKEN || '').trim(),
          getOwnerId: () => this.authenticatedUserId
        },
        getContext: () => ({
          route: this.router.url
        }),
        onNavigate: (href: string) => {
          this.router.navigateByUrl(href);
        },
        onSurface: (surface: any) => {
          this.zone.run(() => {
          if (surface && surface.type === 'activity-log') {
            this.activityItems = Array.isArray(surface.items) ? surface.items : [];
            this.actionsOpen = true;
            this.actionsMinimized = false;
          } else {
            this.workspaceOpen = Boolean(workspaceEl && workspaceEl.open);
          }
          });
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
    this.workspaceMinimized = false;
  }

  restoreDefaultSplit() {
    this.workspaceMinimized = false;
    this.actionsMinimized = false;
  }

  onFormSubmitted(detail: any) {
    this.submissionNotConfigured('acp-submitted', detail);
  }

  onBuddySubmitted(detail: any) {
    this.submissionNotConfigured('buddy-submit', detail);
  }

  onBuddySubmitAll(detail: any) {
    this.submissionNotConfigured('buddy-submit-all', detail);
  }

  private submissionNotConfigured(source: string, detail: any) {
    this.pendingSubmission = { source, detail };
    this.workspaceOpen = true;
    this.reportWarning('save-not-configured', 'Saving is not configured. No records were saved.');
  }

  private reportWarning(id: string, text: string) {
    this.actionsOpen = true;
    this.actionsMinimized = false;
    this.activityItems = [{ id, kind: 'warning', text }, ...this.activityItems.filter(item => item.id !== id)];
  }

  onActionsRequested(detail: { open: boolean; item: AcpActivityItem }) {
    if (!detail || !detail.item) return;
    this.actionsOpen = true;
    this.actionsMinimized = false;
    this.activityItems = [detail.item, ...this.activityItems.filter(item => item.id !== detail.item.id)];
  }

  onActionClick(detail: { item: AcpActivityItem; actionId: string }) {
    this.reportWarning('action-not-configured', 'This record action is not configured: ' + detail.actionId);
  }
}
```

---

## Step 4: Window Management (Rails & Restore)

The ACP v0.3.0 package provides independent window management:

1. **Minimize (`−`)**: Collapses the pane into a slim vertical rail (`52px` wide) displaying a vertical label and close button.
2. **Maximize (`⤢`)**: Expands that pane and its content to the available stage width while preserving an open sibling. Maximizing the sibling restores the currently maximized pane first.
3. **Restore**: Clicking anywhere on a minimized rail's header restores the pane to its standard width.
4. **Kebab Menu (`⋮`)**:
   - On Workspace: provides **"Open Actions"** to view activity log without submitting.
   - On Actions: provides **"Copy all saved names"** (automatically copies saved student names to system clipboard).
5. **Resize**: The right-edge divider aligns with the pane boundary; the bottom edge resizes height; the bottom-right corner grip resizes both. Height is clamped between the pane's minimum (`240px` by default) and the viewport bottom. Leave `formHeight` / `height` unset (`null`) to keep the full column height.

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
| Chat reports an API URL or token configuration error | Missing/invalid API URL, bearer-token source, or main agent path. | Check the configured URL and manifest. Use the host's existing secure token provider; do not invent or commit a credential. |
| Recent Chats is empty after refresh | Missing owner id, or harness thread/run history routes are unavailable. | Provide the authenticated owner id through `ownerId`/`getOwnerId`, await `connection.ready`, and inspect the harness thread and events API responses. |
| Chat displays `Agent reply WebSocket failed.` | The harness server (port 4001) is not running or CORS rejected the connection. | Start the harness server (`mix do app.config + aetheris server --port 4001`) and verify origins. |

### Verification Checklist
- [ ] Required values from `config-manifest.json` use the host's configuration convention; the token comes from an authorized secret/runtime source.
- [ ] The harness server is running on the configured port.
- [ ] `connectAcpHarness` is initialized inside `ngAfterViewInit()` and disconnected in `ngOnDestroy()`.
- [ ] In template HTML, `<acp-chat-panel>` has **NO** `[messages]`, `[pending]`, or `(acp-message-sent)` bindings.
- [ ] Sending a message in the chat panel triggers a prompt in the harness and renders live assistant text blocks.
- [ ] Suggestion chips appear and click actions route or prompt correctly.
- [ ] Chat panel renders docked next to sidebar and fills full viewport height (`100%`).
- [ ] On initial load, Chat, Workspace, and Assembler all start closed.
- [ ] Workspace and Assembler headers remain fixed when bulk forms or agent surfaces provide their own titles.

## Required Host Adaptations

The controller example is the explicit **non-persisting fallback**, not a save implementation. Before using it, make these concrete adaptations:

1. Replace the example environment import with the host's existing configuration module. Compare the bundled manifest and add only missing keys; leave an unavailable token empty. Do not add example strings as real owner IDs or credentials.
2. Invoke `onAuthenticationChanged` from the host's existing authenticated-session callback, supplying the stable authenticated user ID and its authorized harness token source. Do not substitute a random/browser-generated ID. Clean up that host subscription when the shell is destroyed; disconnect the harness only there. Do not request secrets in agent chat.
3. Resolve the three elements within this shell (or use its existing Angular `ViewChild` references). Exactly one of each must exist. Do not target a routed page or mount a second set. For Angular versions requiring explicit view-query timing, use the host version's syntax; DOM access still occurs only in `ngAfterViewInit`.
4. Replace the empty sidebar icon slot with the existing navigation's icon component/class and retain its existing footer positioning, button sizing, active class, and accessibility. Do not paste a new sample sidebar beside the real one.
5. Bind `buddy-submit` and `buddy-submit-all` on the persistent Workspace element as shown: these events bubble from its dynamically created Buddy child. Do not add a hardcoded Buddy/form component to the shell. Binding only `acp-submitted` misses enrollment submissions.
6. With no authorized domain save service, retain all three non-persisting submission handlers. The retained `pendingSubmission` is only the most recent in-memory request for review, not durable storage. The visible warning is mandatory. Keep Workspace open; never stamp records `saved: true`, create a success activity, or call an invented endpoint. With an existing save service, replace these handlers with that service, await its confirmed result, preserve input on errors, and report success only on server confirmation.
7. Replace the example `onActionClick` warning only with existing authorized record actions. Until wired, show the warning; do not silently ignore activity buttons or implement fake navigation/saves. The package's built-in "Copy all saved names" menu is already handled by the element.
8. Do not call `maximize()` from `onWorkspaceMaximize`: the element has already maximized before emitting the event. `restoreDefaultSplit()` clears both host minimized flags as shown. Do not couple their visibility or close a sibling.
9. Set `--acp-app-header-height` from the existing header's measured/token height; keep header markup untouched. Map the seven mandatory color tokens plus any host font/spacing/radius tokens used by the theme. Use opaque colors for pane surfaces, not alpha/translucent host colors.

## Manual Acceptance Procedure

These are instructions for the integrating owner/agent. They have **not** been executed for v0.3.0. Record the entire numbered checklist in [INTEGRATION_SPEC.md](./INTEGRATION_SPEC.md), section 16, before declaring integration complete.

1. Load the host at desktop and narrow viewport sizes. Verify existing top chrome and navigation are unchanged, exactly one AI button is at the bottom of the existing sidebar, all three panes are closed, and their wrappers reserve zero width. Toggle Chat and its close button; opening/closing it must not open or close either sibling.
2. Open Chat. Confirm `sidebar | chat | stage`, full chat height, pinned composer, independent width drag, and message scrolling. Empty and whitespace-only drafts must disable Send with visibly disabled colors. A nonempty draft enables it; submitting clears the draft and disables it again.
3. With an actual harness and authorized token, send a message. Inspect the real request and streamed reply, suggestion actions, cancellation, conversation search, and owner-scoped history after refresh and reopen. If authentication arrives after Chat opens, verify its existing session callback refreshes history. Missing credentials/server mean **pending**, not a simulated pass. Never replace the transport with fixtures to claim authenticated acceptance.
4. Request a standard dynamic form with required text, textarea, select, checkbox, date, and number fields with bounds. Enter distinguishable values into every field. Focus a textarea, select a substring, and scroll the form. Drag the right edge, bottom edge, and corner in both directions; resize with arrow keys; repeat with host dimension bindings active. Confirm the same form/input DOM nodes remain and all values, focus, selection, scroll, and Submit validity survive. Chat resizing must move Workspace's left edge with Chat without changing routed content's layout width.
5. Repeat resizing in a Buddy enrollment form after entering raw text and editing records. Verify raw text, selected record, structured fields, validation flags, and pending parse/check state survive. Resize while a real parse/check is pending and confirm its reply applies to the same Buddy instance. Do not treat a mock response as authenticated evidence.
6. Toggle Workspace's menu, minimize to a 52px rail, restore with one header click, maximize, restore, close, and explicitly reopen through host state. Form values must survive. After a user close, a late form response must not automatically reopen Workspace. Workspace's header must always read `Workspace`.
7. Open Assembler via "Open Actions", a valid submission, and an actual `activity-log` surface. Workspace must stay mounted and open. New event items appear first; a log surface replaces items and un-minimizes Assembler. Close Assembler, then open/restore/resize Workspace: Assembler must not reopen. Its header remains `Assembler`.
8. With both panes open, minimize and restore each independently, then maximize each in turn. The other open pane stays visible; maximizing the sibling restores the previously maximized pane. Resize each pane's width, bottom edge, and corner; height must remain between its minimum and the viewport bottom. Minimized/maximized panes must hide height grips. Confirm both kebab menus and their required items.
9. For required form fields, verify blank/whitespace, unchecked required checkboxes, and out-of-range numbers disable Submit. For enrollment, test missing required fields, `valid: false`, missing `valid`, pending parse/check, raw edits requiring Parse, structured edits/Clear requiring Check, validity-only echoes retaining values, and Submit All with one invalid record. Only valid submission may emit the activity event. Do not override guards to perform this check.
10. With no domain save handler, submit a valid standard form and each enrollment submission mode. Each must visibly report "Saving is not configured. No records were saved.", keep Workspace open, and show no Saved/success state. With a real authorized save service, verify its actual success/failure responses before enabling confirmed-save feedback.
11. Use browser computed styles on `.acp-panel`, `.acp-container`, `.acp-actions-pane`, headers, composer, and rails. Verify their background alpha is 1 and their resolved colors match the chosen host tokens. Verify disabled Send/Submit use all three disabled-control tokens. The surface layer itself intentionally remains transparent so routed content is visible outside the opaque panes. Compare routed-content bounds before/after opening each overlay; they must not move or shrink.
12. Perform the host's required build and login/dashboard/lazy-module checks when execution is authorized. Report failures without unrelated repairs. Keep the harness and domain service evidence separate from package/static evidence.

### Required Handoff Format

- **Completed integration:** changed host files and the numbered rules actually verified. List changed files, not inline diffs.
- **Authenticated requests:** verified with real server evidence, or **pending/unverified** with the missing server/token/owner prerequisite. Include the Linux/macOS and Windows PowerShell harness start instructions from Step 1.3, using the configured port and the five required environment values; obtain secrets only through the host's secure mechanism.
- **Persistence:** name the existing authorized service and confirmed result, or explicitly **unwired** with the visible non-persisting handlers. Never claim a domain save from a submission event.
- **Outstanding checks:** every unchecked section 16 item and why. For this package release, runtime/manual checks remain pending by the owner's instruction; do not mark the integration complete on their behalf.
