# @acp/chat-panel

Framework-agnostic, non-overlay AI chat panel and workspace surface package for Angular (all versions: 4–19+) and modern web applications.

This package exposes native W3C Custom Elements:
- `<acp-chat-panel>`: Full-height, resizable AI chat workspace column docked directly beside the sidebar.
- `<acp-dynamic-container>`: Dynamic form container opening immediately to the right of the chat panel.
- `<buddy-enrol-workspace-surface>`: Multi-student enrollment workspace with raw text parser, search, chip strip, and batch submission.
- `<acp-actions-pane>`: Post-commit activity accumulator pane with status kind styling, row action buttons, and kebab overflow menu.

The host owns the application shell and router, but must use the package layout classes from `styles.css`. The chat is a persistent full-height sibling of the routed stage. Workspace and Actions are persistent overlay columns inside the stage; opening Actions must never close or replace the workspace.

The host must place `.acp-workspace` inside a flex-growing `.app-shell__body` below the header. The body must use `flex: 1 1 0` and `min-height: 0`; a content-sized wrapper will make the chat stop above the viewport bottom.

The package also includes a viewport fallback: `.acp-workspace` uses `calc(100vh - var(--acp-app-header-height))`. The default header allowance is `42px`; set `--app-header-height` globally when the host header has a different rendered height.

## Quick Installation

In your application root:

```bash
# Option A: Install directly from local path
npm install ./acp-package

# Option B: Pack into a tarball and install
cd acp-package && npm pack
npm install ./acp-package/acp-chat-panel-0.1.0.tgz
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
See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the complete step-by-step agent guide, shell template markup, flexbox layout rules, and verification checklist.
