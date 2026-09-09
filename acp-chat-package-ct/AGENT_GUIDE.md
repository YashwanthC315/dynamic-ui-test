# ACP Chat Panel — Angular 22 Integration Agent Guide

## Goal

Integrate the installed `@acp/chat-panel` package into the existing Angular 22 application so the existing sidebar contains a chat launch button, and the chat panel + any open dynamic-container form(s) form one contiguous full-height block **docked immediately next to the sidebar**. The routed application content is the last item in that row and fills whatever space remains.

The chat and the dynamic container are workspace panels, not overlays.

> **If you take away only one thing from this document:** the DOM order, left to right, is always
> `sidebar → chat panel → dynamic container(s), in the order they were opened → routed content`.
> The routed content is **always the last child**. It is never sandwiched between the chat panel and a dynamic container. This single ordering rule is the most common integration mistake — see the "Known failure mode" callout in section 9 before you write any template code.

## Rules

1. Do not create an `NgModule` solely for this integration. Use the standalone component.
2. Do not use `position: fixed`, `position: absolute`, `z-index` layering, CDK Overlay, Material Drawer overlay mode, or a floating dialog for the chat panel **or** the dynamic container. Both are plain flex children in normal document flow.
3. The chat panel, every open dynamic container, and the routed application content must all be siblings in the *same* horizontal flex container (`.acp-workspace`). Their DOM order is fixed and non-negotiable:
   1. chat panel (if open)
   2. dynamic container(s) (one per open form, in the order opened)
   3. routed content — **always last**
4. Resizing the chat (or a dynamic container) must resize the *available width* of the routed content container. It must not visibly reflow, rearrange, or resize the internal layout of the routed dashboard/home page itself (no grid re-columning, no card resizing, no re-wrapping). The routed page keeps its own layout; if that layout is wider than the space available, the content container scrolls horizontally rather than the page's internal grid recomputing.
5. Preserve the host application's existing sidebar, header, footer, router outlet, routing, and page behavior. Make the smallest integration change possible.
6. Do not rewrite the package component's CSS to match the host app. Apply the host theme through the `acp-*` classes in a global theme stylesheet.
7. Do not hard-code application-specific colors, typography, or spacing into the package usage markup.
8. The chat panel and every open dynamic container must visually span the **full height** of the workspace row — from directly under the persistent header to directly above the persistent footer (if any) — for as long as they are open. Neither should collapse to the height of its own content.

## 1. Locate the application shell

Find the component/template that owns the persistent layout containing:

- the left navigation/sidebar;
- the main routed page area (`router-outlet` or equivalent);
- the persistent application header/footer, if applicable.

Do not place the chat inside an individual dashboard/home page component. It belongs at the shell/workspace level so it survives route changes.

## 2. Register the package custom element

This package exports native custom elements, not Angular standalone components.

Import the package once (for example in `src/main.ts`):

```ts
import '@acp/chat-panel';
```

In the standalone shell component, allow custom elements:

```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppShellComponent {}
```

If using `*ngIf`/`*ngFor`, also import `CommonModule` in that standalone component. If using Angular control flow (`@if`, `@for`), `CommonModule` is not required just for conditional/list rendering.

## 3. Add shell state

Add state equivalent to:

```ts
chatOpen = false;
chatWidth = 360;

interface OpenForm {
  instanceId: string;   // unique per opened form, NOT the same as formId
  formSpec: any;        // the formSpec payload from acp-form-requested
  width: number;
}

openForms: OpenForm[] = [];
```

Keep all of this state in the shell, not in individual routed pages.

The integration may persist `chatWidth` if the application already has an appropriate preference/state mechanism. Do not add a new backend persistence mechanism just for panel width.

`openForms` is a plain array, not a single optional value — multiple forms must be able to stay open side by side (see section 9).

## 4. Add the launch button to the existing sidebar

Add one navigation/action button to the existing sidebar. Its action should toggle `chatOpen`.

Use the application's existing button/icon component and styling conventions where possible.

Conceptually:

```html
<button type="button" (click)="chatOpen = !chatOpen">
  AI
</button>
```

The exact markup, icon, tooltip, label, and location should match the existing sidebar implementation.

The button is the launch control. Do not create a second floating launcher elsewhere on the page.

## 5. Create the non-overlay workspace

**The full workspace row, including dynamic containers, in one place.** Build the template exactly to this skeleton — do not reorder these blocks, and do not build the chat block and the dynamic-container block as two separate, unrelated pieces of work. They belong to the same flex row and their relative order is what makes the layout correct:

```html
<div class="acp-workspace">

  <!-- 1) CHAT — first, directly against the sidebar -->
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

  <!-- 2) DYNAMIC CONTAINER(S) — second, directly after chat, BEFORE content.
       One <div> wrapper + one <acp-dynamic-container> per open form. -->
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

  <!-- 3) ROUTED CONTENT — always LAST, never before a dynamic container -->
  <main class="acp-workspace__content">
    <router-outlet />
  </main>

</div>
```

This ordering matters. Every dynamic container renders **between** the chat panel and `.acp-workspace__content`. Nothing about opening or closing a form ever changes where `.acp-workspace__content` sits in the DOM — it is structurally always the final child of `.acp-workspace`.

Adapt the markup to the actual shell (existing wrapper divs, existing router-outlet host, etc.), but never change the relative order of these three blocks.

Required layout properties:

```css
.acp-workspace {
  display: flex;
  align-items: stretch;   /* forces chat/dynamic-container/content to full row height */
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acp-workspace__chat {
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
}

.acp-workspace__dynamic {
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
}

.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
```

`.acp-workspace__chat` and `.acp-workspace__dynamic` use the same pattern on purpose: both are fixed-width flex items that stretch to the full height of the row via `align-items: stretch` on the parent, and both sit before `.acp-workspace__content`. If the application already has an equivalent flex/grid workspace, reuse it instead of adding a duplicate wrapper, but keep this same three-slot ordering and the `height: 100%` / `align-items: stretch` behavior.

## 6. Preserve the panel as a real layout column

The important behavior, with no form open:

```text
┌──────────────┬───────────────────────────────────────────────┐
│ AI Agent     │ existing application content                  │
│ chat         │ dashboard / home / routed page                │
│              │                                                │
│              │                                                │
└──────────────┴───────────────────────────────────────────────┘
        ↑
  chat sits directly against the sidebar;
  content fills the remaining space and
  simply gets a narrower or wider viewport —
  its own internal layout does not reflow
```

Do not produce this behavior:

```text
┌───────────────────────────────────────────────────────────────┐
│ dashboard content                               ┌────────────┐│
│                                                │ AI Agent   ││
│                                                │ overlay/   ││
│                                                │ right dock ││
└────────────────────────────────────────────────┴────────────┘│
```

Rendering the chat to the right of the routed content (or as an overlay on top of it) is explicitly prohibited — the chat must dock directly next to the sidebar, on the left of the content area.

Also avoid this, where resizing forces the dashboard's own grid to visibly re-layout:

```text
Panel widened →  [chat: wider] [dashboard: cards re-wrap/shrink/reflow]  ✗
Panel widened →  [chat: wider] [dashboard: same layout, less viewport]  ✓
```

The routed page's internal content (card sizes, grid columns, etc.) should stay visually stable across a resize. Only the amount of viewport available to it changes.

## 7. Resizing

The package already provides the resize handle and emits `acp-width-change` (chat) / `acp-form-width-change` (dynamic container).

Set `dock="left"` on `acp-chat-panel` so the resize handle appears on the panel's right edge, adjacent to whatever comes next (a dynamic container, or the routed content).

The integration must:

- keep the chat, and every dynamic container, as flex items positioned before `.acp-workspace__content`;
- bind the current width to `[width]` (chat) / `[formWidth]` (dynamic container);
- update shell state from `(acp-width-change)` / `(acp-form-width-change)`;
- keep sensible bounds — normally 260–640 px for chat, 320–560 px for a form;
- give `.acp-workspace__content` `min-width: 0` so flexbox can shrink its container, and `overflow: auto` so its own content can scroll horizontally instead of being forced to reflow;
- verify that the application does not have a parent `min-width` or fixed width that prevents the content column from shrinking;
- avoid triggering any responsive/container-query logic in the routed page that would cause it to re-layout in response to the container width change — the content should scroll rather than rearrange.

Do not implement a second resize handler in the application unless the package behavior is demonstrably incompatible with the host shell.

## 8. Theme integration

The package exposes stable ACP selectors. The application should define the visual theme globally.

Start from `styles/acp-chat-panel.theme.css` and adapt its values to the application's design system. Keep the selector names intact.

Required selectors include:

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

Treat these selectors as the ACP theme contract. The component supplies structural defaults; the host application supplies design-token values.

If the application uses CSS custom properties/design tokens, map them in these selectors, for example:

```css
.acp-header {
  background: var(--app-surface);
  color: var(--app-primary);
  border-color: var(--app-border);
}
```

Do not introduce a second unrelated token system.

## 9. Dynamic container addendum

This package also ships `<acp-dynamic-container>` in the same runtime bundle.

### Purpose

- Keep chat and dynamic container(s) as sibling workspace surfaces.
- Open a form surface from chat text commands.
- Keep host application business logic (options, submission handlers, APIs) outside package internals.

### ⚠️ Known failure mode — read before implementing

The single most common integration mistake with weaker agent models is appending the dynamic container **after** `.acp-workspace__content` instead of **before** it. This produces the routed dashboard visually sandwiched between the chat panel and the form, like this — **do not build this**:

```text
✗ WRONG — dynamic container appended after content:

┌──────┬─────────────────────────────────┬──────────────┐
│ chat │ dashboard / routed content      │ dynamic      │
│      │ (visible in the middle)         │ container    │
└──────┴─────────────────────────────────┴──────────────┘
   DOM order: chat, content, dynamic-container   ✗ WRONG
```

```text
✓ CORRECT — dynamic container inserted before content:

┌──────┬──────────────┬─────────────────────────────────┐
│ chat │ dynamic      │ dashboard / routed content       │
│      │ container    │ (pushed right, scrolls if tight) │
└──────┴──────────────┴─────────────────────────────────┘
   DOM order: chat, dynamic-container, content   ✓ CORRECT
```

The dynamic container must sit directly against the chat panel's right edge, exactly like the chat panel sits directly against the sidebar. `.acp-workspace__content` (the `<main>` wrapping `<router-outlet>`) must remain the **last** child of `.acp-workspace` at all times, whether zero, one, or several forms are open. Opening or closing a form never moves `.acp-workspace__content` — it only inserts/removes `.acp-workspace__dynamic` elements before it. See the exact template in section 5 — copy it verbatim rather than re-deriving this ordering.

### Chat → form trigger

`<acp-chat-panel>` emits `acp-form-requested` when a sent message starts with the configured trigger prefix.

Default prefix: `/form`

Supported examples:

- `/form create student`
- `/form create enroll student form` (recommended test command)
- `/form:create student`
- `/form {"formId":"create-student","title":"Create Student","fields":[{"id":"name","label":"Name","type":"text","required":true}]}`

Recommended student-enrollment test command details:

- command: `/form create enroll student form`
- generated fields: Name, Date Of Birth, Gender, Course, Email (EXTRA), Mobile (EXTRA), Father Name (EXTRA)

Event payload shape:

```ts
{
  formSpec: {
    formId: string;
    title: string;
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';
      required?: boolean;
      disabled?: boolean;
      placeholder?: string;
      optionsSource?: string;
      options?: Array<{ label: string; value: string }>;
      validation?: { min?: number; max?: number; maxLength?: number };
    }>;
  }
}
```

### Dynamic container API

Inputs/properties:

- `open`
- `title`
- `formWidth` / `form-width`
- `minFormWidth` / `min-form-width`
- `maxFormWidth` / `max-form-width`
- `formSpec`

Events:

- `acp-open-change`
- `acp-form-width-change`
- `acp-submitted` (`{ formId, values }`)
- `acp-cancelled`

Note: the dynamic container exposes a small top-right close control that closes the container, and each form also includes a secondary button whose label defaults to `Close` (host can override via `cancelLabel`).

### Host wiring (the only supported path for this integration)

Use explicit host wiring — this is the tested, recommended path, not "Option A among several":

1. Listen to `(acp-form-requested)` on `<acp-chat-panel>` and **push** a new entry into `openForms` (do not replace the array's existing contents — multiple `/form ...` requests must be able to stay open at once, each as its own `<acp-dynamic-container>`).
2. Generate a unique `instanceId` per pushed entry (e.g. `formSpec.formId + '-' + Date.now()`), since the same `formId` could in principle be requested twice.
3. Render dynamic containers with `@for` (or `*ngFor`) over `openForms`, tracking by `instanceId`, in the exact template position shown in section 5 (between chat and content — never after content).
4. Wire `(acp-cancelled)` and `(acp-open-change)` per instance to remove that one entry from `openForms` by `instanceId`, so each form closes independently without affecting the others.
5. Wire `(acp-submitted)` to the host's own form-submission handling for that `formId`; on success, also remove the corresponding entry from `openForms`.

Example handlers:

```ts
onFormRequested(detail: { formSpec: any }) {
  this.openForms.push({
    instanceId: `${detail.formSpec.formId}-${Date.now()}`,
    formSpec: detail.formSpec,
    width: 360
  });
}

onFormClosed(instanceId: string) {
  this.openForms = this.openForms.filter(f => f.instanceId !== instanceId);
}

onFormOpenChange(instanceId: string, isOpen: boolean) {
  if (!isOpen) this.onFormClosed(instanceId);
}

onFormWidthChange(instanceId: string, width: number) {
  const form = this.openForms.find(f => f.instanceId === instanceId);
  if (form) form.width = width;
}

onFormSubmitted(instanceId: string, detail: { formId: string; values: any }) {
  // route detail.values to the host's existing submission handling for detail.formId
  this.onFormClosed(instanceId);
}
```

Do not use the package's document-level auto-listener behavior for `acp-form-requested` for this integration — explicit host wiring is required so the host fully owns the `openForms` collection and each instance's independent close behavior.

### Local run configuration

For the tested reference host state, configure the Angular start script to run on port `4300` instead of the CLI default `4200`.

### Validation and supported field types

Supported types are fixed and deterministic:

- `text`
- `number`
- `date`
- `checkbox`
- `select`
- `textarea`

Unsupported/unknown field types are normalized by the package runtime to safe defaults.

## 10. Message behavior

The package does not make assumptions about the AI backend.

When `(acp-message-sent)` fires, connect it to the application's existing chat/agent service or API. Do not add a fake backend, HTTP endpoint, authentication flow, or LLM integration unless the host application already requires it.

The host must own chat messages and bind them via `[messages]`; do not only log `(acp-message-sent)`.

## 11. Avoid common Angular errors

To avoid the exact build errors seen earlier:

- Do not import `AcpChatPanelComponent` (or an equivalent dynamic-container class) from `@acp/chat-panel` — neither is exported as an Angular component.
- Register with `import '@acp/chat-panel';` once at app startup.
- For standalone components, use `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.
- Use package event names exactly: `acp-open-change`, `acp-width-change`, `acp-message-sent`, `acp-new-chat`, `acp-help`, `acp-form-requested`, `acp-form-width-change`, `acp-submitted`, `acp-cancelled`.
- In strict Angular templates, read event payload as `$any($event).detail`.
- Define ACP theme selectors in global styles (for example `src/styles.css`), not component-scoped styles.

To avoid the runtime/layout issues seen later:

- Do not re-render the full custom element on every textarea `input` event inside the package runtime; update draft/counter/send state without replacing the textarea node, otherwise the caret jumps to the start and typing appears reversed.
- Do not place `.acp-workspace__chat` after `.acp-workspace__content` in the DOM — this causes the chat to render on the right of the dashboard instead of next to the sidebar.
- **Do not place `.acp-workspace__dynamic` after `.acp-workspace__content` in the DOM** — this causes a submitted-looking layout where the dashboard is visibly sandwiched between the chat and the form, instead of the form sitting directly against the chat with the dashboard pushed to the far right. See the diagram in section 9.
- Do not let `.acp-workspace__chat` or `.acp-workspace__dynamic` collapse to their own content height — the parent `.acp-workspace` needs `align-items: stretch` and both children need `height: 100%`, so each spans the full row height for as long as it is open.
- Do not let the routed page's own CSS respond to the shrinking container (e.g. container queries, JS-measured breakpoints) in a way that re-flows its grid on resize — this produces visible dashboard reflow, which is prohibited. Let the content scroll instead.

## 12. Verification checklist

Before finishing, verify all of the following:

- [ ] The sidebar contains exactly one chat launch control.
- [ ] Clicking the control opens/closes the panel.
- [ ] The panel is at the shell/workspace level, not inside the dashboard page.
- [ ] The panel is not an overlay.
- [ ] No fixed/absolute positioning is used to create the chat or a dynamic container.
- [ ] The chat panel renders directly adjacent to the sidebar.
- [ ] Sending `/form create enroll student form` opens a dynamic container **directly against the chat panel's right edge**, with the routed dashboard/home content pushed further right — not with the dashboard visible between the chat and the form.
- [ ] Inspect the rendered DOM directly (e.g. browser devtools) and confirm the literal child order of `.acp-workspace` is: `.acp-workspace__chat` (if open) → one `.acp-workspace__dynamic` per open form → `.acp-workspace__content`, in that order, with `.acp-workspace__content` always last.
- [ ] Sending a second `/form ...` command opens a second dynamic container beside the first, without closing or replacing it; both can be closed independently.
- [ ] The chat panel and every open dynamic container visually span the full height of the workspace row (top to bottom), not just the height of their own content.
- [ ] Increasing chat or form width narrows the content container's available space; decreasing it widens that space.
- [ ] The dashboard/home page's own internal layout (grid columns, card sizing) stays visually unchanged as the chat/form is resized — no reflow, rearranging, or resizing of its content. The content area scrolls if it doesn't fit.
- [ ] The resize handle works with pointer dragging, for both chat and dynamic containers.
- [ ] Keyboard arrow resizing works when a resize handle is focused.
- [ ] The panel(s) remain usable at minimum and maximum width.
- [ ] Route changes do not destroy the shell-level chat/open-forms state unexpectedly.
- [ ] The ACP theme is defined through the host's design tokens/global theme.
- [ ] Existing application styles, header, and footer are not unintentionally changed.
- [ ] `npm run build` / the application's normal Angular build completes successfully.

## Non-goals

Do not:

- create a new application shell;
- create an NgModule solely for the package;
- implement an AI/LLM service;
- implement authentication;
- replace the existing sidebar;
- create an overlay/drawer/modal for the chat panel or the dynamic container;
- render the chat panel to the right of the routed content instead of next to the sidebar;
- render a dynamic container after the routed content instead of directly against the chat panel;
- make the routed dashboard/home page reflow its own internal layout in response to chat/form resizing;
- modify routed dashboard/home components just to make the panel(s) fit;
- hard-code a brand theme into application components outside the ACP theme selectors.
