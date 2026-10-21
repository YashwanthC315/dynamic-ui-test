# @acp/chat-panel (v0.2.13)

Framework-agnostic chat, dynamic workspace, Buddy enrollment surface, and Assembler (activity) pane delivered as browser custom elements. Angular and other modern web applications can use the package without compiling its components.

## Changes in 0.2.13

- The expanded, maximized, and minimized workspace header always reads **Workspace**. Prompt text, `formSpec.title`, `surface.title`, and legacy host `title` bindings cannot rename it. Form titles remain inside the form body.
- Docking classes explicitly enforce `Chat | Workspace | Assembler` order and left alignment, resetting host auto margins and drawer positioning on pane wrappers and their custom elements.
- Existing shell markup remains required. Keep `.acp-workspace__chat` and `.acp-workspace__stage` as siblings, and put `.acp-workspace__surface-layer` inside the stage. Do not mount Workspace in a separate right drawer or overlay service. Load the new package stylesheet globally, not just the JavaScript bundle.
- Close, resize, minimize, maximize, and routed-content overlay behavior are retained.

Open `tests/workspace-regression.html` from this release directory to run the browser checks without a backend. The regression fixture is not included in the installable archive.

## Install

```bash
npm install ./acp-chat-panel-0.2.13.tgz
```

Import the elements and styles once in the application entry point:

```typescript
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
```

## Harness Connection

`connectAcpHarness` posts to `POST /api/playground/agent-file-runs` and streams replies from `/api/playground/runs/{run_id}/events/ws`. It owns chat messages, pending state, suggestions, history, cancellation, and supported harness surface dispatch. Pass the chat, dynamic workspace, and Assembler elements:

Conversation history is stored by the Agent File Run harness, not browser storage. Configure `ownerId` or `getOwnerId` with the authenticated user's stable id. The connector lists `GET /api/playground/owners/{owner_id}/threads`, creates threads with `POST /api/playground/threads`, stamps runs with `owner_id` and `thread_id`, and restores messages from the stored run events. The bearer token is sent to those endpoints, so the harness remains responsible for persistence and user isolation. Await `connection.ready` before relying on the initial Recent Chats list; if authentication resolves later, call `connection.refreshHistory()` after the owner id becomes available.

Each prompt includes up to the newest 20 prior user/assistant messages, adjusted to begin on a user message when possible. Set `config.maxHistoryEntries` or `environment.AGENT_CHAT_HISTORY_MAX` to change the limit; this only limits prompt context, not the displayed or restorable conversation history.

```typescript
import { connectAcpHarness } from '@acp/chat-panel/harness';

const connection = connectAcpHarness({
  chat: document.querySelector('acp-chat-panel'),
  workspace: document.querySelector('acp-dynamic-container'),
  actions: document.querySelector('acp-actions-pane'),
  environment,
  config: {
    getBearerToken: () => runtimeConfig.agentBearerToken || environment.AGENT_FILE_RUN_BEARER_TOKEN,
    getOwnerId: () => auth.currentUser ? auth.currentUser.id : ''
  },
  getContext: () => ({ route: window.location.pathname }),
  onNavigate: (href) => applicationRouter.navigateByUrl(href),
  onSurface: (surface) => {
    if (surface.type === 'activity-log') setAssemblerOpen(true);
    else if (surface.title) setWorkspaceOpen(true);
  }
});
```

The `actions` option is the `<acp-actions-pane>` custom element. The connector maps `activity-log` surfaces to its items and menu actions, opens it, and labels it “Assembler” unless the surface provides a title. Existing `acp-actions-requested` and `acp-open-actions` events also open it.

Set `AGENT_FILE_RUN_API_URL`, `AGENT_FILE_RUN_AGENT_PATH`, a runtime bearer token, and the authenticated user's stable owner id. `AGENT_FILE_RUN_OWNER_ID` can provide a static owner id; use `config.getOwnerId` when identity can change at runtime. `AGENT_SUGGESTIONS_AGENT_PATH` is optional. `getBearerToken` runs for each request; do not commit production credentials or embed them in a public bundle. `AGENT_HARNESS_WS_URL` is a separate legacy socket and is not used by this connector. `connection.ready` resolves after the initial thread list and optional restore complete.

## Shell Layout

The host owns the existing vertical sidebar and its single launch button. Keep chat closed initially; clicking the button opens chat directly beside the sidebar. Mount Workspace and Assembler in the shell stage immediately to the right of chat, with routed content remaining mounted in that stage. The panes occupy an absolutely positioned flex surface layer over routed content: minimizing reduces the overlay width without resizing routed content, and maximizing expands the selected pane to available stage width while preserving an open sibling. Maximizing the other pane restores the currently maximized pane first. Harness form/Buddy surfaces open Workspace; activity-log surfaces open Assembler.

Do not bind static `messages` or `pending` values or handle `acp-message-sent` separately while the harness connector is active. Angular hosts need `CUSTOM_ELEMENTS_SCHEMA`. The host remains responsible for router navigation, authorization, and domain saves.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for element and event contracts.
