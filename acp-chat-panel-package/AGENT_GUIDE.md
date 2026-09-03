# ACP Chat Panel — Angular 22 Integration Agent Guide

## Goal

Integrate the installed `@acp/chat-panel` package into the existing Angular 22 application so the existing sidebar contains a chat launch button and the chat panel opens **beside** the application's routed content.

The chat is a workspace panel, not an overlay.

## Rules

1. Do not create an `NgModule` solely for this integration. Use the standalone component.
2. Do not use `position: fixed`, `position: absolute`, `z-index` layering, CDK Overlay, Material Drawer overlay mode, or a floating dialog for the chat.
3. The chat and the routed application content must be siblings in the same horizontal layout container.
4. Resizing the chat must resize the available content area. The dashboard/home/other route must move, reflow, or become narrower rather than being covered by the chat.
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

The existing routed content and chat must be siblings:

```html
<div class="acp-workspace">
  <main class="acp-workspace__content">
    <router-outlet />
  </main>

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
</div>
```

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

.acp-workspace__content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.acp-workspace__chat {
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
}
```

If the application already has an equivalent flex/grid workspace, reuse it instead of adding a duplicate wrapper.

## 6. Preserve the panel as a real layout column

The important behavior is:

```text
┌───────────────────────────────────────────────┬──────────────┐
│ existing application content                  │ AI Agent     │
│ dashboard / home / routed page                │ chat         │
│                                               │              │
│                                               │              │
└───────────────────────────────────────────────┴──────────────┘
                         ↑
                  content gets narrower
                  when chat gets wider
```

Do not produce this behavior:

```text
┌───────────────────────────────────────────────────────────────┐
│ dashboard content                               ┌────────────┐│
│                                                │ AI Agent   ││
│                                                │ overlay    ││
└────────────────────────────────────────────────┴────────────┘│
```

The second pattern is explicitly prohibited.

## 7. Resizing

The package already provides the resize handle and emits `acp-width-change`.

If the panel is rendered between the sidebar and the routed content, set `dock="left"` so the resize handle appears on the right edge next to the routed content.

The integration must:

- keep the chat as a flex item;
- bind the current width to `[width]`;
- update shell state from `(acp-width-change)`;
- keep sensible bounds, normally 260–640 px;
- ensure the page content has `min-width: 0` so flexbox can actually shrink it;
- verify that the application does not have a parent `min-width` or fixed width that prevents the content column from shrinking.

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

- a compact white AI Agent header;
- small square header action buttons;
- a very light blue/gray message surface;
- compact bordered message bubbles;
- a bottom composer separated by a border;
- a textarea with a Send button and character counter;
- a narrow vertical resize affordance on the edge adjacent to routed content (right edge when `dock="left"`).

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

To avoid the runtime issues seen later:

- The host must own chat messages and bind them via `[messages]`; do not only log `(acp-message-sent)`.
- Do not re-render the full custom element on every textarea `input` event inside the package runtime; update draft/counter/send state without replacing the textarea node, otherwise the caret jumps to the start and typing appears reversed.

The host owns the message array and passes it to `[messages]`.

## 11. Verification checklist

Before finishing, verify all of the following:

- [ ] The sidebar contains exactly one chat launch control.
- [ ] Clicking the control opens/closes the panel.
- [ ] The panel is at the shell/workspace level, not inside the dashboard page.
- [ ] The panel is not an overlay.
- [ ] No fixed/absolute positioning is used to create the chat.
- [ ] The routed page and chat are siblings in the same horizontal layout.
- [ ] Increasing chat width makes the routed page narrower.
- [ ] Decreasing chat width gives the routed page more space.
- [ ] The dashboard/home/other route visibly moves/reflows as the chat is resized.
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
- modify routed dashboard/home components just to make the panel fit;
- hard-code a brand theme into application components outside the ACP theme selectors.
