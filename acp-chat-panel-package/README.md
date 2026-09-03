# @acp/chat-panel

A small, directly installable chat-panel package for Angular 22 applications. It exposes a native custom element so the package does not require the host application's Angular compiler configuration to build the panel.

The component is designed to live **inside the application's layout**, beside routed content. It is not an overlay, modal, floating drawer, or fixed-position chat window.

## Install

After making the supplied folder into an npm tarball:

```bash
npm install ./acp-chat-panel-0.1.0.tgz
```

## Angular 22 integration

In the shell component that owns the sidebar and router outlet, import the package once:

```ts
import '@acp/chat-panel';
```

Because the package registers the native `<acp-chat-panel>` custom element, allow custom elements in that Angular component. For a standalone component:

```ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // ...
})
export class AppShellComponent {}
```

If the application already has a shared schema configuration for custom elements, reuse it.

## Required layout

The routed application and chat panel must be siblings in the same horizontal flex container:

```html
<div class="acp-workspace">
  <main class="acp-workspace__content">
    <router-outlet />
  </main>

  @if (chatOpen) {
    <div class="acp-workspace__chat">
      <acp-chat-panel
        dock="left"
        open
        [attr.width]="chatWidth"
        width="300"
        min-width="260"
        max-width="640"
        [messages]="messages"
        (acp-open-change)="chatOpen = $event.detail"
        (acp-width-change)="chatWidth = $event.detail"
        (acp-message-sent)="onChatMessage($event.detail)"
      ></acp-chat-panel>
    </div>
  }
</div>
```

Use the application's actual template syntax and state model. The important requirement is the layout relationship, not the exact markup.

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

### Important

Do **not** use `position: fixed`, `position: absolute`, CDK Overlay, a modal, or an overlay drawer. Resizing the panel must reduce/increase the width available to the dashboard/home/routed page.

## Launch button

The package does not own the host application's sidebar. Add one chat action to the existing sidebar and toggle `chatOpen` from that control. Do not create a second floating launch button.

## Public properties

| Property | Default | Purpose |
|---|---:|---|
| `open` | `false` | Opens/closes the panel |
| `title` | `AI Agent` | Header title |
| `placeholder` | `How can I help you today?` | Composer placeholder |
| `maxLength` / `max-length` | `2000` | Composer limit |
| `width` | `360` | Current panel width in px |
| `dock` | `right` | `right` for content-left/panel-right, `left` for sidebar-left/panel-middle layouts |
| `width` | `300` | Current panel width in px |
| `minWidth` / `min-width` | `260` | Minimum resize width |
| `maxWidth` / `max-width` | `640` | Maximum resize width |
| `messages` | `[]` | Array of `{ id, role, text, timestamp? }` objects |

## Events

| Event | `event.detail` | Purpose |
|---|---|---|
| `acp-open-change` | `boolean` | Close/open state changed |
| `acp-width-change` | `number` | User resized the panel |
| `acp-message-sent` | `string` | User submitted a message |
| `acp-new-chat` | `undefined` | New-chat action clicked |
| `acp-help` | `undefined` | Help action clicked |

## Theme / design tokens

The package intentionally exposes stable `acp-*` classes in the light DOM. The package owns structural defaults; the host application owns visual values.

Load the supplied theme as the starting point:

```css
/* Angular global styles.scss */
@import '@acp/chat-panel/theme.css';
@import '@acp/chat-panel/styles.css';
```

If the application's Angular build does not accept package CSS imports in that location, copy the two files into the application's global styles configuration instead.

The main theme contract is documented in `docs/THEME_CONTRACT.md` and includes `.acp-header`, `.acp-panel`, `.acp-message__bubble`, `.acp-composer`, `.acp-input`, `.acp-send`, `.acp-resize-handle`, and the other `acp-*` selectors.

Prefer existing application design tokens inside those selectors:

```css
.acp-header {
  background: var(--app-surface);
  color: var(--app-primary);
  border-color: var(--app-border);
}
```

Do not modify the package JavaScript just to apply application branding.

## Resizing

The panel exposes a resize handle on the edge adjacent to routed content. With `dock="right"`, the handle is on the left edge. With `dock="left"`, the handle is on the right edge. Dragging it changes `width` and emits `acp-width-change`. Arrow-left/right also resize when the handle is focused.

Keep the emitted width in the shell state so the routed content and panel remain synchronized. The flex layout is what makes the dashboard/home/other page move when the panel changes size.

## Agent guide

See [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) for the integration procedure and acceptance checklist.
