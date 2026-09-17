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

## Step 3: Add Launch Button to the Sidebar

Add a single chat button in the existing sidebar navigation:

```html
<button 
  type="button" 
  class="sidebar-chat-btn" 
  title="AI Assistant"
  (click)="toggleChat()">
  <span class="icon">🤖</span>
  <span class="label">AI</span>
</button>
```
*Do not create any floating action buttons or modal launchers.*

---

## Step 4: Shell Template & Layout CSS

### Template Options (Pick the one matching your Angular version):

#### Option A: Modern Angular (Angular 17+ with `@if` and `@for`)
```html
<div class="app-shell">
  <!-- Optional header if present in your app -->

  <div class="app-shell__body">
    <aside class="app-sidebar">
      <!-- Existing sidebar content -->
      <button type="button" (click)="toggleChat()">AI</button>
    </aside>

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

      <section class="acp-workspace__stage">
        <!-- Main routed application content -->
        <main class="acp-workspace__content">
          <router-outlet></router-outlet>
        </main>

        <!-- Dynamic Form & Workspace layer directly beside chat -->
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
      </section>
    </div>
  </div>
</div>
```

#### Option B: Classic / NgModule Angular (`*ngIf` and `*ngFor`)
```html
<div class="app-shell">
  <div class="app-shell__body">
    <aside class="app-sidebar">
      <button type="button" (click)="toggleChat()">AI</button>
    </aside>

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

      <section class="acp-workspace__stage">
        <main class="acp-workspace__content">
          <router-outlet></router-outlet>
        </main>

        <div class="acp-workspace__form-layer">
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

```css
/* Shell flex height propagation */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.app-shell__body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Workspace container */
.acp-workspace {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--acp-stage-bg);
}

/* Chat Column: full height, docked next to sidebar */
.acp-workspace__chat {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  align-self: stretch;
}

.acp-workspace__chat > acp-chat-panel {
  display: block;
  height: 100%;
}

/* Stage Area: owns routed content and dynamic form overlay */
.acp-workspace__stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Routed Page Content: MUST NOT reflow on resize; it scrolls horizontally */
.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

/* Dynamic form layer: sits directly adjacent to chat */
.acp-workspace__form-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  overflow-x: auto;
  pointer-events: none; /* allows clicking routed content where form is absent */
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

## Verification Checklist

Before considering the task complete, verify every item:

- [ ] **Single Sidebar Button**: The sidebar has exactly one AI button that toggles chat open/closed.
- [ ] **Docking Order**: Chat renders directly next to sidebar (left side of content, NOT on the right).
- [ ] **Full Height**: Chat spans 100% of the workspace body height.
- [ ] **No Overlay for Chat**: Chat pushes the content container; it does not float over it.
- [ ] **No Page Reflow**: Resizing the chat narrows the content container and enables scrolling if needed; it does NOT reflow internal dashboard cards/grids.
- [ ] **Dynamic Forms**: Typing `/form create enroll student form` opens `<acp-dynamic-container>` docked next to chat inside the stage.
- [ ] **Form Resizing**: The dynamic form resizes independently and updates its width via `(acp-form-width-change)`.
- [ ] **Opaque Surfaces**: The dynamic form and chat backgrounds are completely opaque (no text bleed-through from routed content).
- [ ] **Design Tokens Applied**: Colors and spacing match the host application via CSS variables (`--acp-*`).
- [ ] **Build Success**: `npm run build` succeeds with zero template or schema errors.
