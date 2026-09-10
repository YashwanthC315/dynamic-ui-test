# ACP Chat Panel — Angular 22 Integration Agent Guide

## Goal

Integrate the installed `@acp/chat-panel` package into the existing Angular 22 application so the existing sidebar contains a chat launch button and the chat panel opens **beside** the application's routed content — docked immediately next to the sidebar, with the routed content filling the remaining space to its right.

The chat column must fill the full available workspace height from the shell's top boundary to its bottom boundary. When a dynamic form is opened, it must appear immediately to the right of the chat panel inside the main workspace stage, visually on top of the dashboard/home content area rather than as a detached right-edge drawer.

The chat is a workspace panel, not an overlay.

## Rules

1. Do not create an `NgModule` solely for this integration. Use the standalone component.
2. Do not use `position: fixed`, `position: absolute`, `z-index` layering, CDK Overlay, Material Drawer overlay mode, or a floating dialog for the chat.
3. The chat and the routed application content must be siblings in the same horizontal layout container, with the chat panel positioned directly after the sidebar and before the routed content — not after it.
4. Resizing the chat must resize the *available width* of the content container. It must not visibly reflow, rearrange, or resize the internal layout of the routed dashboard/home page itself (no grid re-columning, no card resizing, no re-wrapping). The routed page keeps its own layout; if that layout is wider than the space available, the content container scrolls horizontally rather than the page's internal grid recomputing.
5. Preserve the host application's existing sidebar, header, router outlet, routing, and page behavior. Make the smallest integration change possible.
6. Do not rewrite the package component's CSS to match the host app. Apply the host theme through the `acp-*` classes in a global theme stylesheet.
7. Do not hard-code application-specific colors, typography, or spacing into the package usage markup.
8. The workspace region under the shell header/footer must resolve to one stable horizontal row: sidebar | chat column | main stage. Do not place the chat inside a routed page component or inside a card/grid owned by the dashboard.
9. The dynamic container must open from the left edge of the main stage, directly adjacent to the chat column. It may visually cover the routed page inside that stage, but it must not appear as a viewport-right drawer separated from the chat.
10. Open dynamic forms as resizable workspace surfaces. Bind their current width from shell state and update that state from the package resize event.

## Critical layout outcome

Lower-end models often get this wrong. The required shell-level composition is exactly:

```text
┌ sidebar ┬ chat column (full height) ┬ stage area ───────────────────────┐
│         │                           │ form surface when open            │
│         │                           │ routed page remains behind stage  │
│         │                           │ surface / in remaining stage      │
└─────────┴───────────────────────────┴────────────────────────────────────┘
```

Do not produce either of these incorrect results:

```text
wrong 1: sidebar | dashboard page | chat panel on far right
wrong 2: sidebar | short chat box inside dashboard card area | form drawer on far right
```

## 1. Locate the application shell

Find the component/template that owns the persistent layout containing:

- the left navigation/sidebar;
- the main routed page area (`router-outlet` or equivalent);
- the persistent application header/footer, if applicable.

Do not place the chat inside an individual dashboard/home page component. It belongs at the shell/workspace level so it survives route changes.

If the application has a persistent header and footer, the integration target is the shell body between them. The shell body must itself be full height and must contain the sidebar and workspace row. If the chat is inserted inside the routed page instead, it will usually render like a short embedded panel instead of a full-height workspace column.

## 2. Register the package custom element

This package exports a native custom element, not an Angular standalone component.

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

If using `*ngIf`, also import `CommonModule` in that standalone component. If using Angular control flow `@if`, `CommonModule` is not required just for conditional rendering.

## 3. Add shell state

Add state equivalent to:

```ts
chatOpen = false;
chatWidth = 360;
openForms = [];
```

Keep these values in the shell, not in individual routed pages.

The integration may persist `chatWidth` if the application already has an appropriate preference/state mechanism. Do not add a new backend persistence mechanism just for panel width.

If the host supports multiple simultaneous forms, `openForms` should be a collection of form instances kept in shell state. Do not keep only one routed-page-local form reference.

Each form instance should carry its own width state so resizing one form does not reset or resize other open forms. A typical shell-owned form item looks like:

```ts
{
  id: string;
  title: string;
  formSpec: unknown;
  formWidth: number;
}
```

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

Use the shell-level structure below. This exact shape is intentional because it removes ambiguity for integration agents.

The chat panel sits **immediately next to the sidebar**, as the first child of the workspace row. The main stage is the sibling that follows it and fills the remaining space. The stage owns the routed content and any dynamic form surfaces.

```html
<div class="app-shell">
  <header>...</header>

  <div class="app-shell__body">
    <aside class="app-sidebar">
      <!-- existing sidebar -->
      <button type="button" (click)="chatOpen = !chatOpen">AI</button>
    </aside>

    <section class="acp-workspace">
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
            (acp-form-requested)="onFormRequested($any($event).detail)"
            (acp-new-chat)="onNewChat()"
            (acp-help)="onChatHelp()"
          />
        </div>
      }

      <section class="acp-workspace__stage">
        <main class="acp-workspace__content">
          <router-outlet />
        </main>

        <div class="acp-workspace__form-layer">
          @for (form of openForms; track form.id) {
            <acp-dynamic-container
              class="acp-workspace__form"
              [open]="true"
              [title]="form.title"
              [formWidth]="form.formWidth"
              [minFormWidth]="320"
              [maxFormWidth]="720"
              [formSpec]="form.formSpec"
              (acp-open-change)="onFormOpenChange(form.id, $any($event).detail)"
              (acp-form-width-change)="onFormWidthChange(form.id, $any($event).detail)"
              (acp-submitted)="onFormSubmitted(form.id, $any($event).detail)"
              (acp-cancelled)="closeForm(form.id)"
            />
          }
        </div>
      </section>
    </section>
  </div>

  <footer>...</footer>
</div>
```

If the host already has equivalent shell wrappers, adapt the example to those existing wrappers. Do not move the chat or form into a routed page component.

This ordering matters:

- the chat column must come before the stage in DOM order;
- the form layer must live inside the stage, not as a sibling after the stage;
- the form surface must start at the stage's left edge so it appears immediately next to the chat column.
- each dynamic container must bind its own width and listen to `acp-form-width-change` so the resize handle actually works.

Do not append the chat after the content. Do not mount the dynamic container at the far right edge of the shell.

Adapt the markup to the actual shell. Do not blindly duplicate the example if the application already has a workspace wrapper.

Required layout properties:

```css
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 0;
}

.app-shell__body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acp-workspace {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acp-workspace__chat {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
}

.acp-workspace__chat > acp-chat-panel {
  display: block;
  height: 100%;
}

.acp-workspace__stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.acp-workspace__form-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  overflow: auto;
  pointer-events: none;
}

.acp-workspace__form {
  flex: 0 0 auto;
  height: 100%;
  min-height: 0;
  pointer-events: auto;
}
```

The critical constraints are:

- every shell ancestor above `.acp-workspace` must allow height propagation with `min-height: 0` where needed;
- the chat host and `acp-chat-panel` element must both stretch to full height;
- each dynamic container must receive a width input such as `formWidth` plus sensible bounds such as `320` to `720`;
- the form layer is allowed to visually sit above the routed page, but only inside `.acp-workspace__stage`.

If the application already has an equivalent flex/grid workspace, reuse it instead of adding a duplicate wrapper.

## 6. Preserve the panel as a real layout column

The important behavior is:

```text
┌──────────────┬───────────────────────────────────────────────┐
│ AI Agent     │ form surface opens here when requested        │
│ chat         │ directly next to chat, inside stage           │
│ full height  │ dashboard / routed page remains in stage      │
│              │ behind or beside the form surface             │
└──────────────┴───────────────────────────────────────────────┘
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

Also do not produce this form layout:

```text
sidebar | chat | dashboard ................................ | form drawer
```

The dynamic form surface must begin immediately after the chat column, not at the far right edge of the stage.

The dynamic form surface must also remain resizable after it opens. Do not hard-code a fixed form width and do not ignore `acp-form-width-change`.

Also avoid this, where resizing forces the dashboard's own grid to visibly re-layout:

```text
Panel widened →  [chat: wider] [dashboard: cards re-wrap/shrink/reflow]  ✗
Panel widened →  [chat: wider] [dashboard: same layout, less viewport]  ✓
```

The routed page's internal content (card sizes, grid columns, etc.) should stay visually stable across a resize. Only the amount of viewport available to it changes.

## 7. Resizing

The package already provides the resize handle and emits `acp-width-change`.

Set `dock="left"` on `acp-chat-panel` so the resize handle appears on the panel's right edge, adjacent to the routed content.

The integration must:

- keep the chat as a flex item, positioned before `.acp-workspace__content`;
- bind the current width to `[width]`;
- update shell state from `(acp-width-change)`;
- keep sensible bounds, normally 260–640 px;
- keep the chat element itself at `height: 100%` so the panel fills the stage vertically;
- give `.acp-workspace__content` `min-width: 0` so flexbox can shrink its container, and `overflow: auto` so its own content can scroll horizontally instead of being forced to reflow;
- verify that the application does not have a parent `min-width` or fixed width that prevents the content column from shrinking;
- avoid triggering any responsive/container-query logic in the routed page that would cause it to re-layout in response to the container width change — the content should scroll rather than rearrange.

Do not implement a second resize handler in the application unless the package behavior is demonstrably incompatible with the host shell.

For dynamic forms, apply the same rule: rely on the package resize handle and `acp-form-width-change` event. Do not create a second custom resize system in the host.

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

## 9. Match the supplied reference

The supplied reference shows:

- the chat panel docked directly against the sidebar, with the routed dashboard content to its right;
- the chat panel stretched to the full available workspace height rather than appearing as a short embedded card;
- a compact white AI Agent header;
- small square header action buttons;
- a very light blue/gray message surface;
- compact bordered message bubbles;
- a bottom composer separated by a border;
- a textarea with a Send button and character counter;
- a narrow vertical resize affordance on the edge adjacent to routed content (right edge of the panel, since `dock="left"`).
- when a form is opened, the form surface begins immediately next to the chat and visually sits over the dashboard/home stage instead of appearing as a detached panel at the far right side of the viewport.
- opened forms remain resizable and preserve their individual widths while open.

Use the existing application design tokens to reproduce that visual hierarchy rather than copying the application's entire dashboard stylesheet into the package.

## 10. Message behavior

The package does not make assumptions about the AI backend.

When `(acp-message-sent)` fires, connect it to the application's existing chat/agent service or API. Do not add a fake backend, HTTP endpoint, authentication flow, or LLM integration unless the host application already requires it.

## 10.1 Avoid common Angular errors

To avoid the exact build errors seen earlier:

- Do not import `AcpChatPanelComponent` from `@acp/chat-panel` (it is not exported).
- Register with `import '@acp/chat-panel';` once at app startup.
- For standalone components, use `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.
- Use package event names: `acp-open-change`, `acp-width-change`, `acp-message-sent`, `acp-new-chat`, `acp-help`.
- In strict Angular templates, read event payload as `$any($event).detail`.
- Define ACP theme selectors in global styles (for example `src/styles.css`), not component-scoped styles.

To avoid the runtime/layout issues seen later:

- The host must own chat messages and bind them via `[messages]`; do not only log `(acp-message-sent)`.
- Do not re-render the full custom element on every textarea `input` event inside the package runtime; update draft/counter/send state without replacing the textarea node, otherwise the caret jumps to the start and typing appears reversed.
- Do not place `.acp-workspace__chat` after `.acp-workspace__content` in the DOM — this causes the chat to render on the right of the dashboard instead of next to the sidebar.
- Do not place the chat inside the routed dashboard/home component — this typically causes the panel to lose full-height behavior and render like a shorter embedded box.
- Do not mount `acp-dynamic-container` as a shell-right drawer. Mount it inside `.acp-workspace__stage` and align it to the stage's left edge so it opens immediately next to the chat.
- Do not ignore `(acp-form-width-change)` or recreate the form instance on every resize event. Update only that form's width in shell state.
- Do not let the routed page's own CSS respond to the shrinking container (e.g. container queries, JS-measured breakpoints) in a way that re-flows its grid on resize — this produces visible dashboard reflow, which is prohibited. Let the content scroll instead.

The host owns the message array and passes it to `[messages]`.

## 11. Verification checklist

Before finishing, verify all of the following:

- [ ] The sidebar contains exactly one chat launch control.
- [ ] Clicking the control opens/closes the panel.
- [ ] The panel is at the shell/workspace level, not inside the dashboard page.
- [ ] The panel is not an overlay.
- [ ] No fixed/absolute positioning is used to create the chat.
- [ ] The chat panel renders directly adjacent to the sidebar, with the routed content to its right (not the chat appearing to the right of the content).
- [ ] The chat panel fills the full available workspace height.
- [ ] The routed page and chat are siblings in the same horizontal layout, with the chat first in DOM order.
- [ ] Any dynamic form surface opens immediately to the right of the chat, from the left edge of the stage.
- [ ] Any dynamic form surface is visually above the routed page only within the stage area, not as a viewport-right drawer detached from the chat.
- [ ] Dynamic forms are resizable with the package resize handle.
- [ ] Resizing one dynamic form updates only that form's width state.
- [ ] Increasing chat width narrows the content container's available space; decreasing it widens that space.
- [ ] The dashboard/home page's own internal layout (grid columns, card sizing) stays visually unchanged as the chat is resized — no reflow, rearranging, or resizing of its content. The content area scrolls if it doesn't fit.
- [ ] The resize handle works with pointer dragging.
- [ ] Keyboard arrow resizing works when the handle is focused.
- [ ] Dynamic form resize remains usable at minimum and maximum widths.
- [ ] The panel remains usable at its minimum width.
- [ ] The panel remains usable at its maximum width.
- [ ] Route changes do not destroy the shell-level chat state unexpectedly.
- [ ] The ACP theme is defined through the host's design tokens/global theme.
- [ ] Existing application styles are not unintentionally changed.
- [ ] `npm run build` / the application's normal Angular build completes successfully.

## Non-goals

Do not:

- create a new application shell;
- create an NgModule solely for the package;
- implement an AI/LLM service;
- implement authentication;
- replace the existing sidebar;
- create an overlay/drawer/modal chat;
- render the chat panel to the right of the routed content instead of next to the sidebar;
- render the dynamic container as a detached drawer at the far right edge of the viewport;
- hard-code dynamic form width without wiring `formWidth` and `acp-form-width-change`;
- make the routed dashboard/home page reflow its own internal layout in response to chat resizing;
- modify routed dashboard/home components just to make the panel fit;
- hard-code a brand theme into application components outside the ACP theme selectors.

## Dynamic container addendum

This package now also ships `<acp-dynamic-container>` in the same runtime bundle.

### Purpose

- Keep chat and dynamic container as sibling workspace surfaces.
- Open a form surface from chat text commands.
- Keep host application business logic (options, submission handlers, APIs) outside package internals.

### Chat -> form trigger

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

Note: The dynamic container exposes a small top-right close control that closes the container, and each form also includes a secondary button whose label defaults to `Close` (host can override via `cancelLabel`).

### Recommended workspace composition

Use one shell-level workspace row with three conceptual surfaces:

- left: existing sidebar
- middle: chat column (`acp-workspace__chat`), full height
- right: stage (`acp-workspace__stage`) containing routed content plus any open dynamic form surfaces

Inside the stage, render routed content as the base layer and render one or more dynamic containers from the stage's left edge so they appear immediately next to the chat.

Each rendered dynamic container should be resizable. Bind `[formWidth]`, `[minFormWidth]`, and `[maxFormWidth]`, and update the matching shell form item when `acp-form-width-change` fires.

For the dynamic container specifically, a stage-local overlay is acceptable and expected. That means it may visually sit above the routed page inside `.acp-workspace__stage`. What is not allowed is a viewport-level drawer or a panel mounted at the far right edge of the shell.

For the current expected host behavior, multiple `/form ...` requests should open multiple forms at the same time. The host should keep a collection of open form instances and render one `<acp-dynamic-container>` per form so each form can be closed independently without replacing the others.

### Wiring options

- Option A: Explicit host wiring.
  - Listen to `(acp-form-requested)` on chat and push a new form entry into host shell state rather than replacing the previous one.
  - Render dynamic containers with host iteration (`*ngFor` or equivalent) inside the stage's form layer so multiple forms can remain open side-by-side.
  - Initialize a per-form `formWidth` value when adding the form, then update that specific form in `(acp-form-width-change)`.
  - Wire `(acp-cancelled)` and `(acp-open-change)` per instance so each form closes independently.
- Option B: Package auto-listener.
  - `acp-dynamic-container` auto-listens for bubbled `acp-form-requested` on its shared parent (or `document`) and opens itself when a valid `formSpec` is received.
  - Even with auto-listening, mount the container inside `.acp-workspace__stage`, aligned to the stage's left edge.

Option A is the recommended integration path for the tested host state because the host owns the collection of open forms and their independent close behavior.

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
