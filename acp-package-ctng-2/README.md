# @acp/chat-panel (v0.2.1)

Framework-agnostic, non-overlay AI chat panel and workspace surface package for Angular (all versions: 4–19+) and modern web applications.

## What's New in v0.2.1

- Chat, Workspace, and Actions now start closed. Closed elements occupy zero width.
- The host owns the single AI Agent button at the bottom of its sidebar and toggles `<acp-chat-panel>.open`.
- Opening Chat never opens Workspace or Actions. Workspace opens only for an explicit `acp-form-requested` request or host API update.
- Activity requests open Actions immediately beside Workspace. Actions remains open until the user minimizes or closes it.
- Chat, Workspace, and Actions have independent, clamped drag resizing and emit their width-change events.
- Buddy enrollment requests render the parser, validation, student strip, editable form, and Clear / Cancel / Submit actions inside Workspace.

## Host-owned launch button

The package deliberately does not render a sidebar button. Place one button at the bottom of the host sidebar and keep the `open` property as the visibility source of truth:

```html
<nav class="app-sidebar">
  <div class="app-sidebar__items"><!-- host navigation --></div>
  <button type="button" class="app-sidebar__ai" aria-label="Toggle AI Agent">AI Agent</button>
</nav>

<acp-chat-panel></acp-chat-panel>
```

```js
const toggle = document.querySelector('.app-sidebar__ai');
const chat = document.querySelector('acp-chat-panel');

toggle.addEventListener('click', () => { chat.open = !chat.open; });
chat.addEventListener('acp-open-change', (event) => { toggle.classList.toggle('active', event.detail); });
```

Do not add `open` in initial markup. Chat must never be opened on page load. Opening Chat does not set `open` on either adjacent pane.

## Pane behavior

Use this DOM order in the shell: `sidebar | chat | workspace | actions | routed content`. Workspace and Actions may sit in `.acp-workspace__surface-layer` so routed content remains mounted beneath the opaque surfaces.

- `acp-form-requested` opens Workspace unless the user explicitly closed it. Setting `workspace.open = true` allows a later request to open it again.
- `acp-actions-requested` with an activity item opens Actions, appends the item, and does not close Workspace.
- Workspace's **Open Actions** kebab command also opens the adjacent Actions pane.
- Minimize produces a clickable vertical rail. Maximize and restore preserve each pane's normal width. Close removes the pane from layout.
- Resize events are `acp-width-change`, `acp-form-width-change`, and `acp-actions-width-change` for Chat, Workspace, and Actions respectively.

## Changelog

### 0.2.1

Fixed eager Chat/Workspace opening, residual closed columns, disappearing Actions, sibling request routing, pane resizing, rail restoration, and Buddy enrollment controls. Added an `open`/width API to `<acp-actions-pane>` while retaining the existing custom elements and events.

## Previous v0.2.0 features

- 🔍 **In-Conversation Search**: Filter messages in real time with match count indicator and quick clear.
- 🕒 **Chat History Flyout**: View recent conversation threads with timestamps and instant restore capability.
- ⏳ **In-Flight Thinking & Cancellation**: Plain-language "Thinking..." status pill during processing with interactive cancel button.
- 💡 **Interactive Suggestion Chips**: Follow-up action chips with arrow indicators that automatically trigger prompts or route navigation.
- 🗂️ **Rich Message Blocks**: Full support for text, markdown, structured data tables, interactive links, inline form inputs, confirmation dialogs, and error diagnostics.
- 📐 **Pane Window Management (Rails & Restore)**: Minimize Workspace and Actions panes into compact vertical rails (`-`), expand to wide view (`⤢`), restore default split, and click rails to restore.
- 📋 **Kebab Menus**: Dropdown menus for secondary actions ("Open Actions", "Copy all saved names").
- 🎓 **Enhanced Buddy Workspace**: Student enrollment workspace with raw text parser, search, chip strip, pagination, check validation, and batch submission.
- 🎨 **Design Tokens & Opaque Surfaces**: Complete styling through CSS variables (`--acp-*`) with opaque backgrounds and host header height adaptation.

## Exposed Custom Elements

- `<acp-chat-panel>`: Full-height, resizable AI chat workspace column docked directly beside the sidebar.
- `<acp-dynamic-container>`: Dynamic form container opening immediately to the right of the chat panel with minimize/maximize rails and kebab menu.
- `<buddy-enrol-workspace-surface>`: Multi-student enrollment workspace with raw text parser, search, chip strip, validation check, and batch submission.
- `<acp-actions-pane>`: Post-commit activity accumulator pane with status kind styling, row action buttons, and kebab overflow menu.

## Layout Architecture

The host owns the application shell and router, utilizing the package layout classes from `styles.css`:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | stage                                            |
| [AI]    | docked next to     | - Workspace / Dynamic form (with - / ⤢ / rail)   |
| button  | sidebar            | - Actions pane (with - / ⤢ / rail / ⋮)           |
|         |                    | - Routed content (scrolls, no grid reflow)       |
+---------+--------------------+--------------------------------------------------+
```

1. **Persistent Full-Height**: `.acp-workspace` must sit inside a flex-growing `.app-shell__body` with `flex: 1 1 0` and `min-height: 0`.
2. **Viewport Fallback**: `.acp-workspace` uses `calc(100vh - var(--acp-app-header-height))` with default allowance `42px`.
3. **Bottom-Anchored Composer**: Textbox is pinned to the bottom with `margin-top: auto` so it remains anchored regardless of message count.
4. **Persistent Overlay Stage**: The surface layer (`.acp-workspace__surface-layer`) renders above routed content without unmounting the active page. Opening Actions opens beside Workspace without replacing it.

## Quick Installation

```bash
# Option A: Install from local path
npm install ./acp-package-0.2.0

# Option B: Pack into a tarball and install
cd acp-package-0.2.0 && npm pack
npm install ./acp-package-0.2.0/acp-chat-panel-0.2.1.tgz
```

## Quickstart

### 1. Register Custom Elements
Import once at app startup (`src/main.ts`):
```typescript
import '@acp/chat-panel';
```

### 2. Enable `CUSTOM_ELEMENTS_SCHEMA`
In your Angular shell component or `AppModule`:
```typescript
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  // ...
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
```

### 3. Load Design Tokens and Styles
In `angular.json`:
```json
"styles": [
  "src/styles.css",
  "node_modules/@acp/chat-panel/styles/acp-tokens.css",
  "node_modules/@acp/chat-panel/styles/acp-chat-panel.css"
]
```

Or in your global stylesheet (`styles.css` / `styles.scss`):
```css
/* Modern Angular (Angular 12–22+) */
@import '@acp/chat-panel/tokens.css';
@import '@acp/chat-panel/styles.css';

/* Classic Angular (Angular 4–11 / Webpack 4) */
@import '~@acp/chat-panel/styles/acp-tokens.css';
@import '~@acp/chat-panel/styles/acp-chat-panel.css';
```

### 4. Integration Guide
See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the complete integration guide, event binding matrix, flexbox layout rules, and verification checklist.
