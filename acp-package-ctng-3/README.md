# @acp/chat-panel (v0.2.5)

Framework-agnostic chat, dynamic workspace, Buddy enrollment surface, and Assembler (activity) pane delivered as browser custom elements. Angular and other modern web applications can use the package without compiling its components.

## Install

```bash
npm install ./acp-chat-panel-0.2.5.tgz
```

Import the elements and styles once in the application entry point:

```typescript
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
```

## Harness Connection

`connectAcpHarness` posts to `POST /api/playground/agent-file-runs` and streams replies from `/api/playground/runs/{run_id}/events/ws`. It owns chat messages, pending state, suggestions, history, cancellation, and supported harness surface dispatch. Pass the chat, dynamic workspace, and Assembler elements:

```typescript
import { connectAcpHarness } from '@acp/chat-panel/harness';

const connection = connectAcpHarness({
  chat: document.querySelector('acp-chat-panel'),
  workspace: document.querySelector('acp-dynamic-container'),
  actions: document.querySelector('acp-actions-pane'),
  environment,
  config: {
    getBearerToken: () => runtimeConfig.agentBearerToken || environment.AGENT_FILE_RUN_BEARER_TOKEN
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

Set `AGENT_FILE_RUN_API_URL`, `AGENT_FILE_RUN_AGENT_PATH`, and a runtime bearer token. `AGENT_SUGGESTIONS_AGENT_PATH` is optional. `getBearerToken` runs for each request; do not commit production credentials or embed them in a public bundle. `AGENT_HARNESS_WS_URL` is a separate legacy socket and is not used by this connector.

## Shell Layout

The host owns the existing vertical sidebar and its single launch button. Keep chat closed initially; clicking the button opens chat directly beside the sidebar. Mount Workspace and Assembler in the shell stage immediately to the right of chat, with routed content remaining mounted in that stage. Harness form/Buddy surfaces open Workspace; activity-log surfaces open Assembler. Informational blocks render in chat, while application-specific information surfaces can be handled through `onSurface` and mounted by the host in its Workspace slot.

Do not bind static `messages` or `pending` values or handle `acp-message-sent` separately while the harness connector is active. Angular hosts need `CUSTOM_ELEMENTS_SCHEMA`. The host remains responsible for router navigation, authorization, domain saves, and any persistence beyond the connector's in-memory history.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for element and event contracts.


### Example prompt

Integrate the installed @acp/chat-panel package using AGENT_GUIDE.md. Configure the harness connection using this app’s existing runtime configuration. If it has no suitable configuration, add a local-only configuration mechanism and use it with getBearerToken(). Set AGENT_FILE_RUN_BEARER_TOKEN from that configuration; do not invent, guess, or commit a token. It must match a token accepted by the harness via AETHERIS_PLAYGROUND_TOKENS. If the local token is unavailable, leave it unset and tell me where to provide it. Verify a prompt receives a harness response before considering integration complete.

