# reverb_spec.md — Agentic Chat Panel Integration Spec

**Package:** `@acp/chat-panel` v0.2.18
**Audience:** The coding agent integrating the chat panel into the host application.
**Source of truth:** ACP Chat Panel – Universal Application Integration Agent Guide (v0.2.18).

Every rule below is mandatory and must be verifiable. Follow the sections **in order**. Do not skip "simple" rules. Do not mark the task complete until the Final Verification Checklist (Section 16) passes.

---

## 0. How to use this spec

- 0.1 Treat each numbered rule as a pass/fail requirement.
- 0.2 An integration request authorizes all necessary host file changes (imports, global styles, shell markup, launch button, event handlers, connector setup). Make those changes.
- 0.3 Run the available build and local UI checks even if a save API or runtime credentials are missing.
- 0.4 Missing backend setup must never cause a "no files changed" response.
- 0.5 Ask a blocking question only when a required decision prevents the file changes themselves.
- 0.6 The final handoff must clearly separate: (a) completed integration, (b) unverified authenticated requests, (c) unwired persistence.

---

## 1. Design tokens and styling rules

1.1 All styling is governed by Design Tokens (`--acp-*` CSS variables).

1.2 Import `@acp/chat-panel/tokens.css` first, then `@acp/chat-panel/styles.css`, globally, in that order.

1.3 Do not copy token defaults into the host stylesheet.

1.4 Map the host's existing design tokens to the ACP tokens (or define the `--app-*` values the package maps from). At minimum map:
- `--acp-surface-bg`
- `--acp-panel-bg`
- `--acp-primary-accent`
- `--acp-text-primary`
- `--acp-control-disabled-bg`
- `--acp-control-disabled-border`
- `--acp-control-disabled-text`

1.5 Disabled-control colors must be defined so greyed-out buttons are visibly disabled.

1.6 All surfaces (chat, Workspace, Assembler) must be fully opaque. No transparent or translucent backgrounds.

1.7 Verify the rendered result using computed styles (background colors are opaque, tokens resolve to host values).

1.8 Do not hardcode colors, fonts, spacing, or radii that already exist as host tokens.

---

## 2. Package registration and configuration

2.1 In the app entrypoint (e.g. `src/main.ts`) add:
```ts
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
```
2.2 Follow the host's existing configuration convention (Angular `environment.ts` is only an example).

2.3 Fresh install: add the manifest's required keys; add optional keys only when their features are used.

2.4 Upgrade: compare `config-manifest.json` with the existing host config, add only missing keys, preserve every existing value.

2.5 Keys expected (names may follow host convention):
- `AGENT_FILE_RUN_API_URL`
- `AGENT_FILE_RUN_BEARER_TOKEN`
- `AGENT_FILE_RUN_AGENT_PATH`
- `AGENT_FILE_RUN_OWNER_ID`
- `AGENT_SUGGESTIONS_AGENT_PATH`

2.6 Never guess, generate, or commit a bearer token.

2.7 Reuse the host's authorized runtime-token source if one exists; otherwise leave the token empty and continue integration, builds, and UI checks.

2.8 Report authenticated harness verification as **pending** when no token is available.

2.9 Tell the user to configure secrets through the host's secure mechanism, not through agent chat.

---

## 3. Harness server

3.1 The Agent Harness server must be running on the configured port (default `4001`).

3.2 Start command: `mix do app.config + aetheris server --port 4001`.

3.3 Required environment for the server: `AETHERIS_PLAYGROUND_TOKENS`, `AETHERIS_AGENTS_ROOT`, `AETHERIS_PROVIDER`, provider API key (e.g. `OPENROUTER_API_KEY`), `CT_BOT_MODEL`.

3.4 Provide both Linux/macOS and Windows PowerShell start instructions in the handoff.

3.5 If the harness cannot be started, report it as unverified; do not fake responses.

---

## 4. Angular setup

4.1 Enable `CUSTOM_ELEMENTS_SCHEMA` in the host module or standalone component that renders the ACP elements.

4.2 Support both Standalone Angular (14–19+) and NgModule Angular (4–16); follow whichever the host uses.

4.3 Do not introduce a CDK overlay, dialog, or modal for any ACP surface.

---

## 5. Launch button (sidebar toggle)

5.1 The host owns **exactly one** AI Agent / chat toggle button.

5.2 First locate and reuse the existing side navigation. Search for: `sidebar`, `sidenav`, `side-nav`, `nav-rail`, `navigation-rail`, `side-menu`, `drawer`, `menu-panel`, or any equivalent component/class.

5.3 Place the button at the **bottom** (footer area) of the existing sidebar.

5.4 Reuse the sidebar's existing markup, icon library, sizing, active state, accessibility, and styling for the button.

5.5 Create a new side panel **only** if the host has no vertical side navigation. That fallback must contain no new top panel or header.

5.6 Never place the button in, or create, a top bar, header, toolbar, masthead, or any horizontal panel.

5.7 Never create a second sidebar next to an existing one.

5.8 Button has `type="button"` and `aria-label="Toggle AI Agent"`.

5.9 Button shows an `active` state while chat is open.

5.10 Clicking the button toggles the chat element's `open` property (`onChatOpenChange(!chatOpen)`).

5.11 The chat element's own close control emits `acp-open-change` with `false`; the host must handle it.

---

## 6. Initial state

6.1 On initial load, **Chat, Workspace, and Assembler are all closed**.

6.2 Do not put the `open` attribute on `<acp-chat-panel>` in static markup.

6.3 Do not open the chat from an initialization hook (`ngOnInit`, `ngAfterViewInit`, etc.).

6.4 Host state defaults: `chatOpen = false`, `workspaceOpen = false`, `actionsOpen = false`.

6.5 Closed elements occupy **zero width**. Do not reserve fixed-width shell columns around closed elements.

---

## 7. Chat panel placement and layout

7.1 The chat panel lives in the **app shell**, never inside a routed page component.

7.2 The chat opens **docked directly next to the sidebar** (immediately to its right).

7.3 Required horizontal order in the shell row: `sidebar | chat | stage`.

7.4 Keep `.acp-workspace__chat` before `.acp-workspace__stage` in the shell row.

7.5 The chat panel occupies the **full vertical space** (full-height column, `100%`).

7.6 The text entry area sits at the **bottom** of the chat panel.

7.7 The message list fills the space above the entry area.

7.8 The chat is **independently resizable** (width). Bind `(acp-width-change)="chatWidth = $event.detail"` when width is stored by the host. Default width: `380`.

7.9 The message list **scrolls** as the conversation grows; the entry area stays pinned at the bottom.

7.10 Opening Chat never opens Workspace or Assembler.

7.11 Closing Chat does not close Workspace or Assembler.

7.12 Routed content stays full width beneath Workspace and Assembler and does **not shift** when either pane opens.

### Prohibited layouts
- ❌ `sidebar | routed content | chat on far right`
- ❌ Floating dialog, viewport-level drawer, modal, or CDK overlay
- ❌ Dynamic forms opening at the far-right edge of the viewport
- ❌ Chat placed inside a routed page component
- ❌ Replacing or closing Workspace when the Assembler opens

---

## 8. Send button and chat input

8.1 The Send button is **disabled (greyed out, not clickable)** when the chat input is empty.

8.2 The Send button becomes **enabled only after** the user types in the chat box.

8.3 Disabled styling uses `--acp-control-disabled-*` tokens.

8.4 Whitespace-only input must not enable Send.

8.5 After sending, the input clears and Send returns to disabled.

---

## 9. Harness connection (chat behavior)

9.1 Initialize `connectAcpHarness` from `@acp/chat-panel/harness` inside `ngAfterViewInit()` (DOM must be mounted).

9.2 Call `disconnect()` in `ngOnDestroy()` only. Keep the connector alive across panel open/close toggles.

9.3 Pass `chat`, `workspace`, and `actions` elements, plus `environment` and `config`.

9.4 `config.getBearerToken` returns the trimmed token from the host's secure source.

9.5 Provide the authenticated user's stable owner id through `config.ownerId` or `config.getOwnerId`.

9.6 Provide `getContext` returning at least the current route; provide `onNavigate` routing via the host router.

9.7 The connector owns: message history, pending states, streaming replies, suggestion chips, and surface dispatching.

9.8 **Do NOT bind** on `<acp-chat-panel>`: `[messages]`, `[pending]`, `(acp-message-sent)`. These override live responses.

9.9 Only bind shell layout state: `[open]`, `[width]`, `[agentDisplay]`, `(acp-open-change)`, `(acp-width-change)`, `(acp-navigate)`.

9.10 Conversation history comes from the harness (owner-scoped threads). Never use browser storage as the history source of truth.

9.11 History refreshes at startup and on each panel reopen. If authentication resolves while chat is open, call `connection.refreshHistory()`.

9.12 Features expected to work: real-time streaming replies, suggestion chips, conversation history, cancellation, in-conversation search.

---

## 10. Workspace (dynamic form surface)

10.1 Workspace opens **only** on: `acp-form-requested`, harness surface detection, or an equivalent explicit host update.

10.2 Workspace opens **immediately to the right of the chat panel**.

10.3 Workspace is presented **over the existing website (routed content)**, inside the stage's surface layer, while the chat panel remains next to it.

10.4 The surface layer starts at the stage's left edge so Workspace sits directly beside Chat.

10.5 Workspace is a docked overlay, not a floating dialog or viewport drawer.

10.6 Workspace **moves along with** the chat panel: when the chat panel is resized wider or narrower, Workspace's left edge follows the chat's right edge.

10.7 Workspace header always reads **`Workspace`**. Never derive it from the prompt, form spec, or response surface title. Surface titles may label inner content only.

10.8 Workspace is independently resizable in width (`acp-form-width-change`, default `540`) and height (`acp-form-height-change`, default `null` = full column).

10.9 Workspace controls: minimize `−`, maximize `⤢`, kebab `⋮`, close.

10.10 An explicit user close is respected; do not reopen automatically.

10.11 Workspace kebab menu provides **"Open Actions"**.

10.12 Bind: `[open]`, `[minimized]`, `[formWidth]`, `[formHeight]`, `(acp-open-change)`, `(acp-form-width-change)`, `(acp-form-height-change)`, `(acp-open-actions)`, `(acp-workspace-maximize)`, `(acp-restore-default-split)`, `(acp-submitted)`, `(acp-actions-requested)`.

---

## 11. Dynamic form behavior

11.1 The dynamic form opens inside the Workspace.

11.2 Every form component (inputs, selects, checkboxes, etc.) is **created dynamically** from the form spec. No hardcoded field markup.

11.3 Standard forms start with **Submit greyed out/disabled** while required fields are invalid.

11.4 Submit becomes **enabled only after** entered fields pass validation.

11.5 Enrollment records require explicit `valid: true` and all required fields complete.

11.6 Raw-text edits require **reparsing**.

11.7 Structured field edits and Clear require **revalidation**, not reparsing unchanged raw text.

11.8 Validation-only echoes preserve the current values.

11.9 While parsing/checking, Submit stays disabled.

11.10 "Submit All" requires **every** record to pass.

11.11 Never override disabled buttons or bypass submission guards in host code.

11.12 A valid submission opens the Assembler through the existing activity event.

---

## 12. Assembler (activity log pane)

12.1 The Assembler opens **next to Workspace** (adjacent column, to its right).

12.2 It opens on: activity-bearing `acp-actions-requested`, `acp-open-actions`, or harness `activity-log` surface.

12.3 It is **independent** of Workspace: opening it never closes or replaces Workspace.

12.4 It stays open until the user explicitly minimizes or closes it.

12.5 It renders status items and action menus.

12.6 Independently resizable: width (`acp-actions-width-change`, default `280`) and height (`acp-actions-height-change`, default `null`).

12.7 Assembler header remains fixed; surface titles do not rename the pane.

12.8 Kebab menu provides **"Copy all saved names"**.

12.9 Bind: `[open]`, `[width]`, `[height]`, `[items]`, `[minimized]`, `(acp-open-change)`, `(acp-actions-width-change)`, `(acp-actions-height-change)`, `(acp-actions-close)`, `(acp-action-click)`, `(acp-restore-default-split)`.

12.10 On `acp-actions-requested`, prepend the new item to `activityItems`.

12.11 On harness `activity-log` surface, set `activityItems` from `surface.items`, open and un-minimize the Assembler.

---

## 13. Window management (applies to Workspace and Assembler)

13.1 **Minimize (`−`)**: collapses the pane into a slim vertical rail (`52px` wide) with a vertical label and close button.

13.2 **Maximize (`⤢`)**: expands the pane to the available stage width while preserving an open sibling. Maximizing the sibling restores the currently maximized pane first.

13.3 **Restore**: clicking anywhere on a minimized rail's header restores the pane (one-click rail restore).

13.4 **Kebab (`⋮`)** overflow menu present on both panes.

13.5 **Width resize**: right-edge divider aligns with the pane boundary.

13.6 **Height resize**: bottom edge resizes height; bottom-right corner grip resizes width + height.

13.7 Height is clamped between the minimum (`240px` default) and the viewport bottom.

13.8 Height grips are hidden while a pane is minimized or maximized.

13.9 Rail state classes: `acp-workspace-rail` (Workspace), `acp-actions-rail` (Assembler).

13.10 `restoreDefaultSplit()` sets `workspaceMinimized = false` and `actionsMinimized = false`.

---

## 14. Shell markup structure

14.1 Required structure inside the app shell body:
```
app-shell
 └─ app-shell__body
     ├─ existing sidebar (AI button at bottom)
     └─ .acp-workspace
         ├─ .acp-workspace__chat → <acp-chat-panel>
         └─ .acp-workspace__stage
             ├─ .acp-workspace__content → <router-outlet>
             └─ .acp-workspace__surface-layer
                 ├─ .acp-workspace__surface → <acp-dynamic-container>
                 └─ .acp-workspace__actions → <acp-actions-pane>
```

14.2 Existing host top chrome (header, etc.) is left untouched.

14.3 Existing sidebar items stay unchanged; only the AI button is added.

14.4 Do not wrap closed elements in fixed-width columns.

---

## 15. Persistence and submission events

15.1 `acp-submitted`, `buddy-submit`, `buddy-submit-all` only report requested values; they do not call APIs or confirm persistence.

15.2 If an authorized domain save service exists, reuse it.

15.3 If none exists: wire the events to explicit **non-persisting** handlers, keep Workspace open, and show that saving is not configured (host feedback mechanism or Assembler warning).

15.4 Do not invent an endpoint.

15.5 Do not silently discard submissions.

15.6 Do not show "Saved" or any success message without confirmed server confirmation.

15.7 Report persistence as **unwired** in the final handoff.

15.8 Do not ask for approval to defer persistence; continue the integration.

---

## 16. Final verification checklist

**Config and setup**
- [ ] Config values follow the host convention; token comes from an authorized secret source.
- [ ] `tokens.css` then `styles.css` imported globally.
- [ ] Harness server running on the configured port (or reported unverified).
- [ ] `CUSTOM_ELEMENTS_SCHEMA` enabled.

**Design**
- [ ] Host tokens mapped to `--acp-*`, including disabled-control tokens.
- [ ] All surfaces opaque (checked via computed styles).

**Launch button and layout**
- [ ] Exactly one AI toggle button, at the bottom of the existing sidebar.
- [ ] No button or new panel added to any top bar/header.
- [ ] Chat opens docked directly next to the sidebar.
- [ ] Chat fills full vertical height; entry area at the bottom.
- [ ] Chat is resizable and messages scroll.
- [ ] Chat, Workspace, Assembler all closed on initial load.
- [ ] Closed elements occupy zero width.
- [ ] Routed content stays full width and does not shift.

**Chat behavior**
- [ ] Send button disabled when input is empty; enabled after typing.
- [ ] `connectAcpHarness` in `ngAfterViewInit`, `disconnect()` in `ngOnDestroy`.
- [ ] No `[messages]`, `[pending]`, or `(acp-message-sent)` on `<acp-chat-panel>`.
- [ ] Sending a message produces a harness request and live streamed reply.
- [ ] Suggestion chips appear and work.
- [ ] History restores after refresh using owner id (not browser storage).

**Workspace and forms**
- [ ] Workspace opens only on form request/surface detection, beside the chat.
- [ ] Workspace overlays the routed content, not a modal/viewport drawer.
- [ ] Workspace follows the chat's edge when chat is resized.
- [ ] Workspace header always reads `Workspace`.
- [ ] Dynamic form opens in Workspace; each component is generated dynamically.
- [ ] Submit disabled until validation passes; enables after.
- [ ] Submit All requires every record valid.

**Assembler**
- [ ] Assembler opens next to Workspace and does not close or replace it.
- [ ] Status items and action menus render.
- [ ] Valid submission opens the Assembler.
- [ ] Assembler header remains fixed.

**Window management**
- [ ] `−` collapses to 52px rail; one click restores.
- [ ] `⤢` maximizes within the stage; sibling handling correct.
- [ ] `⋮` menus present ("Open Actions" / "Copy all saved names").
- [ ] Width and height resizing work; height grips hidden when minimized/maximized.

**Handoff**
- [ ] Final report lists: completed integration, unverified authenticated requests, unwired persistence.
- [ ] No fake "Saved" messages; no invented endpoints; no committed secrets.

---

## 17. Troubleshooting reference

| Symptom | Cause | Fix |
|---|---|---|
| Chat shows only canned intro text | `[messages]` bound in template | Remove `[messages]` and `[pending]`; let the connector own state |
| Chat doesn't respond / calls `/api/agent/chat` | `(acp-message-sent)` bound to a mock | Remove the binding |
| `connectAcpHarness requires an acp-chat-panel element` | Called in `ngOnInit` before DOM render | Move to `ngAfterViewInit()` |
| API URL or token configuration error | Missing URL, token source, or agent path | Check config and manifest; use the host's secure token provider |
| Recent Chats empty after refresh | Missing owner id or harness history routes unavailable | Provide `ownerId`/`getOwnerId`, await `connection.ready`, inspect thread/events API |
| `Agent reply WebSocket failed.` | Harness not running or CORS rejected | Start the harness on port 4001 and verify origins |
