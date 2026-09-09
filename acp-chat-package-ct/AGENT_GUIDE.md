# ACP Chat Panel — Angular 22 Integration Agent Guide

## Goal (read this first)

Integrate `@acp/chat-panel` so the **sidebar, chat panel, dynamic form(s), and routed page** form one continuous horizontal flex row under the app header.

**Correct visual result (required):**

```
┌────────┬──────────────┬─────────────────┬──────────────────────────────┐
│sidebar │ AI Agent     │ Student         │ Dashboard / routed content   │
│ (nav)  │ chat panel   │ Enrollment Form │ (pushed right; may scroll)   │
│        │ FULL HEIGHT  │ FULL HEIGHT     │                              │
│        │              │                 │                              │
└────────┴──────────────┴─────────────────┴──────────────────────────────┘
```

- Chat is **directly next to the sidebar**, full height (header → footer).
- Every open dynamic form sits **directly next to the chat** (or the previous form), also full height.
- The dashboard / routed page is **always the rightmost column**. It never sits between chat and a form.
- Nothing is an overlay, drawer, modal, or `position: fixed/absolute` panel.

**Wrong result (forbidden — matches the broken screenshot):**

```
┌────────┬──────────────────────────────────────────────┬─────────────────┐
│sidebar │ Dashboard / routed content                   │ Student Form    │
│        │ (still full width in the middle)             │ (floating right)│
└────────┴──────────────────────────────────────────────┴─────────────────┘
```

or any layout where the form appears as a right-side panel *over* or *beside* an unchanged dashboard while chat is only a left column that does not push content.

---

## Hard rules (never violate)

1. **No overlay.** Never use `position: fixed`, `position: absolute`, `z-index`, CDK Overlay, MatDrawer in overlay mode, dialog, or floating panel for chat or dynamic container.
2. **One flex row only.** Chat, every dynamic container, and the routed content are **siblings** inside a single horizontal flex container (`.acp-workspace`).
3. **Fixed DOM order (non-negotiable):**
   ```
   .acp-workspace
     ├── .acp-workspace__chat          (if chatOpen)
     ├── .acp-workspace__dynamic       (one per open form, in open order)
     └── .acp-workspace__content       ← ALWAYS LAST (router-outlet lives here)
   ```
   Opening or closing a form must **never** move `.acp-workspace__content`. It only inserts/removes `.acp-workspace__dynamic` nodes *before* it.
4. **Full height.** Chat and every dynamic container must stretch from under the header to above the footer. Use `align-items: stretch` on the row + `height: 100%` on the panel wrappers. They must not collapse to content height.
5. **Resize only changes available width.** Widening chat/form shrinks the content column. The dashboard’s internal grid/cards must **not** reflow or re-column. Content scrolls horizontally if needed (`overflow: auto; min-width: 0`).
6. **Shell only.** Put chat state, open-forms state, and the workspace template in the application **shell** (the component that owns sidebar + header + router-outlet). Never put them inside a dashboard/home page component.
7. **Smallest change.** Keep existing sidebar, header, footer, routing, and page components. Do not create a new shell or NgModule just for this package.
8. **No `any` / index-signature types** for form payloads (see typing section). Use the exact interfaces below.

---

## 1. Register the custom elements

In `src/main.ts` (once):

```ts
import '@acp/chat-panel';
```

In the **shell** standalone component:

```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // ...
})
export class AppShellComponent {}
```

(If you still use `*ngIf`/`*ngFor`, also import `CommonModule`. Angular control flow `@if`/`@for` does not need it.)

---

## 2. Shell state

Keep this state **only** in the shell:

```ts
chatOpen = false;
chatWidth = 360;

interface AcpFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  optionsSource?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: { min?: number; max?: number; maxLength?: number };
}

interface AcpFormSpec {
  formId: string;
  title: string;
  fields: AcpFormField[];
}

interface OpenForm {
  instanceId: string;   // unique per open instance (formId + timestamp)
  formSpec: AcpFormSpec;
  width: number;
}

openForms: OpenForm[] = [];
```

`openForms` is an **array**. Multiple forms stay open side-by-side; each closes independently.

---

## 3. Sidebar launch button

Add **one** button/icon to the **existing** sidebar that toggles `chatOpen`. Match the host’s button style and icon conventions. Do not add a second floating launcher.

```html
<button type="button" (click)="chatOpen = !chatOpen">AI</button>
```

---

## 4. Workspace template (copy this structure exactly)

The three blocks below **must** appear in this order inside the same flex parent. Do not reorder them. Do not put the dynamic containers after the content. Do not put the chat after the content.

```html
<div class="acp-workspace">

  <!-- 1. CHAT — first child, directly against the sidebar -->
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
        (acp-new-chat)="onNewChat()"
        (acp-help)="onChatHelp()"
        (acp-form-requested)="onFormRequested($any($event).detail)"
      />
    </div>
  }

  <!-- 2. DYNAMIC FORM(S) — immediately after chat, BEFORE content -->
  @for (form of openForms; track form.instanceId) {
    <div class="acp-workspace__dynamic">
      <acp-dynamic-container
        [open]="true"
        [title]="form.formSpec.title"
        [formWidth]="form.width"
        [minFormWidth]="320"
        [maxFormWidth]="560"
        [formSpec]="form.formSpec"
        (acp-form-width-change)="onFormWidthChange(form.instanceId, $any($event).detail)"
        (acp-submitted)="onFormSubmitted(form.instanceId, $any($event).detail)"
        (acp-cancelled)="onFormClosed(form.instanceId)"
        (acp-open-change)="onFormOpenChange(form.instanceId, $any($event).detail)"
      />
    </div>
  }

  <!-- 3. ROUTED CONTENT — ALWAYS the last child -->
  <main class="acp-workspace__content">
    <router-outlet />
  </main>

</div>
```

If the shell already has a main content wrapper, reuse it as `.acp-workspace__content`. Never insert a dynamic container after this main element.

---

## 5. Required CSS (global or shell styles)

```css
.acp-workspace {
  display: flex;
  align-items: stretch;   /* critical: forces full-height panels */
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acp-workspace__chat,
.acp-workspace__dynamic {
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
}

.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;           /* allows the column to shrink */
  min-height: 0;
  overflow: auto;         /* scroll instead of reflowing dashboard */
}
```

Ensure no parent of `.acp-workspace` has a fixed width or `min-width` that prevents the content column from shrinking.

---

## 6. Form request / close / submit handlers

Use this exact helper (do not invent your own validation):

```ts
function toAcpFormSpec(raw: unknown): AcpFormSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { formId?: unknown; title?: unknown; fields?: unknown };
  if (typeof obj.formId !== 'string' || typeof obj.title !== 'string' || !Array.isArray(obj.fields)) {
    return null;
  }
  return { formId: obj.formId, title: obj.title, fields: obj.fields as AcpFormField[] };
}
```

```ts
onFormRequested(detail: { formSpec?: unknown } | null): void {
  const spec = toAcpFormSpec(detail?.formSpec);
  if (!spec) return;
  this.openForms = [
    ...this.openForms,
    {
      instanceId: `${spec.formId}-${Date.now()}`,
      formSpec: spec,
      width: 360
    }
  ];
}

onFormClosed(instanceId: string): void {
  this.openForms = this.openForms.filter(f => f.instanceId !== instanceId);
}

onFormOpenChange(instanceId: string, isOpen: boolean): void {
  if (!isOpen) this.onFormClosed(instanceId);
}

onFormWidthChange(instanceId: string, width: number): void {
  const form = this.openForms.find(f => f.instanceId === instanceId);
  if (form) form.width = width;
}

onFormSubmitted(instanceId: string, detail: { formId: string; values: Record<string, unknown> }): void {
  // Hand detail.values to the host’s existing submission logic for detail.formId
  this.onFormClosed(instanceId);
}
```

- Always **push** onto `openForms`; never replace the whole array with a single form.
- Each form closes independently via its own `instanceId`.
- Do **not** rely on the package’s document-level auto-listener; wire `(acp-form-requested)` explicitly on the chat panel.

Test command that must open the form correctly:

```
/form create enroll student form
```

---

## 7. Theme

Do not restyle the package internals. Map host design tokens onto the package’s stable selectors in a **global** stylesheet (e.g. `src/styles.css` or `styles/acp-chat-panel.theme.css`):

```text
.acp-panel
.acp-header
.acp-header__title
.acp-header__actions
.acp-icon-button
.acp-messages
.acp-message
.acp-message--user
.acp-message__bubble
.acp-message__time
.acp-empty-state
.acp-composer
.acp-input
.acp-composer__bottom
.acp-counter
.acp-send
.acp-resize-handle
```

Example:

```css
.acp-header {
  background: var(--app-surface);
  color: var(--app-primary);
  border-color: var(--app-border);
}
```

---

## 8. Message handling

The package does not talk to an LLM. On `(acp-message-sent)` call the host’s existing chat/agent service and keep the message list in shell state bound to `[messages]`. Do not invent a fake backend.

---

## 9. Common failures and how to avoid them

| Failure (what you must not ship) | Cause | Fix |
|----------------------------------|-------|-----|
| Form appears on the far right of the dashboard; dashboard stays in the middle | Dynamic container placed **after** `.acp-workspace__content` | Move every `.acp-workspace__dynamic` so it is a sibling **before** the content main |
| Chat is only as tall as its messages | Missing `align-items: stretch` or `height: 100%` on wrappers | Apply the exact CSS in section 5 |
| Dashboard cards reflow when chat is resized | Content column has no `min-width: 0` / `overflow: auto`, or page uses container queries that react to width | Keep content scrolling; do not let the page re-layout |
| Chat renders to the right of the dashboard | Chat placed after content in the DOM | Chat must be the first child of `.acp-workspace` (when open) |
| Only one form can be open | `openForms` treated as a single value instead of an array | Always push; track by `instanceId` |
| TS4111 / property access errors | `formSpec` typed as `any` or `Record<string, any>` | Use the exact interfaces in section 2 and `toAcpFormSpec` |
| Build fails on clean CI | Stale `.angular/cache` or wrong import of a non-existent Angular component | `import '@acp/chat-panel';` only; `CUSTOM_ELEMENTS_SCHEMA`; clear cache before verifying |

---

## 10. Verification checklist (must all pass)

- [ ] Sidebar has exactly one chat launch control.
- [ ] Chat opens/closes from that control and is **full height** next to the sidebar.
- [ ] Chat and forms are **not** overlays / fixed / absolute.
- [ ] DOM order inside `.acp-workspace` is always: chat (if open) → dynamic container(s) → content. Content is never between chat and a form.
- [ ] `/form create enroll student form` opens a full-height form **directly against the chat’s right edge**; the dashboard is pushed further right.
- [ ] A second `/form ...` opens another form beside the first; both close independently.
- [ ] Resizing chat or form only changes the content column’s width; dashboard internal layout does not reflow.
- [ ] Resize handles work with pointer and keyboard.
- [ ] Route changes do not destroy shell chat/form state.
- [ ] Theme uses only the `acp-*` selectors in global styles.
- [ ] Clean build (`rm -rf .angular/cache && npm run build`) succeeds.
- [ ] No event payload is typed as `any` or an index-signature type.

---

## Non-goals

Do not:

- create a new application shell or NgModule solely for this package;
- implement an AI/LLM service, auth, or backend;
- replace the existing sidebar;
- use overlay / drawer / modal / fixed positioning for chat or forms;
- put the chat or a form after the routed content in the DOM;
- make the dashboard reflow its own grid when panels resize;
- hard-code brand colors into package markup outside the ACP theme selectors.

---

## One-sentence summary for the agent

**Build a single full-height flex row whose children are, in this exact order: chat panel (optional) → zero or more dynamic form panels → the existing router-outlet content; never reverse or interleave that order, and never use overlays.**
