# @acp/chat-panel (v0.2.14)

A chat panel, workspace, and activity ("Assembler") pane for your web app, delivered as browser custom elements. It works with Angular and other modern frameworks, with no need to compile the components.

> **What this is:** the browser UI only. It talks to an Agent Harness server, which you need to have running separately.

## How it works

1. Download the package and the agent guide.
2. Install the package.
3. Hand the agent guide to a coding agent and ask it to integrate the chat panel.
4. Set the env values so the chat panel can reach the harness, then enter a matching harness bearer token securely in your app.

## Before you start

Have these ready:

| Item | Example |
|---|---|
| Your app's folder (the one with `package.json`) | `~/my-app` |
| Your app's local URL | `http://localhost:4300` |
| Agent file-run API URL | `http://localhost:4001` |
| Main agent path (on the harness server) | `ct-bot/agents/main.exs` |
| Suggestions agent path (optional) | `ct-bot/agents/suggestions.exs` |
| Compose agent path (optional, host-managed) | `ct-bot/agents/compose.exs` |
| Title agent path (optional, host-managed) | `ct-bot/agents/title.exs` |
| A way for users to enter or obtain a harness token at runtime | your existing secure settings or auth service |

Never paste real tokens into the coding agent chat.

## Step 1: Download the files

Get these files and put them in your app's folder so your coding agent can read them:

- `acp-chat-panel-0.2.14.tgz` (the package)
- `README.md` (this file)
- `AGENT_GUIDE.md` (integration instructions for the agent)
- `SPEC_DOC.md` (optional: element and event details)

## Step 2: Install the package

Run this from your app's folder:

```bash
npm install ./acp-chat-panel-0.2.14.tgz
```

For legacy Angular dependency conflicts, add `--legacy-peer-deps`.

## Step 3: Ask your coding agent to integrate it

Give your coding agent the files above and this prompt. Fill in the `<placeholders>`:

```text
Integrate @acp/chat-panel v0.2.14 into <app-folder> following
<path-to-downloaded-files>/AGENT_GUIDE.md.
The app runs at <app-local-url>. The harness is already running separately.

Connection settings:
- AGENT_HARNESS_WS_URL: ws://localhost:8787 (legacy only)
- AGENT_HARNESS_API_URL: http://localhost:8787 (legacy only)
- AGENT_FILE_RUN_API_URL: http://localhost:4001
- AGENT_FILE_RUN_BEARER_TOKEN: supplied securely at runtime; never put a real token in this prompt
- AGENT_FILE_RUN_AGENT_PATH: ct-bot/agents/main.exs
- AGENT_SUGGESTIONS_AGENT_PATH: ct-bot/agents/suggestions.exs
- AGENT_COMPOSE_AGENT_PATH: <host-managed compose agent path, or leave unset>
- AGENT_TITLE_AGENT_PATH: <host-managed title agent path, or leave unset>

Inspect the active environment/runtime config and Angular file replacements.
Preserve existing values and unrelated settings; add only missing variables.
Report blank or invalid required values rather than silently overwriting them.
Use connectAcpHarness with the active environment, not the legacy socket.
Provide secure runtime token entry and getBearerToken. Always remind me to
enter the harness bearer token in the app, never in this coding-agent chat.
Handle acp-auth-required by reopening the app's secure token settings.

Keep Workspace directly beside Chat with its outer title fixed to Workspace.
Verify the file-run POST, reply WebSocket, workflow dispatch, and clearing of
Thinking on success, failure, timeout, and cancellation. Do not claim a live
integration passed without a matching harness token and a successful reply.
Run the available build/checks and report changed files, the start command,
remaining setup, and verification results without exposing credentials.
```

The agent will handle importing the package and both global stylesheets, adding `CUSTOM_ELEMENTS_SCHEMA` for Angular, and wiring `connectAcpHarness`. It must not bind static `messages` or `pending` values or add a duplicate message handler.

## Step 4: Set the env values

### Harness URL and agent paths

Merge missing keys into `src/environments/environment.ts` (or your app's equivalent config). Do not replace the existing environment object. Check the configuration actually selected by the start/build command, including Angular `fileReplacements`, and preserve existing URLs, paths, credentials, and unrelated settings. Report empty or invalid required values for correction.

```typescript
export const environment = {
  production: false,
  AGENT_HARNESS_WS_URL: 'ws://localhost:8787',
  AGENT_HARNESS_API_URL: 'http://localhost:8787',
  AGENT_FILE_RUN_API_URL: 'http://localhost:4001',
  AGENT_FILE_RUN_BEARER_TOKEN: '',
  AGENT_FILE_RUN_AGENT_PATH: 'ct-bot/agents/main.exs',
  AGENT_SUGGESTIONS_AGENT_PATH: '',
  AGENT_COMPOSE_AGENT_PATH: '',
  AGENT_TITLE_AGENT_PATH: ''
};
```

- `AGENT_HARNESS_WS_URL` and `AGENT_HARNESS_API_URL` are legacy endpoints. They are separate from the agent-file-run connector and are not read by `connectAcpHarness`.
- Set `AGENT_FILE_RUN_API_URL` to the file-run service URL, local or live. It must be an absolute `http://` or `https://` URL, not empty, relative, or `ws://`. The connector derives the streaming WebSocket URL from it. Prefer the service origin; a trailing `/api/playground` or `/api/playground/agent-file-runs` is normalized to avoid duplicate paths.
- Set `AGENT_FILE_RUN_AGENT_PATH` to the main agent file on the harness server. The connector requires it for chat requests.
- `AGENT_SUGGESTIONS_AGENT_PATH` is optional; leave it blank if there is no suggestions agent.
- `AGENT_COMPOSE_AGENT_PATH` and `AGENT_TITLE_AGENT_PATH` are optional, host-managed settings. `connectAcpHarness` does not invoke compose or title agents automatically. Leave either blank when the host does not implement that feature.
- Agent paths point to files on the harness server, not files in your frontend.
- For persisted conversation history, pass the authenticated user's stable id via `config.getOwnerId` or `AGENT_FILE_RUN_OWNER_ID`. Call `connection.refreshHistory()` after runtime identity or credentials become available.

### Bearer token (the part that must match)

**Enter the harness bearer token in your app's secure token settings before testing.** Missing credentials and `401`/`403` responses emit `acp-auth-required`; the host must use that event to reopen its secure token entry. A failed chat request also displays token guidance and clears Thinking. The package does not create a token dialog itself.

| Side | What to do |
|---|---|
| Harness server | The operator lists accepted tokens in `AETHERIS_PLAYGROUND_TOKENS`. |
| Your app | Provide a matching raw token through `config.getBearerToken`, with no `Bearer ` prefix. |

Your normal app login token will not work unless the harness accepts it. Keep an entered token in memory, let users replace it after rejection, and never log it or include it in prompts, URLs, browser storage, or committed files. Provider keys such as `OPENROUTER_API_KEY` stay on the harness server only.

`AGENT_FILE_RUN_BEARER_TOKEN` is included for configuration completeness and local-only fallback. If using an untracked local environment override, remember its value is still bundled into the frontend. Production credentials should be supplied securely at runtime through `getBearerToken`, or held server-side behind an authenticated host proxy.

```typescript
const connection = connectAcpHarness({
  chat: chatElement,
  workspace: workspaceElement,
  actions: assemblerElement,
  environment,
  config: {
    getBearerToken: () => secureSession.harnessToken,
    getOwnerId: () => auth.currentUser ? auth.currentUser.id : ''
  }
});
```

Here `secureSession`, `auth`, and the element references are supplied by your host app. See the agent guide for runtime token-entry wiring.

### If the harness is on a different origin than your app

Browsers block cross-origin requests unless the harness allows them. Pick one:

- Ask the harness operator to enable CORS and WebSocket origin handling for your app's origin.
- Or use a same-origin proxy that forwards `/api/playground`, including WebSocket upgrades, to the harness. For Angular local dev, configure `proxy.conf.json` with `"ws": true` and start with `ng serve --proxy-config proxy.conf.json`. Set `AGENT_FILE_RUN_API_URL` to your app's absolute origin in that case.

## Check that it works

- Chat starts closed, and the existing sidebar button opens it.
- Enter the matching harness bearer token securely in the app.
- Send `Enroll a student`. The network panel must show `POST /api/playground/agent-file-runs` at the configured file-run service, then a connection to `/api/playground/runs/{run_id}/events/ws`. The configured agent determines the response or workflow; this phrase is not a client-side command.
- A valid harness response appears in chat and its supported surface opens Workspace directly beside Chat. The outer pane header remains `Workspace`.
- Missing/rejected tokens, HTTP errors, timeouts, and cancellation clear Thinking and allow another attempt. `config.timeoutMs` defaults to 120000 and bounds the request lifecycle, including token lookup, thread setup, HTTP, and streaming.
- Your existing routes and content still work.

## Troubleshooting

| Problem | Check |
|---|---|
| `401` / `403` or a missing-token message | Enter a token accepted by `AETHERIS_PLAYGROUND_TOKENS` through the app's secure settings; do not paste it into the coding-agent chat. |
| No file-run POST | Pass the active environment to `connectAcpHarness`; supply a token and main agent path; check whether thread setup failed first. Do not override connector-owned messages or pending state. |
| Wrong endpoint | Check `AGENT_FILE_RUN_API_URL`, explicit `config.baseUrl`, and Angular file replacements. Legacy port 8787 settings do not configure this connector. |
| Request blocked or fails immediately | Check CORS/proxy setup and harness reachability. |
| Replies do not stream | Allow WebSocket upgrades and origins through any proxy. |
| Thinking ends with a timeout | Check both HTTP and WebSocket connectivity. The full request deadline prevents indefinite pending state; it cannot repair an unavailable harness. |
| Agent path errors | The file must exist on the harness, relative to `AETHERIS_AGENTS_ROOT`. |

## More detail

- [AGENT_GUIDE.md](./AGENT_GUIDE.md): full shell integration steps
- [SPEC_DOC.md](./SPEC_DOC.md): element and event contracts

The release folder also contains `tests/harness-regression.mjs` (run with Node.js) and `tests/workspace-regression.html` (open in a browser). Test fixtures are not included in the installable archive.
