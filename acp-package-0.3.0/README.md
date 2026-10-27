# @acp/chat-panel (v0.3.0)

Framework-agnostic chat, dynamic workspace, Buddy enrollment surface, and Assembler (activity) pane delivered as browser custom elements. Angular and other modern web applications can use the package without compiling its components.

## v0.3.0 Changes and Verification Status

Workspace width, height, corner, and keyboard resizing update geometry without recreating the form DOM. Host dimension write-backs also leave the fields intact. The form body and Buddy instance stay mounted across minimize/restore, maximize/restore, menu changes, and close/reopen. Equivalent form specifications no longer reset entered values. A new form specification or information surface still intentionally replaces content.

Assembler no longer reopens merely because Workspace opens, new activity is prepended, and activity-log surfaces restore a minimized Assembler. The connector respects explicit Workspace closure. Standard numeric fields apply the spec's minimum and maximum constraints.

The reusable sources live under `src/app/agent-chat-panel/components/agent-chat-panel.elements.js` and `src/app/agent-chat-panel/services/acp-harness-bridge.js` in the source repository. They retain the existing universal adapter and apply the original Angular component's geometry-only resizing approach. The Angular component and host integration are not replaced. Run `scripts/package-agent-chat-panel.ps1 -Version 0.3.0` from that repository to copy these sources into this release and produce the archive without running lifecycle scripts.

**Not tested:** no tests, builds, browser checks, or harness requests were run for this release, as requested by the package owner. The acceptance checklist remains pending manual integration. Authenticated harness requests are unverified; domain persistence remains host-owned and unwired by this package. No server or credential is supplied.

Read [INTEGRATION_SPEC.md](./INTEGRATION_SPEC.md) in numbered order, then use [AGENT_GUIDE.md](./AGENT_GUIDE.md) for concrete host wiring and the manual acceptance procedure. Do not claim section 16 passes until those checks are actually performed.

## Install

```bash
npm install ./acp-chat-panel-0.3.0.tgz
```

Import the elements and styles once in the application entry point:

```typescript
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
```

## Forms and Enrollment

Submit and Submit All stay disabled until records have an explicit `valid: true` result and all required fields and length constraints pass. Both buttons remain disabled during parsing or validation. Submit All requires at least one record and every record to pass.

Editing raw text invalidates the previous result and requires parsing again. Editing or clearing structured fields invalidates validation, but does not require reparsing unchanged raw text: use Validate & check for errors to validate the current field values. Manual entry into an empty workspace creates a record that can be checked and submitted. Validation replies containing only record IDs and validity flags preserve entered values. Failed, incomplete, or stale responses cannot enable submission.

Standard dynamic forms enable Submit once their required fields and native constraints pass. Disabled controls use `--acp-control-disabled-*` tokens. A valid submit emits the existing host event and opens Assembler with a neutral “Submission requested” activity. This is not a persistence confirmation. Enrollment rows are shown as saved only when a later surface update confirms `saved: true`.

The backend remains responsible for authoritative validation and persistence. Submission events are also guarded, not just button styling.

Missing domain-save APIs are not a reason to stop integration or avoid editing host files. Reuse an existing authorized save service if available; otherwise wire explicit non-persisting handlers that keep Workspace open and report saving as unconfigured. Complete the shell, styles, connector setup, and available local checks, then list persistence wiring and authenticated checks still needed. Do not invent APIs or claim a submission was saved.

The release directory retains inherited browser fixtures under `tests/` for optional later use. They were not run for v0.3.0 and are not evidence that this version passes. Fixtures are not included in the installable archive. The owner's manual acceptance procedure is in the agent guide.

## Harness Connection

`connectAcpHarness` posts to `POST /api/playground/agent-file-runs` and streams replies from `/api/playground/runs/{run_id}/events/ws`. It owns chat messages, pending state, suggestions, history, cancellation, and supported harness surface dispatch. Pass the chat, dynamic workspace, and Assembler elements:

Conversation history is stored by the Agent File Run harness, not browser storage. Configure `ownerId` or `getOwnerId` with the authenticated user's stable id. When neither is configured, the connector uses `getContext().host.userId` or `getContext().userId` (also supported through static `context`). Explicit owner configuration takes precedence; missing identity is never invented. The connector lists `GET /api/playground/owners/{owner_id}/threads`, creates threads with `POST /api/playground/threads`, stamps runs with `owner_id` and `thread_id`, and restores messages from stored run events.

Opening or reopening the chat panel refreshes Recent Chats from the harness, including when identity was unavailable during initial setup after a page refresh. Await `connection.ready` for the initial list. If authentication becomes ready while the panel is already open, call `connection.refreshHistory()` from the host authentication callback. The bearer token is sent to the history endpoints, so the harness remains responsible for persistence and user isolation. Old conversations that were never stored with an owner/thread association cannot be recovered by the package.

Each prompt includes up to the newest 20 prior user/assistant messages, adjusted to begin on a user message when possible. Set `config.maxHistoryEntries` or `environment.AGENT_CHAT_HISTORY_MAX` to change the limit; this only limits prompt context, not the displayed or restorable conversation history.

```typescript
import { connectAcpHarness } from '@acp/chat-panel/harness';

const workspaceElement = document.querySelector('acp-dynamic-container');
const connection = connectAcpHarness({
  chat: document.querySelector('acp-chat-panel'),
  workspace: workspaceElement,
  actions: document.querySelector('acp-actions-pane'),
  environment,
  config: {
    getBearerToken: () => (runtimeConfig.agentBearerToken || environment.AGENT_FILE_RUN_BEARER_TOKEN || '').trim(),
    getOwnerId: () => auth.currentUser ? auth.currentUser.id : ''
  },
  getContext: () => ({ route: window.location.pathname }),
  onNavigate: (href) => applicationRouter.navigateByUrl(href),
  onSurface: (surface) => {
    if (surface.type === 'activity-log') {
      setActivityItems(Array.isArray(surface.items) ? surface.items : []);
      setAssemblerMinimized(false);
      setAssemblerOpen(true);
    } else {
      setWorkspaceOpen(workspaceElement.open);
    }
  }
});
```

The `actions` option is the `<acp-actions-pane>` custom element. The connector maps `activity-log` surfaces to its items and menu actions and opens it. Pane headers are fixed as `Workspace` and `Assembler`; agent-provided titles label content only. Existing `acp-actions-requested` and `acp-open-actions` events also open it.

Use the host application's existing configuration convention. The authoritative key list, required/optional status, secret handling, and introduction versions are in [config-manifest.json](./config-manifest.json). For a fresh install, add required keys and only the optional keys needed; for an upgrade, add missing keys without overwriting existing values. Never invent or commit a bearer token. If no authorized runtime token source has been provided, leave it unset and continue file integration and local checks; report authenticated harness verification as pending. A missing API URL or static token source is reported in Chat and does not throw during connector setup. `AGENT_FILE_RUN_OWNER_ID` can provide a static owner id; use `config.getOwnerId` when identity can change at runtime. `AGENT_HARNESS_WS_URL` is a separate legacy socket and is not used by this connector.

## Shell Layout

The host owns the existing vertical sidebar and its single launch button. Keep all three panes closed initially; clicking the button opens chat directly beside the sidebar. Mount Workspace and Assembler in the shell stage immediately to the right of chat. Their absolute surface layer overlays routed content without changing its width or position. Minimizing returns width to the surface layer, not to routed content. Maximizing expands the selected pane within the stage while preserving an open sibling; maximizing its sibling restores the first pane. Harness form/Buddy surfaces open Workspace unless explicitly closed; activity-log surfaces open Assembler independently.

The package enforces Chat before the stage and aligns the Workspace/Assembler layer to the stage's left edge. The Workspace header remains `Workspace`, and the Assembler header remains `Assembler`; pane titles are fixed regardless of form or agent response titles. Form titles can still label content inside Workspace.

Do not bind static `messages` or `pending` values or handle `acp-message-sent` separately while the harness connector is active. Angular hosts need `CUSTOM_ELEMENTS_SCHEMA`. The host remains responsible for router navigation, authorization, and domain saves.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for element and event contracts.
