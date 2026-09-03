# ACP Chat Panel — Integration Notes

This document explains the `@acp/chat-panel` package, how the npm tarball is structured, the CSS/theme contract, runtime behavior, and practical integration tips for Angular 22 apps.

## What the package provides
- A native custom element: `<acp-chat-panel>` (register via `import '@acp/chat-panel'`).
- A lightweight JS runtime in `dist/acp-chat-panel.js` that:
  - Defines the custom element and inline structural CSS.
  - Exposes a small API surface (attributes, properties, CustomEvents).
- A theme file and helper styles under `styles/` for host apps to import.

## Tarball layout (what `npm pack` produces)
- `package.json` — package metadata
- `dist/` — runtime JS and type definitions
  - `dist/acp-chat-panel.js` — element definition + inline structural CSS
  - `dist/acp-chat-panel.d.ts` — public typings
- `styles/` — theme and helper CSS
  - `styles/acp-chat-panel.css` (optional helper styles)
  - `styles/acp-chat-panel.theme.css` (theme contract to import into host)
- `README.md`, `AGENT_GUIDE.md`, docs/

When installed, hosts can import the theme with:

```css
@import '@acp/chat-panel/theme.css';
@import '@acp/chat-panel/styles.css';
```

or copy the theme files into the host global styles.

## How to use the element (quick)
- Register once (app entry):

```ts
import '@acp/chat-panel';
```

- In a standalone shell component allow custom elements:

```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // imports: [CommonModule] if you use *ngIf
})
export class AppShellComponent {}
```

- Basic usage (panel placed between sidebar and content):

```html
<div class="acp-workspace">
  <app-sidebar (toggleChat)="chatOpen = !chatOpen"></app-sidebar>

  <div class="acp-workspace__chat" *ngIf="chatOpen">
    <acp-chat-panel
      dock="left"
      [open]="chatOpen"
      [width]="chatWidth"
      [min-width]="260"
      [max-width]="640"
      [messages]="chatMessages"
      (acp-open-change)="chatOpen = $any($event).detail"
      (acp-width-change)="chatWidth = $any($event).detail"
      (acp-message-sent)="onChatMessage($any($event).detail)"
      (acp-new-chat)="onNewChat()"
      (acp-help)="onChatHelp()"
    ></acp-chat-panel>
  </div>

  <main class="acp-workspace__content">...</main>
</div>
```

## Public attributes / properties
- `open` (boolean) — show/hide the panel
- `dock` (`left` | `right`) — determines which edge the resize handle is placed on; use `dock="left"` when panel is between sidebar and main content
- `width`, `min-width`, `max-width` — sizing in px
- `title`, `placeholder`, `max-length` — visual and input config
- `messages` — array of message objects: `{ id, role: 'user'|'assistant', text, timestamp? }`

## Events (CustomEvent detail)
- `acp-open-change` — detail: boolean
- `acp-width-change` — detail: number
- `acp-message-sent` — detail: string (message text)
- `acp-new-chat` — no detail
- `acp-help` — no detail

In Angular strict templates use `$any($event).detail` to access payload.

## CSS classes (theme contract)
Edit `styles/acp-chat-panel.theme.css` to adapt visuals. Key selectors:
- `.acp-panel` — root
- `.acp-header`, `.acp-header__title`, `.acp-header__actions`
- `.acp-icon-button`
- `.acp-messages`, `.acp-message`, `.acp-message--user`, `.acp-message__bubble`, `.acp-message__time`
- `.acp-empty-state`
- `.acp-composer`, `.acp-input`, `.acp-composer__bottom`, `.acp-counter`, `.acp-send`
- `.acp-resize-handle` — resize affordance; theme can style gradients or hover

Helpers for host layout (optional):
- `.acp-workspace`, `.acp-workspace__content`, `.acp-workspace__chat`

Notes:
- The component writes structural inline CSS and also renders a resize handle element; theme CSS in the host should target the above selectors to style the light DOM.
- Because the element lives in the light DOM, component-scoped host styles (e.g. component CSS encapsulation) may not affect it — import the package theme globally.

## Runtime behavior notes & gotchas
- The package sets inline sizing on the host element to make it stretch to the available height — ensure your shell layout allows the chat column to grow (e.g., `height:100vh` at root, `.app-body`/workspace `align-items:stretch`, `min-width:0`).
- Put the composer at the bottom by ensuring the panel's `.acp-panel` is a column flex container and the host ensures full height.
- Avoid re-rendering the whole custom element on every keystroke inside the element; the package updates counter/send state without replacing the textarea DOM node to preserve caret position.
- Resize math: the package determines drag direction from which edge the handle is placed; `dock` helps but runtime will detect the handle side so forced CSS won't invert drag.

## Common integration checklist
- Import package once: `import '@acp/chat-panel'`.
- Allow custom elements: `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.
- Import the package theme in global styles.
- Keep `messages` in host state and pass to `[messages]`.
- Use `dock="left"` when panel sits between sidebar and content.
- Ensure host layout (`height:100vh`, flex) permits the panel to be full height.
- Use `$any($event).detail` in Angular templates for event payloads.

## Repack & install (local)
From package folder:

```powershell
npm version patch --no-git-tag-version
npm pack
```

From host app folder:

```powershell
npm install ..\acp-chat-panel-package\acp-chat-panel-<version>.tgz
npm run build
```

If you keep the same version you can add `--force` to `npm install` to overwrite the installed copy.

---