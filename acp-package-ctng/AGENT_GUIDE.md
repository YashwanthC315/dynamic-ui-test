# ACP Chat Panel — Universal Application Integration Agent Guide

## Goal

Integrate the `@acp/chat-panel` package into an application shell so that:
1. The existing sidebar has a single AI chat toggle button.
2. The chat panel opens **docked directly next to the sidebar** as a full-height workspace column.
3. The application's routed content fills the remaining workspace space to the right without internal layout reflow.
4. Dynamic form surfaces and the Buddy workspace open immediately to the right of the chat panel inside the workspace stage.
5. The post-commit Action Area (activity log) renders status items and action menus.
6. All styling is governed strictly by **Design Tokens** (`--acp-*` CSS variables).

This guide supports **all Angular versions** (both Standalone Angular 14-19+ and NgModule Angular 4-16).

---

## Required Layout Architecture

The workspace row must follow this exact horizontal sequence:

```text
+---------+----------------------+----------------------------------------------+
| sidebar | chat (full height)   | stage                                        |
| [AI]    | docked next to       | - dynamic form / Buddy workspace (on left)   |
| button  | sidebar              | - routed content (scrolls, no grid reflow)   |
+---------+----------------------+----------------------------------------------+
```

### Prohibited Layouts (Do NOT do these):
- ❌ **Wrong 1**: `sidebar | routed content | chat on far right` (chat must be on the left of content).
- ❌ **Wrong 2**: Floating dialog, drawer overlay, modal, or CDK overlay.
- ❌ **Wrong 3**: Dynamic forms opening at the far-right edge of the viewport instead of next to chat.
- ❌ **Wrong 4**: Placing the chat inside a routed page component (it must live in the app shell).

---

## Design Tokens Contract

All styling must be driven by design tokens via CSS variables. Never hardcode application colors or sizes in the template.

Map the host application's existing design tokens (or custom values) to the `--acp-*` tokens in your global stylesheet (e.g. `src/styles.css` or `src/styles.scss`):

```css
:root {
  /* Surface & Backgrounds (MUST BE OPAQUE - NO TRANSPARENCY) */
  --acp-surface-bg: var(--app-surface, #ffffff);
  --acp-panel-bg: var(--app-panel-bg, #f5f7fb);
  --acp-header-bg: var(--app-header-bg, #ffffff);
  --acp-stage-bg: var(--app-stage-bg, #ffffff);
  --acp-bubble-user-bg: var(--app-primary-light, #eaf0fa);
  --acp-bubble-agent-bg: var(--app-surface, #ffffff);

  /* Typography & Colors */
  --acp-text-primary: var(--app-text-primary, #173b70);
  --acp-text-secondary: var(--app-text-secondary, #6d7f99);
  --acp-text-muted: var(--app-text-muted, #7888a0);
  --acp-text-on-primary: #ffffff;
  --acp-font-family: var(--app-font-family, Arial, sans-serif);

  /* Borders & Radii */
  --acp-border-color: var(--app-border, #d8dfeb);
  --acp-border-radius-sm: 4px;
  --acp-border-radius-md: 6px;
  --acp-border-radius-lg: 8px;

  /* Primary Accent & Focus */
  --acp-primary-accent: var(--app-primary, #173b70);
  --acp-primary-hover: var(--app-primary-hover, #122d56);
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

The package exports standard **Web Components (Custom Elements)**, not Angular components. This is why it works in any Angular version.

### 1. Eager Import (App Startup)
In `src/main.ts` (or `polyfills.ts`):
```typescript
import '@acp/chat-panel';
```

### 2. Enable Custom Elements Schema
Tell Angular to allow custom HTML tags without compiler errors:

* **For Standalone Components (Angular 14–19+):**
  ```typescript
  import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

  @Component({
    selector: 'app-shell',
    standalone: true,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    // ...
  })
  export class AppShellComponent {}
  ```

* **For NgModule Applications (Angular 4–16):**
  ```typescript
  import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

  @NgModule({
    declarations: [AppShellComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    // ...
  })
  export class AppModule {}
  ```

### 3. Load Package Styles & Design Tokens
Ensure package styles are loaded globally so all components, form layers, and layout classes render properly.

* **Via `angular.json` (Recommended for all Angular versions):**
  Add the package token and component stylesheets to the build `styles` array:
  ```json
  "styles": [
    "src/styles.css",
    "node_modules/@acp/chat-panel/styles/acp-tokens.css",
    "node_modules/@acp/chat-panel/styles/acp-chat-panel.css"
  ]
  ```

* **Or via Global Stylesheet (`src/styles.css` / `src/styles.scss`):**
  - Modern Angular (Angular 12–22+):
    ```css
    @import '@acp/chat-panel/tokens.css';
    @import '@acp/chat-panel/styles.css';
    ```
  - Classic Angular (Angular 4–11 / Webpack 4):
    ```css
    @import '~@acp/chat-panel/styles/acp-tokens.css';
    @import '~@acp/chat-panel/styles/acp-chat-panel.css';
    ```

---

## Step 2: Add Shell State & Handlers

Add state variables and event handlers to the shell component (e.g. `app.component.ts` or `app-shell.component.ts`):

```typescript
export interface DynamicFormItem {
  id: string;
  title: string;
  formSpec: any;
  formWidth: number;
}

export interface ActivityLogEntry {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
  actions?: Array<{ id: string; label: string }>;
}

export class AppShellComponent {
  chatOpen = false;
  chatWidth = 360;
  messages: Array<{ id: string; role: string; text: string; timestamp?: any }> = [];
  openForms: DynamicFormItem[] = [];
  activityItems: ActivityLogEntry[] = [];

  // Toggle chat
  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
  }

  // Incoming user messages from chat
  onChatMessage(text: string): void {
    const userMsg = { id: String(Date.now()), role: 'user', text, timestamp: new Date() };
    this.messages = [...this.messages, userMsg];

    // Connect to host agent service or handle custom commands
    if (!text.startsWith('/form')) {
      // Normal message: forward to your agent API/backend
    }
  }

  // Dynamic Form requested (e.g. via "/form create student")
  onFormRequested(detail: any): void {
    const formSpec = detail?.formSpec || detail;
    if (!formSpec) return;

    const id = 'form_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    this.openForms = [
      ...this.openForms,
      {
        id,
        title: formSpec.title || 'Dynamic Form',
        formSpec,
        formWidth: 520, // default initial width
      },
    ];
  }

  // Resizing a dynamic form updates ONLY that form's width
  onFormWidthChange(formId: string, width: number): void {
    this.openForms = this.openForms.map((f) => (f.id === formId ? { ...f, formWidth: width } : f));
  }

  // Close dynamic form
  closeForm(formId: string): void {
    this.openForms = this.openForms.filter((f) => f.id !== formId);
  }

  // Dynamic form submitted
  onFormSubmitted(formId: string, payload: any): void {
    console.log('Form submitted:', formId, payload);
    // Add success outcome to Action Area
    this.activityItems = [
      ...this.activityItems,
      {
        id: String(Date.now()),
        kind: 'success',
        text: `Submitted form successfully.`,
        actions: [{ id: 'focus_record', label: 'Focus' }, { id: 'copy_names', label: 'Copy' }],
      },
    ];
    this.closeForm(formId);
  }

  // TrackBy helper for ngFor
  trackFormById(index: number, form: DynamicFormItem): string {
    return form.id;
  }
}
```

---

---

## Step 3: Add Launch Button to the Existing Sidebar

**Crucial Integration Rules:**
1. **Do NOT fabricate or paste a new `<aside class="app-sidebar">`** into `app.component.html` if your application already has an existing navigation bar or sidebar component.
2. **Place the button at the BOTTOM of the sidebar**: The AI launch button must be positioned at the **bottom (footer) of the sidebar navigation**, NOT at the top of the menu links.

### Placement & Markup:
Locate the existing navigation/sidebar component (e.g. `<app-sidebar>`, `<app-nav>`, `<nav class="sidebar">`, `<ul class="nav">`, or layout sidebar template).

Add the button at the **bottom of the sidebar** (e.g., inside a sidebar footer or as the last item using `margin-top: auto`):

```html
<!-- At the bottom of the existing sidebar navigation -->
<div class="sidebar-chat-launcher" style="margin-top: auto; padding: 10px;">
  <button 
    type="button" 
    class="sidebar-chat-btn" 
    title="AI Assistant"
    (click)="toggleChat()">
    <span class="icon">🤖</span>
    <span class="label">AI</span>
  </button>
</div>
```
*Note: If the sidebar container is a flex column (`display: flex; flex-direction: column`), adding `margin-top: auto` cleanly pushes the button to the bottom below all navigation links.*

### State Communication:
- If the sidebar template is inside the shell component where `chatOpen` is declared, directly bind `(click)="toggleChat()"`.
- If the sidebar is an isolated child component (e.g. `<app-sidebar>`), either emit an `@Output() toggleChat = new EventEmitter<void>()` to the parent shell, or inject a shared UI state service to toggle `chatOpen`.

*Do not create any floating action buttons or modal launchers.*

---

## Step 4: Shell Template & Surgical Workspace Integration

### Golden Rule: Non-Destructive Shell Integration
**Do NOT replace or wipe out the existing application layout.** Keep existing headers, navigation sidebars, and footers intact. 

Locate where `<router-outlet></router-outlet>` resides in your application shell. Wrap **only** the chat panel and the routed stage in `<div class="acp-workspace">` immediately adjacent to your sidebar:

```text
Existing Header (intact)
-------------------------------------------------------------------------------
[Existing Sidebar] | [ACP Chat Panel (when open)] | [ACP Stage: router-outlet]
[AI Button at Bot] | (full screen length)         | (scrolls, no double scroll)
-------------------------------------------------------------------------------
Existing Footer (intact)
```

### Template Examples by Angular Version:

#### Option A: Modern Angular (Angular 17+ with `@if` and `@for`)
```html
<div class="app-shell">
  <!-- Optional existing app header (if present) -->

  <div class="app-shell__body">
    <!-- Existing sidebar (with AI button positioned at the bottom) -->
    <app-sidebar></app-sidebar>

    <!-- ACP Workspace: wraps docked chat and routed stage -->
    <div class="acp-workspace">
      @if (chatOpen) {
        <div class="acp-workspace__chat">
          <acp-chat-panel
            dock="left"
            [open]="chatOpen"
            [width]="chatWidth"
            [min-width]="260"
            [max-width]="640"
            [messages]="messages"
            (acp-open-change)="chatOpen = $any($event).detail"
            (acp-width-change)="chatWidth = $any($event).detail"
            (acp-message-sent)="onChatMessage($any($event).detail)"
            (acp-form-requested)="onFormRequested($any($event).detail)">
          </acp-chat-panel>
        </div>
      }

      <!-- Stage Area: Routed application content + dynamic form layer -->
      <section class="acp-workspace__stage">
        <main class="acp-workspace__content">
          <router-outlet></router-outlet>
        </main>

        <!-- Only render form layer when forms are open (prevents ghost scrollbars) -->
        @if (openForms.length > 0) {
          <div class="acp-workspace__form-layer">
            @for (form of openForms; track form.id) {
              <acp-dynamic-container
                class="acp-workspace__form"
                [open]="true"
                [title]="form.title"
                [formWidth]="form.formWidth"
                [minFormWidth]="320"
                [maxFormWidth]="760"
                [formSpec]="form.formSpec"
                (acp-form-width-change)="onFormWidthChange(form.id, $any($event).detail)"
                (acp-submitted)="onFormSubmitted(form.id, $any($event).detail)"
                (acp-cancelled)="closeForm(form.id)">
              </acp-dynamic-container>
            }
          </div>
        }
      </section>
    </div>
  </div>
</div>
```

#### Option B: Classic / NgModule Angular (`*ngIf` and `*ngFor` - Angular 4–16)
```html
<div class="app-shell">
  <!-- Optional existing app header (if present) -->

  <div class="app-shell__body">
    <!-- Existing sidebar (with AI button positioned at the bottom) -->
    <app-sidebar></app-sidebar>

    <!-- ACP Workspace: wraps docked chat and routed stage -->
    <div class="acp-workspace">
      <div class="acp-workspace__chat" *ngIf="chatOpen">
        <acp-chat-panel
          dock="left"
          [open]="chatOpen"
          [width]="chatWidth"
          [min-width]="260"
          [max-width]="640"
          [messages]="messages"
          (acp-open-change)="chatOpen = $event.detail"
          (acp-width-change)="chatWidth = $event.detail"
          (acp-message-sent)="onChatMessage($event.detail)"
          (acp-form-requested)="onFormRequested($event.detail)">
        </acp-chat-panel>
      </div>

      <!-- Stage Area: Routed application content + dynamic form layer -->
      <section class="acp-workspace__stage">
        <main class="acp-workspace__content">
          <router-outlet></router-outlet>
        </main>

        <!-- Only render form layer when forms are open (prevents ghost scrollbars) -->
        <div class="acp-workspace__form-layer" *ngIf="openForms.length">
          <acp-dynamic-container
            *ngFor="let form of openForms; trackBy: trackFormById"
            class="acp-workspace__form"
            [open]="true"
            [title]="form.title"
            [formWidth]="form.formWidth"
            [minFormWidth]="320"
            [maxFormWidth]="760"
            [formSpec]="form.formSpec"
            (acp-form-width-change)="onFormWidthChange(form.id, $event.detail)"
            (acp-submitted)="onFormSubmitted(form.id, $event.detail)"
            (acp-cancelled)="closeForm(form.id)">
          </acp-dynamic-container>
        </div>
      </section>
    </div>
  </div>
</div>
```

---

### Layout CSS (Apply in Global Stylesheet)

> [!IMPORTANT]
> **1. Chat Full-Length & Input Position**: The chat message container expands with `flex: 1 1 auto` to keep the composer input box pinned at the **bottom** of the panel. If the input box appears at the top, it means `.app-shell` or `.acp-workspace` lacks full viewport height. Always ensure `height: 100vh; overflow: hidden;` is on the shell container.
>
> **2. Preventing Excess / Double Scrollbars**:
> - Apply `overflow: hidden` to `.app-shell` and `.app-shell__body` so the browser window (`body`) does not scroll.
> - Only `.acp-workspace__content` should scroll vertically (`overflow-y: auto; overflow-x: hidden`).
> - Use `*ngIf="openForms.length"` on `.acp-workspace__form-layer` so an empty form layer never introduces ghost horizontal/vertical scrollbars.

```css
/* 1. Root & Shell Height Propagation (Pins text input to bottom) */
html, body {
  height: 100%;
  margin: 0;
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden; /* Prevents outer window scrollbar */
}

.app-shell__body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden; /* Contains inner layout */
}

/* 2. Workspace container: fills remaining horizontal space next to sidebar */
.acp-workspace {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--acp-stage-bg);
}

/* 3. Chat Column: full height, docked next to sidebar */
.acp-workspace__chat {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  align-self: stretch;
  display: flex;
  flex-direction: column;
}

.acp-workspace__chat > acp-chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
}

/* 4. Stage Area: owns routed content and dynamic form overlay */
.acp-workspace__stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* 5. Routed Page Content: Single controlled vertical scroll; no horizontal spill */
.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
}

/* Ensures routed component tags stretch 100% width and do not shrink-wrap to the left */
.acp-workspace__content > * {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

/* 6. Dynamic form layer: sits directly adjacent to chat */
.acp-workspace__form-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  inset: 0;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  overflow-x: auto;
  pointer-events: none; /* allows clicking routed content where form is absent */
}

.acp-workspace__form-layer:empty {
  display: none !important;
}

.acp-workspace__form {
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  pointer-events: auto; /* re-enables interaction on the form itself */
}
```

---

## Step 5: Dynamic Forms (`/form` Trigger)

Typing a command starting with `/form` in the chat automatically triggers form creation.

### Example Test Commands:
- `/form create student`
- `/form create enroll student form`

### Supported Dynamic Form Field Types:
- `text`: Single-line input
- `number`: Numeric input
- `date`: Calendar date picker
- `checkbox`: Boolean toggle
- `select`: Dropdown options
- `textarea`: Multi-line text

The dynamic container emits:
- `(acp-form-width-change)`: Update the shell form's width.
- `(acp-submitted)`: Contains `{ formId, values }`.
- `(acp-cancelled)`: Closes the form.

---

## Step 6: Buddy Workspace & Action Area

### 1. Buddy Workspace Mounting Hook (`acp-custom-host-ready`)
When rich workspace surfaces (e.g. Buddy multi-record parser and enrollment workspace) are invoked, the dynamic container dispatches the `acp-custom-host-ready` DOM event.

Register this listener once at app startup:
```typescript
document.addEventListener('acp-custom-host-ready', (ev: any) => {
  const { formId, hostSelector } = ev.detail || {};
  if (!hostSelector) return;

  const mount = document.querySelector(hostSelector);
  if (!mount) return;

  // Mount your host Buddy element into the container mount point
  const buddyElement = document.createElement('buddy-enrol-workspace-surface');
  buddyElement.setAttribute('data-form-id', formId);
  mount.innerHTML = '';
  mount.appendChild(buddyElement);
});
```

### 2. Action Area Behaviour (Post-Commit Accumulator)
The Action Area records post-commit activity outcomes (success, warnings, errors) with actionable buttons:

```html
<div class="acp-actions-pane" *ngIf="activityItems.length">
  <div class="acp-actions-header">
    <strong>Actions</strong>
    <button type="button" class="acp-kebab-btn" title="More options">⋮</button>
  </div>
  <ul class="acp-actions-list">
    <li *ngFor="let item of activityItems" [class]="'acp-action-item--' + item.kind">
      <span class="text">{{ item.text }}</span>
      <div class="actions" *ngIf="item.actions">
        <button *ngFor="let act of item.actions" (click)="handleAction(item, act)">
          {{ act.label }}
        </button>
      </div>
    </li>
  </ul>
</div>
```

---

## Step 7: Connect to Agent Harness (optional)

If your repository includes an agent harness or mock agent (for example the `mock-harness/` in this workspace), wire the chat panel to that harness so messages flow exactly as they do in local development and tests.

General goals:
- Forward messages sent from the chat UI to the harness/backend agent API.
- Receive agent responses (or harness-sent events) and push them into the chat panel's message stream.
- Preserve existing harness semantics so behaviour matches current development tooling.

Example integration (Angular shell):

1. Create or reuse a small service that adapts the harness client API to your shell.

```typescript
// src/app/services/agent-harness.service.ts
import { Injectable } from '@angular/core';
// adjust import to your harness client (see mock-harness/live-client.ts)
import { LiveClient } from '../../../mock-harness/live-client';

@Injectable({ providedIn: 'root' })
export class AgentHarnessService {
  private client = new LiveClient();

  sendMessage(text: string) {
    return this.client.send({ role: 'user', text });
  }

  onMessage(cb: (msg: any) => void) {
    return this.client.on('message', cb);
  }
}
```

2. Wire the service to the shell so the chat panel uses the harness when present:

```typescript
// in AppShellComponent (or equivalent)
constructor(private harness: AgentHarnessService) {}

ngOnInit() {
  // subscribe to harness messages and append to local `messages`
  this.harness.onMessage((m) => {
    const incoming = { id: String(Date.now()), role: m.role || 'assistant', text: m.text };
    this.messages = [...this.messages, incoming];
  });
}

onChatMessage(text: string) {
  const userMsg = { id: String(Date.now()), role: 'user', text };
  this.messages = [...this.messages, userMsg];

  // Prefer harness if available, otherwise forward to your real agent API
  if (this.harness) {
    this.harness.sendMessage(text).catch((err) => console.error(err));
  } else {
    // fallback: call your agent API
  }
}
```

3. DOM events alternative (Web Components friendly)

If you prefer to keep the shell decoupled from Angular services, use DOM events to bridge the chat panel and harness. The chat panel emits `acp-message-sent` events; listen and forward to the harness, and dispatch synthetic `acp-message-received` events when the harness responds.

```typescript
document.addEventListener('acp-message-sent', (ev: any) => {
  const text = ev.detail;
  // forward to harness
  liveClient.send({ text });
});

liveClient.on('message', (m) => {
  const event = new CustomEvent('acp-message-received', { detail: m });
  document.dispatchEvent(event);
});
```

Notes:
- Inspect `mock-harness/` to reuse existing client APIs (`live-client.ts`, `server.ts`).
- Keep the message shape compatible with the chat panel `messages` input (role/text/timestamp).
- Using the harness makes local development and automated tests behave identically to production agent integrations.


---

## Verification Checklist

Before considering the task complete, verify every item:

- [ ] **Sidebar Button at Bottom**: The AI button is placed at the **bottom** of the application's sidebar navigation (not at the top).
- [ ] **Chat Input at Bottom (Full Height)**: The chat panel spans the full viewport height and the message input box is pinned at the **bottom** of the screen.
- [ ] **No Excess/Double Scroll**: Only `.acp-workspace__content` scrolls vertically; there is no outer window scrollbar and no phantom scrollbar when dynamic forms are closed.
- [ ] **Home/Dashboard Layout Integrity**: Routed dashboard/home components retain their full original width; cards and elements are NOT squished or cramped to the left.
- [ ] **Docking Order**: Chat renders directly next to sidebar (left side of content, NOT on the right).
- [ ] **No Overlay for Chat**: Chat pushes the content container; it does not float over it.
- [ ] **No Page Reflow**: Resizing the chat narrows the content container and enables scrolling if needed; it does NOT reflow internal dashboard cards/grids.
- [ ] **Dynamic Forms**: Typing `/form create enroll student form` opens `<acp-dynamic-container>` docked next to chat inside the stage.
- [ ] **Form Resizing**: The dynamic form resizes independently and updates its width via `(acp-form-width-change)`.
- [ ] **Opaque Surfaces**: The dynamic form and chat backgrounds are completely opaque (no text bleed-through from routed content).
- [ ] **Design Tokens Applied**: Colors and spacing match the host application via CSS variables (`--acp-*`).
- [ ] **Styles Loaded**: Package CSS (`acp-tokens.css` and `acp-chat-panel.css`) is loaded globally in `angular.json` or `styles.css`.
- [ ] **Build Success**: `npm run build` succeeds with zero template, schema, or styling errors.
