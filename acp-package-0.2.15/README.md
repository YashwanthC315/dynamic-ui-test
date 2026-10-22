# @acp/chat-panel (v0.2.15)

Framework-agnostic chat, dynamic workspace, Buddy enrollment surface, and Assembler (activity) pane delivered as browser custom elements. Angular and other modern web applications can use the package without compiling its components.

## Install

```bash
npm install ./acp-chat-panel-0.2.15.tgz
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

The host owns the existing vertical sidebar and its single launch button. Keep chat closed initially; clicking the button opens chat directly beside the sidebar. Mount Workspace and Assembler in the shell stage immediately to the right of chat, with routed content remaining mounted in that stage. The panes participate in the stage's flex layout: minimizing returns their width to routed content, and maximizing expands the selected pane to available stage width while preserving an open sibling. Maximizing the other pane restores the currently maximized pane first. Harness form/Buddy surfaces open Workspace; activity-log surfaces open Assembler.

In v0.2.15, the package enforces Chat before the stage and aligns the Workspace/Assembler layer to the stage's left edge, placing Workspace next to Chat instead of at the far right. The Workspace header remains `Workspace`; prompt text and agent-provided form/surface titles do not change it. Form titles can still label the form content inside the pane.

Do not bind static `messages` or `pending` values or handle `acp-message-sent` separately while the harness connector is active. Angular hosts need `CUSTOM_ELEMENTS_SCHEMA`. The host remains responsible for router navigation, authorization, and domain saves.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for element and event contracts.
