# ACP Chat Panel — Angular 22 Integration Agent Guide

## Goal

Integrate the installed `@acp/chat-panel` package into the existing Angular 22 application so the existing sidebar contains a chat launch button and the chat panel opens **beside** the application's routed content — docked immediately next to the sidebar, with the routed content filling the remaining space to its right.

The chat is a workspace panel, not an overlay.

## Rules

1. Do not create an `NgModule` solely for this integration. Use the standalone component.
2. Do not use `position: fixed`, `position: absolute`, `z-index` layering, CDK Overlay, Material Drawer overlay mode, or a floating dialog for the chat.
3. The chat and the routed application content must be siblings in the same horizontal layout container, with the chat panel positioned directly after the sidebar and before the routed content — not after it.
4. Resizing the chat must resize the *available width* of the content container. It must not visibly reflow, rearrange, or resize the internal layout of the routed dashboard/home page itself (no grid re-columning, no card resizing, no re-wrapping). The routed page keeps its own layout; if that layout is wider than the space available, the content container scrolls horizontally rather than the page's internal grid recomputing.
5. Preserve the host application's existing sidebar, header, router outlet, routing, and page behavior. Make the smallest integration change possible.
6. Do not rewrite the package component's CSS to match the host app. Apply the host theme through the `acp-*` classes in a global theme stylesheet.
7. Do not hard-code application-specific colors, typography, or spacing into the package usage markup.

## 1. Locate the application shell

Find the component/template that owns the persistent layout containing:

- the left navigation/sidebar;
- the main routed page area (`router-outlet` or equivalent);
- the persistent application header/footer, if applicable.

Do not place the chat inside an individual dashboard/home page component. It belongs at the shell/workspace level so it survives route changes.

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
```

Keep these values in the shell, not in individual routed pages.

The integration may persist `chatWidth` if the application already has an appropriate preference/state mechanism. Do not add a new backend persistence mechanism just for panel width.

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

The chat panel sits **immediately next to the sidebar**, as the first child of the workspace container. The routed content is the sibling that follows it and fills the remaining space:

```html
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
        (acp-new-chat)="onNewChat()"
        (acp-help)="onChatHelp()"
      />
    </div>
  }

  <main class="acp-workspace__content">
    <router-outlet />
  </main>
</div>
```

This ordering matters: the chat panel must come **before** `.acp-workspace__content` in DOM order so it renders directly against the sidebar, with the routed page occupying the remaining horizontal space to the right of it. Do not append the chat panel after the content.

Adapt the markup to the actual shell. Do not blindly duplicate the example if the application already has a workspace wrapper.

Required layout properties:

```css
.acp-workspace {
  display: flex;
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

.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
```

If the application already has an equivalent flex/grid workspace, reuse it instead of adding a duplicate wrapper.

## 6. Preserve the panel as a real layout column

The important behavior is:

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

The package already provides the resize handle and emits `acp-width-change`.

Set `dock="left"` on `acp-chat-panel` so the resize handle appears on the panel's right edge, adjacent to the routed content.

The integration must:

- keep the chat as a flex item, positioned before `.acp-workspace__content`;
- bind the current width to `[width]`;
- update shell state from `(acp-width-change)`;
- keep sensible bounds, normally 260–640 px;
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

## 9. Match the supplied reference

The supplied reference shows:

- the chat panel docked directly against the sidebar, with the routed dashboard content to its right;
- a compact white AI Agent header;
- small square header action buttons;
- a very light blue/gray message surface;
- compact bordered message bubbles;
- a bottom composer separated by a border;
- a textarea with a Send button and character counter;
- a narrow vertical resize affordance on the edge adjacent to routed content (right edge of the panel, since `dock="left"`).

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
- [ ] The routed page and chat are siblings in the same horizontal layout, with the chat first in DOM order.
- [ ] Increasing chat width narrows the content container's available space; decreasing it widens that space.
- [ ] The dashboard/home page's own internal layout (grid columns, card sizing) stays visually unchanged as the chat is resized — no reflow, rearranging, or resizing of its content. The content area scrolls if it doesn't fit.
- [ ] The resize handle works with pointer dragging.
- [ ] Keyboard arrow resizing works when the handle is focused.
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

Use one flex workspace split:

- left: chat (`acp-workspace__chat`)
- right: host routed content by default; when forms are requested, render one or more dynamic containers in that region

Do not render dynamic container as an overlay. It must live in the same layout flow as chat/content.

For the current expected host behavior, multiple `/form ...` requests should open multiple forms at the same time. The host should keep a collection of open form instances and render one `<acp-dynamic-container>` per form so each form can be closed independently without replacing the others.

### Wiring options

- Option A: Explicit host wiring.
  - Listen to `(acp-form-requested)` on chat and push a new form entry into host shell state rather than replacing the previous one.
  - Render dynamic containers with host iteration (`*ngFor` or equivalent) so multiple forms can remain open side-by-side.
  - Wire `(acp-cancelled)` and `(acp-open-change)` per instance so each form closes independently.
- Option B: Package auto-listener.
  - `acp-dynamic-container` auto-listens for bubbled `acp-form-requested` on its shared parent (or `document`) and opens itself when a valid `formSpec` is received.

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
