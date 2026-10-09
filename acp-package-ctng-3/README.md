# @acp/chat-panel (v0.2.4)

Framework-agnostic chat panel, dynamic workspace, Buddy enrollment surface, and Actions pane delivered as browser custom elements. The package works with Angular and other modern web applications; it does not require the host application's Angular compiler.

## Install

```bash
npm install ./acp-chat-panel-0.2.4.tgz
```

## Harness Connector

Version 0.2.4 adds a browser connector for the agent-file-run service used by the host application. It sends a prompt to `POST /api/playground/agent-file-runs`, then reads the reply stream from `/api/playground/runs/{run_id}/events/ws`. Replies update chat messages and render agent-provided student, organization, or Buddy workspace surfaces.

Register the custom elements and connector during shell component initialization (e.g., in `ngAfterViewInit` for Angular):

```typescript
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
import { connectAcpHarness } from '@acp/chat-panel/harness';
import { environment } from './env/environment';

const chat = document.querySelector('acp-chat-panel');
const workspace = document.querySelector('acp-dynamic-container');

const harnessConnection = connectAcpHarness({
  chat,
  workspace,
  environment,
  config: {
    getBearerToken: () => runtimeConfig.agentBearerToken || environment.AGENT_FILE_RUN_BEARER_TOKEN
  },
  getContext: () => ({
    route: window.location.pathname,
    persona: runtimeConfig.persona || undefined,
    formOptions: runtimeConfig.formOptions || undefined
  }),
  onNavigate: (href) => applicationRouter.navigateByUrl(href)
});
```

Provide the bearer token through runtime configuration, `getBearerToken`, or environment settings. `getBearerToken` is called for each run so it can read the current session token. Do not commit credentials to source control or embed production secrets in a public frontend bundle. The connector defaults the API origin to `http://localhost:4001`; a non-blank token and `agentPath` are required.

The connector reads `AGENT_FILE_RUN_API_URL`, `AGENT_FILE_RUN_BEARER_TOKEN`, `AGENT_FILE_RUN_AGENT_PATH`, and `AGENT_SUGGESTIONS_AGENT_PATH` from the supplied environment object. A `config` value overrides the corresponding environment setting. Note that `AGENT_HARNESS_WS_URL` (for example `ws://localhost:8787`) is a separate legacy chat socket and is not the file-run endpoint used by this connector.

`getContext` is optional. Supplying the active route and available domain context (for example `formOptions.courses`) gives the agent the relevant host context. Conversation history is held in memory by this connector; persistent history and application-specific form saves remain host responsibilities.

## Sidebar and Icons

The package does not create or style navigation. Reuse the application's existing vertical sidebar and icon components; add only the chat toggle, preserving the host's icon markup, classes, sizing, and colors. Do not replace the sidebar or apply ACP styles to its navigation icons.

## Host Requirements

- Load the package styles globally and register the custom elements once.
- Angular hosts need `CUSTOM_ELEMENTS_SCHEMA` where custom elements appear in templates.
- The browser must support Custom Elements, ES modules, `fetch`, and WebSockets; older browsers may need polyfills.
- The host owns navigation, authorization configuration, persistent conversation history, and saves to application APIs.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for package contracts.
