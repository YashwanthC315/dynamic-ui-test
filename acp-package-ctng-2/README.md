# @acp/chat-panel (v0.2.0)

Framework-agnostic, non-overlay AI chat panel and workspace surface package for Angular (all versions: 4–19+) and modern web applications.

## What's New in v0.2.0

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
npm install ./acp-package-0.2.0/acp-chat-panel-0.2.0.tgz
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
