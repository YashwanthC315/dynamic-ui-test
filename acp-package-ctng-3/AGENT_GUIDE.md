# ACP Chat Panel - Application Integration Agent Guide (v0.2.3)

## Goal

Integrate the `@acp/chat-panel` (v0.2.3) package into an application shell so that:
1. The application's existing side navigation has a single AI chat toggle button; create a side panel only when none exists.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The panel provides **in-conversation search**, **chat history switching**, **in-flight thinking indicator**, **cancellation**, and **interactive suggestion chips**.
4. The application's routed content fills the remaining workspace space without being replaced by a surface.
5. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel inside the workspace stage.
6. Workspace and Actions panes support **compact rail collapsing (`−`)**, **wide expansion (`⤢`)**, **kebab overflow menus (`⋮`)**, and **one-click rail restore**.
7. The post-commit Action Area (activity log) renders status items and action menus.
8. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables) with fully opaque surfaces.

This guide describes browser Custom Elements integration, with a standalone
Angular host example. Angular 22 is the intended target, but a full Angular 22
build has not been verified. Use the Node.js and TypeScript versions required
by the target Angular release; this package does not establish those requirements.
The included Angular 7 source snapshot is a separate integration path, not an
Angular 22 library. Its backend/store features are not bundled into the Custom Elements.

## v0.2.3 behavior rules

1. Chat starts closed. Do not put `open` on `<acp-chat-panel>` in initial markup and do not open it from an initialization hook.
2. The host application owns exactly one AI Agent/chat toggle button. First locate and reuse the application's existing side navigation, sidebar, navigation rail, side rail, side menu, drawer, or left/right navigation panel, even if it uses a different name. Add the button at the bottom of that existing side panel. Create a new side panel only when the host has no side navigation. Never place the button in or create a top bar, header, toolbar, or other horizontal panel.
3. The host button toggles the chat element's `open` property. The element's close control emits `acp-open-change` with `false`.
4. Opening Chat never opens Workspace or Actions.
5. Workspace opens only after `acp-form-requested` or an equivalent explicit host update. An explicit user close is respected.
6. An activity-bearing `acp-actions-requested` opens Actions beside Workspace. Actions stays open until the user explicitly minimizes or closes it.
7. Chat, Workspace, and Actions are independently resizable. Bind `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` when width state is stored by the host.
8. Workspace and Actions are also resizable in height via a bottom edge and a bottom-right corner grip (width + height). Heights default to the full column; bind `acp-form-height-change` (`formHeight`) and `acp-actions-height-change` (`height`) when height state is stored by the host. Height grips are hidden while a pane is minimized or maximized.
9. Closed elements occupy zero width. Do not reserve fixed-width shell columns around closed elements.
10. Keep Chat, Workspace, Assembler, and routed content as direct children of
  the same constrained flex container. Width limits inspect direct siblings;
  do not put each pane in a separate sizing wrapper.
11. Workspace maximize must not close or collapse Assembler. On narrow screens,
  stack panes or allow scrolling rather than hiding an adjacent pane.

---

## Required Layout Architecture

The workspace row follows this horizontal sequence on a sufficiently wide screen:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | Workspace | Assembler | routed content           |
| [AI]    | docked next to     | direct siblings in one constrained flex row      |
| button  | sidebar            | stack/scroll when minimum widths do not fit      |
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
acp-dynamic-container {
  background-color: var(--acp-stage-bg) !important;
  color: var(--acp-text-primary) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

---

## Step 1: Package Registration & Schema

The package registers standard browser **Web Components (Custom Elements)**.
Load it once in browser bootstrap, not during server-side rendering. It does
not import the host's Angular runtime. This does not guarantee compatibility
with every Angular compiler, browser, or build configuration.

### 1.1 Import Bundle in App Entrypoint (`src/main.ts`)
```typescript
import '@acp/chat-panel';
```

Include `node_modules/@acp/chat-panel/dist/styles.css` in the build's global
`styles` list, or import it from the global stylesheet:

```css
@import '@acp/chat-panel/dist/styles.css';
```

The package includes default token values and component/layout rules.
Override tokens after that import. The Angular source snapshot's
`agent-chat-panel.css` is not the stylesheet for these custom elements.

### 1.2 Enable `CUSTOM_ELEMENTS_SCHEMA` in Host Module or Component
```typescript
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  declarations: [AppShellComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

For standalone Angular hosts, put `CUSTOM_ELEMENTS_SCHEMA` on the component
that owns this template and import `CommonModule` and `RouterOutlet` there.
The controller below shows this variant. Provide `HttpClient` and the router
at application bootstrap using the APIs supported by your Angular version.
For an NgModule-declared shell, set `standalone: false`, remove the component's
`imports`, and put `CommonModule`, `RouterModule`, and the schema on its module.

---

## Step 2: App Shell Template Composition

Place the layout inside your shell template (`app.component.html` or `app-shell.component.html`):

Retain the host's existing sidebar and top chrome. Ensure the shell body has
a definite available height and can shrink its flex children. For example,
adapt these shell rules to the host's existing classes:

```css
.app-shell { display: flex; flex-direction: column; height: 100dvh; }
.app-shell__body { display: flex; flex: 1; min-height: 0; min-width: 0; }
```

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
      <!-- All panes are direct flex siblings; no sizing wrappers. -->
        <acp-chat-panel
          [open]="chatOpen"
          [width]="chatWidth"
          [agentDisplay]="agentName"
          [pending]="isPending"
          [messages]="messages"
          [chatHistory]="chatHistory"
          (acp-open-change)="onChatOpenChange(eventDetail($event))"
          (acp-width-change)="chatWidth = eventDetail($event)"
          (acp-new-chat)="onNewChat()"
          (acp-message-sent)="onChatMessage(eventDetail($event))"
          (acp-navigate)="onNavigate(eventDetail($event))"
          (acp-link-click)="onNavigate(eventDetail($event))"
          (acp-cancel-request)="onCancelRequest()"
          (acp-restore-conversation)="onRestoreConversation(eventDetail($event))"
          (acp-form-requested)="onFormRequested(eventDetail($event))"
        ></acp-chat-panel>

            <acp-dynamic-container
              #workspacePane
              [open]="workspaceOpen"
              [formWidth]="workspaceWidth"
              [formHeight]="workspaceHeight"
              [formSpec]="activeFormSpec"
              (acp-open-change)="workspaceOpen = eventDetail($event)"
              (acp-form-width-change)="workspaceWidth = eventDetail($event)"
              (acp-form-height-change)="workspaceHeight = eventDetail($event)"
              (acp-open-actions)="openActionsPane()"
              (acp-workspace-maximize)="onWorkspaceMaximize()"
              (acp-restore-default-split)="restoreDefaultSplit()"
              (acp-submitted)="onFormSubmitted(eventDetail($event))"
              (acp-actions-requested)="onActionsRequested(eventDetail($event))"
            ></acp-dynamic-container>

            <!-- Optional host-owned Buddy workspace (implement its handlers):
            <buddy-enrol-workspace-surface
              (buddy-parse)="onBuddyParse(eventDetail($event))"
              (buddy-check)="onBuddyCheck(eventDetail($event))"
              (buddy-submit)="onBuddySubmit(eventDetail($event))"
              (buddy-submit-all)="onBuddySubmitAll(eventDetail($event))"
              (acp-actions-requested)="onActionsRequested(eventDetail($event))"
            ></buddy-enrol-workspace-surface>
            -->
            <acp-actions-pane
              #actionsPane
              title="Assembler"
              [open]="actionsOpen"
              [width]="actionsWidth"
              [height]="actionsHeight"
              [items]="activityItems"
              (acp-open-change)="actionsOpen = eventDetail($event)"
              (acp-actions-width-change)="actionsWidth = eventDetail($event)"
              (acp-actions-height-change)="actionsHeight = eventDetail($event)"
              (acp-actions-close)="actionsOpen = false"
              (acp-action-click)="onActionClick(eventDetail($event))"
              (acp-restore-default-split)="restoreDefaultSplit()"
            ></acp-actions-pane>
      <main class="acp-workspace__content">
        <router-outlet></router-outlet>
      </main>
    </div>
  </div>
</div>
```

### Sidebar discovery rule

Before editing the shell, inspect its layout and search for existing vertical
navigation under names such as `sidebar`, `sidenav`, `side-nav`, `nav-rail`,
`navigation-rail`, `side-menu`, `drawer`, `menu-panel`, or equivalent
application-specific components and CSS classes. Insert the single AI Agent
button into the existing side panel's bottom/footer area, preserving its
markup, icon library, sizing, active state, accessibility, and styling.

Do not add the button to a header, top navigation, top toolbar, masthead, or
any horizontal panel. Do not create a second sidebar beside an existing side
panel. Only if no vertical side navigation exists may the host create a new
side panel, and that fallback must contain no new top panel or header.

---

## Step 3: Shell Component Controller

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import {
  AcpChatMessage,
  AcpChatHistoryItem,
  AcpActivityItem,
  AcpFormSpec,
  AcpDynamicContainer,
  AcpActionsPane
} from '@acp/chat-panel';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit, OnDestroy {
  @ViewChild('workspacePane') workspacePane!: ElementRef<AcpDynamicContainer>;
  @ViewChild('actionsPane') actionsPane!: ElementRef<AcpActionsPane>;
  private chatRequest: Subscription | null = null;
  private historyRequest: Subscription | null = null;
  private restoreRequest: Subscription | null = null;
  // Default/initial state: all three panels start closed. The sidebar's
  // AI toggle button is the only way to open the chat panel.
  chatOpen = false;
  chatWidth = 380;
  agentName = 'Assistant';
  isPending = false;

  workspaceOpen = false;
  workspaceWidth = 540;
  workspaceHeight: number | null = null;
  actionsOpen = false;
  actionsWidth = 280;
  actionsHeight: number | null = null;

  activeFormSpec: AcpFormSpec | null = null;
  activityItems: AcpActivityItem[] = [];
  chatHistory: AcpChatHistoryItem[] = [];

  messages: AcpChatMessage[] = [
    {
      id: 'intro',
      role: 'assistant',
      text: "Hello! How can I assist you with your operations today?",
      timestamp: new Date().toISOString(),
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

  ngOnDestroy() {
    this.onCancelRequest();
    if (this.historyRequest) this.historyRequest.unsubscribe();
    if (this.restoreRequest) this.restoreRequest.unsubscribe();
  }

  eventDetail(event: Event): any {
    return (event as CustomEvent).detail;
  }

  loadChatHistory() {
    if (this.historyRequest) this.historyRequest.unsubscribe();
    this.historyRequest = this.http.get<AcpChatHistoryItem[]>('/api/conversations').subscribe({
      next: (list) => this.chatHistory = list,
      error: () => {}
    });
  }

  onNewChat() {
    this.onCancelRequest();
    if (this.restoreRequest) this.restoreRequest.unsubscribe();
    this.messages = [];
  }

  onChatOpenChange(open: boolean) {
    this.chatOpen = open;
  }

  onChatMessage(text: string) {
    if (this.isPending || !text.trim()) return;
    if (this.restoreRequest) this.restoreRequest.unsubscribe();
    this.restoreRequest = null;
    const userMsg: AcpChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    this.messages = [...this.messages, userMsg];
    this.isPending = true;

    this.chatRequest = this.http.post<any>('/api/agent/chat', {
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
            timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
          }
        ];
      }
    });
  }

  onNavigate(detail: { href: string }) {
    const href = detail && detail.href;
    if (typeof href !== 'string' || !/^\/(?!\/)/.test(href) || /[\\\s]/.test(href)) return;
    this.router.navigateByUrl(href);
  }

  onCancelRequest() {
    if (this.chatRequest) this.chatRequest.unsubscribe();
    this.chatRequest = null;
    this.isPending = false;
  }

  onRestoreConversation(detail: { conversationId: string }) {
    this.onCancelRequest();
    if (this.restoreRequest) this.restoreRequest.unsubscribe();
    this.restoreRequest = this.http.get<any>(`/api/conversations/${encodeURIComponent(detail.conversationId)}`).subscribe({
      next: data => { this.messages = data.messages || []; },
      error: () => {}
    });
  }

  onFormRequested(detail: { formSpec: AcpFormSpec }) {
    this.activeFormSpec = detail.formSpec;
    this.workspaceOpen = true;
    this.workspacePane.nativeElement.minimized = false;
  }

  openActionsPane() {
    this.actionsOpen = true;
    this.actionsPane.nativeElement.minimized = false;
  }

  onWorkspaceMaximize() {
    // Optional host persistence/analytics hook. Actions remains unchanged.
  }

  restoreDefaultSplit() {
    this.workspacePane.nativeElement.minimized = false;
    this.workspacePane.nativeElement.maximized = false;
    this.actionsPane.nativeElement.minimized = false;
    this.actionsPane.nativeElement.maximized = false;
  }

  onFormSubmitted(detail: any) {
    // Keep Workspace open so the user can review or edit the submitted data.
  }

  onActionsRequested(detail: { open: boolean; item: AcpActivityItem }) {
    if (detail.open === false) return;
    this.actionsOpen = true;
    this.actionsPane.nativeElement.minimized = false;
    if (detail.item && !this.activityItems.some(item => item.id === detail.item.id)) {
      this.activityItems = [...this.activityItems, detail.item];
    }
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

The ACP v0.2.3 package incorporates window management:

1. **Minimize (`−`)**: Collapses the pane into a slim vertical rail (`52px` wide) displaying a vertical label and close button.
2. **Maximize (`⤢`)**: Expands up to its configured maximum, limited by the parent and visible sibling widths. It must not close the adjacent pane.
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

Keep the elements mounted as direct flex siblings and let their `open`
properties control visibility. Do not add sizing wrappers around them.
The package collapses closed elements to zero and minimized elements to the
fixed 52px rail width. The current JavaScript does not read `--acp-rail-width`
to compute geometry, so do not override the rail's width independently in CSS.

---

## Step 5: Verification Checklist

- [ ] Chat panel renders docked next to sidebar and fills full viewport height (`100%`).
- [ ] Composer stays anchored to the bottom.
- [ ] In-flight thinking indicator pill (`Thinking...`) appears when `[pending]="true"`.
- [ ] In-conversation search filters messages in real time.
- [ ] History button opens recent conversations dropdown.
- [ ] Suggestion chips render with `→` icon and fire actions on click.
- [ ] Dynamic forms and Buddy workspace open as adjacent columns without replacing router content.
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
- [ ] Widening/maximizing Workspace keeps Assembler visible; narrow screens stack/scroll.
- [ ] Cancellation aborts the client HTTP subscription; canceled replies do not append.
- [ ] Suggestion navigation runs once; ordinary link clicks navigate through `acp-link-click`.
- [ ] The installed package contains this guide and `dist/styles.css`.

The `/api/conversations` and `/api/agent/chat` endpoints above are illustrative
host APIs, not services supplied by the package. Replace them with your real
adapter; absence of a history service should yield an empty history list.
Unsubscribing aborts the client HTTP request but does not guarantee cancellation
of server-side work. File-run backends need their own run-cancel protocol.

Suggestion clicks already emit `acp-message-sent` or `acp-navigate`. Use
`acp-suggestion-click` only for optional analytics, not a second send/navigation.
Adapt the internal-path check to your application's route allowlist.
Built-in pane controls own minimized/maximized state; the example does not
bind stale host booleans back over those states. Restoring both panes uses
property setters, not `restore()` methods, to avoid re-emitting restore events.

From the originating repository, run `npm --prefix acp-package-0.2.3 run verify`
for syntax, binding, API, and controller-behavior checks. The controller tests
use real RxJS subscriptions with an observable transport fixture, not a live
backend or an Angular 22 bootstrap. Also run the target host's production
build with strict template checking and test authenticated backend workflows
before deployment.
