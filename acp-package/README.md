# @acp/chat-panel (v0.2.15)

A chat panel, workspace, and activity ("Assembler") pane for your web app, delivered as browser custom elements. It works with Angular and other modern frameworks, with no need to compile the components.

> **What this is:** the browser UI only. It talks to an Agent Harness server, which you need to have running separately.

## How it works

1. Download the package and the agent guide
2. Install the package
3. Hand the agent guide to a coding agent and ask it to integrate the chat panel
4. Set the env values so the chat panel can reach the harness

---

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
| A way for users to get a harness token at runtime | your existing auth service |

Never paste real tokens into the coding agent chat.

---

## Step 1: Download the files

Get these files and put them in your app's folder so your coding agent can read them:

- `acp-chat-panel-0.2.15.tgz` (the package)
- `README.md` (this file)
- `AGENT_GUIDE.md` (integration instructions for the agent)
- `SPEC_DOC.md` (optional: element and event details)

## Step 2: Install the package

Run this from your app's folder:

```bash
npm install ./acp-chat-panel-0.2.15.tgz
```

## Step 3: Ask your coding agent to integrate it

Give your coding agent the files above and this prompt. Fill in the `<placeholders>`:

```text
Integrate @acp/chat-panel v0.2.15 into ct-package-test following
acp-package-0.2.15/AGENT_GUIDE.md.

The harness is already running in a separate repository.

Connection settings:
- AGENT_HARNESS_WS_URL: ws://localhost:8787
- AGENT_HARNESS_API_URL: http://localhost:8787
- AGENT_FILE_RUN_API_URL: http://localhost:4001
- AGENT_FILE_RUN_BEARER_TOKEN: supplied securely at runtime; do not put a real token in this prompt
- AGENT_FILE_RUN_AGENT_PATH: ct-bot/agents/main.exs
- AGENT_SUGGESTIONS_AGENT_PATH: ct-bot/agents/suggestions.exs
- AGENT_COMPOSE_AGENT_PATH: <host-managed compose agent path, or leave unset>
- AGENT_TITLE_AGENT_PATH: <host-managed title agent path, or leave unset>

Complete integration and verification as instructed in the guide.
Implement the integration, run the available build/checks, and report
changed files, the start command, remaining setup, and verification results.
```

The agent will handle the code changes, including importing the package, adding `CUSTOM_ELEMENTS_SCHEMA` for Angular, and wiring up `connectAcpHarness`.

## Step 4: Set the env values
 
### Harness URL and agent paths
 
Add these to `src/environments/environment.ts` (or your app's equivalent config), adjusting URLs for your deployment:
 
```typescript
export const environment = {
  production: false,
  AGENT_HARNESS_WS_URL: 'ws://localhost:8787',
  AGENT_HARNESS_API_URL: 'http://localhost:8787',
  AGENT_FILE_RUN_API_URL: 'http://localhost:4001',
  AGENT_FILE_RUN_BEARER_TOKEN: '',
  AGENT_FILE_RUN_AGENT_PATH: '',
  AGENT_SUGGESTIONS_AGENT_PATH: '',
  AGENT_COMPOSE_AGENT_PATH: '',
  AGENT_TITLE_AGENT_PATH: ''
};
```
 
- `AGENT_HARNESS_WS_URL` and `AGENT_HARNESS_API_URL` are the legacy harness WebSocket and HTTP endpoints. They are separate from the agent-file-run connector and are not read by `connectAcpHarness`.
- Set `AGENT_FILE_RUN_API_URL` to the agent-file-run service URL, local or live. It must be an absolute `http://` or `https://` URL, not empty, relative, or `ws://`. The connector derives the streaming WebSocket URL from it.
- Set `AGENT_FILE_RUN_AGENT_PATH` to the main agent file on the harness server. The connector requires it to run chat requests.
- `AGENT_SUGGESTIONS_AGENT_PATH` is optional; leave it blank if there is no suggestions agent.
- `AGENT_COMPOSE_AGENT_PATH` identifies the optional compose agent for the Assembler draft hop. `AGENT_TITLE_AGENT_PATH` identifies the optional title agent used to title a new untitled thread. These are host-managed settings: `connectAcpHarness` does not run the compose or title agents automatically. Leave either blank when the host does not implement that feature.
- Agent paths point to files on the harness server, not files in your frontend.
### Bearer token (the part that must match)
 
The harness only accepts tokens it has been configured with. Your app must send one of them.
 
| Side | What to do |
|---|---|
| **Harness server** | The operator lists accepted tokens in `AETHERIS_PLAYGROUND_TOKENS`. |
| **Your app** | Provide the matching token through `getBearerToken`. It returns the raw token (no `Bearer ` prefix). |
 
So the token your app sends must be one of the values in the harness's `AETHERIS_PLAYGROUND_TOKENS`. Your normal app login token won't work unless the harness is set up to accept it.
 
How to supply it:
 
- **Local testing:** enter the token at runtime or in environment.ts and keep it in memory.

- **Provider keys** (like `OPENROUTER_API_KEY`) stay on the harness server only.

`AGENT_FILE_RUN_BEARER_TOKEN` is included in the configuration shape for completeness and may be used as a local-only fallback, but a production token should be supplied by `getBearerToken` at runtime rather than committed or bundled.
### If the harness is on a different origin than your app
 
Browsers block cross-origin requests unless the harness allows them. Pick one:
 
- Ask the harness operator to enable CORS (and WebSocket origin handling) for your app's origin.
- Or route through your app's own origin with a proxy that forwards `/api/playground` (including WebSocket upgrades) to the harness. For Angular local dev, add `proxy.conf.json` with `"ws": true` and start with `ng serve --proxy-config proxy.conf.json`. In that case set `AGENT_FILE_RUN_API_URL` to your app's own URL.
---
 
## Check that it works
 
- Chat starts closed, and the sidebar button opens it.
- Sending a message returns a reply that streams into chat.
- Your existing routes and content still work.
## Troubleshooting
 
| Problem | Check |
|---|---|
| `401` / `403` | The token your app sends matches one in `AETHERIS_PLAYGROUND_TOKENS`. |
| Request blocked or fails immediately | CORS or proxy setup (see above); confirm the harness URL is reachable. |
| Message sends but replies don't stream | WebSocket upgrade is allowed through any proxy or reverse proxy. |
| Agent path errors | The file exists on the harness, relative to `AETHERIS_AGENTS_ROOT`. |

## More detail

- [AGENT_GUIDE.md](./AGENT_GUIDE.md): full shell integration steps
- [SPEC_DOC.md](./SPEC_DOC.md): element and event contracts