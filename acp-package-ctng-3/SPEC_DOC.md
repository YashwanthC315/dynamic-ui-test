# ACP Chat Panel Recreation Specification

## Start Here: Answers at a Glance

| Question | Answer |
|---|---|
| Can it run in React? | Yes. These are browser Custom Elements, not Angular components. Register the bundle, load CSS, mount the elements, assign object/array properties via refs, and subscribe to DOM `CustomEvent`s. |
| How do I add/remove it? | Install/import it, add it to the persistent app shell beside the existing sidebar, and wire events. Close by setting `open = false` (keeps state/listeners); remove by unmounting the element and its host listeners. |
| How does it talk to the host? | Host assigns element properties; the elements emit bubbling DOM events. The host can translate them into NgRx actions, React state updates, navigation, and network operations. |
| Does it call an AI backend? | No backend or agent transport is provided by this archive. The host calls its backend over HTTPS or WebSocket and passes replies back through `messages`, `pending`, `formSpec`, and `items`. |
| What are the response types? | The shipped UI accepts messages with optional rich blocks (text, markdown, status, data, suggestions, form, confirmation, link, error), form specs, and activity items. A network envelope for these is a host/backend design decision. |

**Read in order:** sections 3-5 explain ownership and layout; sections 6-8 are the shipped API; sections 12-16 show mounting, state management, and backend design; the final checklist is the recreation test.

## 1. Purpose

This document describes the behavior, public API, layout contract, and host integration required to recreate the `@acp/chat-panel` package used in this folder.

The package is a framework-agnostic set of browser Custom Elements. It provides a docked AI chat column plus optional dynamic-form, Buddy enrollment, and activity/action panes. It is not an Angular component library and it is not an overlay or modal system.

## 2. Package Identity

- Package name: `@acp/chat-panel`
- Archive currently stored here: `acp-chat-panel-0.2.3.tgz`
- Manifest/runtime version inside the archive: `0.2.3`
- Entry module: `dist/acp-chat-panel.js`
- Type declarations: `dist/acp-chat-panel.d.ts`
- Main stylesheet: `styles/acp-chat-panel.css`
- Token stylesheet: `styles/acp-tokens.css`
- Browser API: Custom Elements / Web Components
- Registration: importing the entry module registers the elements globally

The archive contains no Angular compiler dependency. Angular hosts only need to allow custom elements and load the package styles.

## 3. Responsibilities

### Package owns

- Rendering chat messages and rich message blocks.
- Chat search, history flyout, new-chat control, composer, pending state, and cancel control.
- Parsing the configured form trigger prefix and emitting a normalized form request.
- Rendering dynamic forms and handling their local validation/submission UI.
- Rendering the Buddy enrollment workspace when used.
- Rendering activity items and pane controls.
- Clamping pane widths and emitting width changes.
- Open, close, minimize, maximize, restore, and rail behavior for package panes.
- Dispatching browser `CustomEvent`s with `bubbles: true` and `composed: true`.
- Applying styles through `--acp-*` CSS variables.

### Host application owns

- The sidebar and the single AI Agent launch button.
- The shell layout and router outlet.
- Chat/message/history persistence and the agent backend call.
- Navigation after a package event.
- Whether requested forms and actions are accepted and where their data is stored.
- State synchronization for `open`, widths, messages, history, form specs, and activity items.
- Mapping application design tokens to `--acp-*` variables.

The recommended direction of data flow is:

```text
user -> custom element -> DOM event -> host adapter -> state action/effect
                                      -> HTTPS/WSS backend -> host state
                                      -> element properties -> rendered UI
```

The browser package never needs backend credentials, application routing rules, or direct access to the host store.

## 4. Required Shell Layout

The visual order is (Workspace and Actions share a stage with routed content):

```text
sidebar | chat | stage [workspace | actions | remaining routed content]
```

Chat must be a full-height column directly beside the existing sidebar. It must not be placed after routed content, inside a routed page, in a top bar, or in a floating overlay.

A practical shell is:

```text
app-shell
  app-shell__body
    existing sidebar + AI button
    acp-workspace
      acp-workspace__chat
        acp-chat-panel
      acp-workspace__stage
        routed content
        acp-workspace__surface-layer
          acp-workspace__surface / acp-dynamic-container
          acp-workspace__actions / acp-actions-pane
```

The shell body and workspace must use a flex layout with `min-height: 0`; routed content should scroll within its own area. Keep package elements mounted when closed. A closed element must collapse to zero width rather than leaving an empty reserved column.

## 5. Initial and Independent State Rules

All panes start closed:

```typescript
chatOpen = false;
workspaceOpen = false;
actionsOpen = false;
```

Do not add `open` to the initial chat markup and do not open it from initialization. The sidebar button is the only initial launch path.

The panes are independent:

- Opening Chat does not open Workspace or Actions.
- A form request can open Workspace.
- An activity request can open Actions without closing Workspace.
- Closing Chat does not close either adjacent pane.
- Closing Workspace does not close Actions.
- Actions remains open until its own close/minimize behavior is invoked.
- Closed elements remain in the DOM so sibling events can still be routed.

## 6. Custom Elements

### 6.1 `<acp-chat-panel>`

A resizable, full-height conversation panel.

Properties:

| Property | Type | Meaning |
|---|---|---|
| `open` | `boolean` | Whether the panel occupies layout space |
| `title` | `string` | Header title |
| `placeholder` | `string` | Composer placeholder |
| `maxLength` | `number` | Composer character limit |
| `width` | `number` | Current width in pixels |
| `minWidth` | `number` | Minimum width |
| `maxWidth` | `number` | Maximum width |
| `dock` | `'left' \| 'right'` | Which edge owns the resize handle |
| `formTriggerPrefix` | `string` | Prefix used to detect form requests; default `/form` |
| `agentDisplay` | `string` | Agent name shown in the panel |
| `pending` | `boolean` | Shows the `Thinking...` state and cancel control |
| `messages` | `AcpChatMessage[]` | Conversation messages |
| `chatHistory` | `AcpChatHistoryItem[]` | Restorable conversation list |

Methods: `startNewChat()`, `toggleSearch()`, `clearSearch()`, `toggleHistory()`, `sendMessage(text)`.

Features:

- Text and rich message blocks.
- Real-time in-conversation search with match count and clear.
- Conversation history flyout.
- Bottom-anchored composer.
- Pending/thinking indicator and cancellation.
- Suggestion chips.
- Links, navigation, confirmations, status, data, inline forms, and errors.
- Drag resizing with clamped width.
- Close control and open state event.

### 6.2 `<acp-dynamic-container>`

A form/workspace surface placed immediately to the right of Chat in the stage.

Properties:

| Property | Type | Meaning |
|---|---|---|
| `open` | `boolean` | Whether the workspace is visible |
| `title` | `string` | Workspace title |
| `formWidth` | `number` | Current width in pixels |
| `minFormWidth` | `number` | Minimum width |
| `maxFormWidth` | `number` | Maximum width |
| `minimized` | `boolean` | Shows the compact vertical rail |
| `maximized` | `boolean` | Expands to the configured maximum |
| `formSpec` | `AcpFormSpec \| null` | Form definition to render |

Methods: `collapse()`, `maximize()`, `restore()`, `close()`.

The standard form field types are `text`, `number`, `date`, `checkbox`, `select`, and `textarea`. Fields can be required, disabled, placeholder-driven, option-backed, and constrained by `min`, `max`, or `maxLength`.

The container also provides a kebab action to request the Actions pane and emits form submission data. A minimized workspace becomes a clickable rail with a vertical label; restoring it returns to its normal width.

### 6.3 `<buddy-enrol-workspace-surface>`

Optional specialized workspace for multi-student enrollment.

Properties:

- `formId: string`
- `surface: unknown`
- `records: BuddyRecord[]`
- `activeRecordId: string`
- `buddyText: string`
- `parseInFlight: boolean`
- `checkInFlight: boolean`

It supports raw-text parsing, record search/selection, validation/checking, editable enrollment data, clear/cancel, single submit, and batch submit. It can emit activity requests for the Actions pane.

### 6.4 `<acp-actions-pane>`

A resizable activity log pane beside the Workspace pane.

Properties:

| Property | Type | Meaning |
|---|---|---|
| `open` | `boolean` | Whether the pane is visible |
| `title` | `string` | Header title |
| `width` | `number` | Current width in pixels |
| `minWidth` | `number` | Minimum width |
| `maxWidth` | `number` | Maximum width |
| `items` | `AcpActivityItem[]` | Activity/status rows |
| `menuActions` | `AcpActivityAction[]` | Overflow menu actions |
| `minimized` | `boolean` | Shows the compact vertical rail |
| `maximized` | `boolean` | Expands to the configured maximum |

Methods: `collapse()`, `maximize()`, `restore()`, `close()`.

Activity kinds are `info`, `success`, `warning`, and `error`. Rows may include record IDs and action buttons. The default overflow behavior includes copying all saved names to the clipboard.

## 7. Data Contracts

```typescript
type AcpChatRole = 'user' | 'assistant' | 'system' | 'error';
type AcpChatBlockType =
  | 'text' | 'markdown' | 'status' | 'data' | 'suggestions'
  | 'form' | 'confirmation' | 'link' | 'error';

interface AcpChatMessage {
  id: string;
  role: AcpChatRole;
  text?: string;
  blocks?: AcpChatBlock[];
  timestamp?: string | Date;
  agent?: { id?: string; name?: string } | null;
}

interface AcpChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string | Date;
}

interface AcpFormSpec {
  formId: string;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  initialValues?: Record<string, unknown>;
  fields: AcpFieldSpec[];
}

interface AcpFieldSpec {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  optionsSource?: string;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; maxLength?: number };
}

interface AcpActivityItem {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
  recordId?: string;
  actions?: AcpActivityAction[];
}
```

Chat blocks can additionally contain markdown, status levels, data rows, suggestions/actions, form fields, links/routes, confirmation text, and error details.

## 8. Event Contract

All events bubble and are composed. The host should listen at the element or shell level and update its state.

| Event | Detail | Host responsibility |
|---|---|---|
| `acp-open-change` | `boolean` | Synchronize the originating pane's `open` state |
| `acp-width-change` | `number` | Persist Chat width |
| `acp-form-width-change` | `number` | Persist Workspace width |
| `acp-actions-width-change` | `number` | Persist Actions width |
| `acp-message-sent` | `string` | Append user message and call the agent service |
| `acp-new-chat` | none | Clear/start a conversation |
| `acp-restore-conversation` | `{ conversationId: string }` | Load and replace messages |
| `acp-cancel-request` | none | Cancel the in-flight request and clear pending state |
| `acp-suggestion-click` | suggestion detail | Execute the suggestion action |
| `acp-navigate` | `{ href: string }` | Navigate through the host router |
| `acp-link-click` | link detail | Handle a message link |
| `acp-confirmation-action` | confirmation detail | Handle confirmation choice |
| `acp-form-requested` | `{ formSpec: AcpFormSpec }` | Set the active form and open Workspace |
| `acp-submitted` | submitted form detail | Persist/process submitted values |
| `acp-open-actions` | none | Open Actions beside Workspace |
| `acp-actions-requested` | `{ open: true; item: AcpActivityItem }` | Append the item and open Actions |
| `acp-action-click` | `{ item, actionId }` | Execute a row action |
| `acp-menu-action-click` | menu action detail | Execute overflow behavior |
| `acp-actions-close` | none | Close Actions |
| `acp-workspace-maximize` | none | Optionally persist/track maximize |
| `acp-restore-default-split` | none | Restore normal pane widths/rails |
| `buddy-parse` | Buddy parse detail | Call parsing service and update records |
| `buddy-clear` | none | Clear Buddy input/state |
| `buddy-cancel` | none | Cancel Buddy operation |
| `buddy-check` | Buddy check detail | Validate records |
| `buddy-submit` | Buddy submit detail | Submit one record |
| `buddy-submit-all` | Buddy submit detail | Submit all records |

## 9. Form Trigger Behavior

When the user sends text beginning with `formTriggerPrefix` (default `/form`), the chat panel parses the remainder into an `AcpFormSpec` and emits `acp-form-requested`. The host decides whether and how to open the Workspace.

A host implementation should:

1. Receive the form event.
2. Store `event.detail.formSpec`.
3. Set `workspaceOpen = true` and `workspaceMinimized = false`.
4. Keep routed content mounted.
5. Handle `acp-submitted` without unexpectedly closing the workspace.

## 10. Resizing and Rails

Each pane owns a horizontal resize handle and clamps the requested width between its minimum and maximum. The host may persist the emitted width and pass it back through the property.

- Chat emits `acp-width-change`.
- Workspace emits `acp-form-width-change`.
- Actions emits `acp-actions-width-change`.
- Minimize changes a pane to `--acp-rail-width` (default `52px`).
- Clicking a minimized rail restores the pane.
- Maximize expands the pane without closing its sibling.
- Closed panes occupy zero width.
- Do not put fixed-width wrapper columns around closed elements.

## 11. Styling Contract

Load both stylesheets globally:

```css
@import '@acp/chat-panel/tokens.css';
@import '@acp/chat-panel/styles.css';
```

At minimum, hosts should map these token groups:

- Opaque surfaces: `--acp-surface-bg`, `--acp-panel-bg`, `--acp-header-bg`, `--acp-stage-bg`, input and bubble backgrounds.
- Text: `--acp-text-primary`, `--acp-text-secondary`, `--acp-text-muted`, `--acp-text-on-primary`.
- Geometry: border color, radii, pane/header heights, rail width.
- Accent/focus: primary, hover, light accent, focus ring.
- Status: success, warning, error, and info foreground/background pairs.
- Shadows and app header height.

All package surfaces must remain opaque so routed content cannot show through forms, chat, rails, or action rows. Override the defaults by defining the same variables in the host theme.

## 12. Install, Mount, Hide, Remove

### Angular installation

1. Install the local archive: `npm install ./acp-chat-panel-0.2.3.tgz`.
2. Import `@acp/chat-panel` once from the application bootstrap entry point.
3. Add `CUSTOM_ELEMENTS_SCHEMA` to the Angular module/component that contains the custom elements.
4. Load `tokens.css` and `styles.css` globally.
5. Add the AI button to the bottom of the existing vertical sidebar.
6. Mount Chat in the shell beside the sidebar and mount Workspace/Actions in the stage.
7. Bind all input properties and output events listed above.
8. Connect `acp-message-sent` to the host's agent transport.
9. Verify initial closed state, independent close state, resizing, rails, form requests, activity requests, and routed-content preservation.

### Mount, hide, unmount

- **Mount:** Put the custom elements in the application shell, not a routed page. Register the JS once and load global CSS once. Keep the shell mounted while navigating.
- **Hide:** Set `chat.open = false` (and independently set `workspace.open`/`actions.open` when appropriate). This releases layout width without destroying the current conversation.
- **Unmount:** Remove the shell elements and remove host-installed event listeners; unsubscribe from store streams, abort pending HTTP requests, and close host-owned sockets when their scope ends. Unmounting loses element-local draft/search/menu state unless the host saved it. It does not unregister the browser's global custom-element definitions.
- **Remove from an application:** Remove the shell markup, toggle, listeners, package imports/styles, then uninstall the npm dependency. Do not remove the host's unrelated sidebar or router.

## 13. Host Communication and NgRx

### Four host communication paths

| Direction | Mechanism | Example |
|---|---|---|
| Host to UI | Assign properties, preferably DOM properties for arrays/objects | `chat.messages = messages; chat.pending = true` |
| UI to host | Listen for `CustomEvent`, read `event.detail` | `acp-message-sent` yields text |
| Host to UI command | Call public methods or update properties | `chat.sendMessage('hello')`, `workspace.open = false` |
| Host to external systems | Translate UI events into store actions/effects and backend calls; reflect results via properties | `messageSent` -> effect -> HTTP/WSS -> `replyReceived` -> `chat.messages` |

The fourth path belongs to the host, not to the Custom Element. Events can bubble to a common shell ancestor; bind to specific elements when `acp-open-change` is shared by multiple panes, or use `event.target` to identify the source.

### Sending a message end to end

1. User types and presses Send, or the host calls `chat.sendMessage('hello')`. Both paths emit `acp-message-sent` with the trimmed text in `event.detail`.
2. The host dispatches one action, appends one user message to its `messages` state, sets `pending`, and starts one backend operation.
3. A backend answer is **not** sent by calling `sendMessage` again (that would emit another user request). Instead the host appends an `AcpChatMessage` with `role: 'assistant'` and assigns the updated `messages` array to the element; then it clears `pending`.
4. On error, append a `role: 'error'` message. On cancel, abort the operation where possible, clear `pending`, and discard any late response associated with that request ID.

Keep message IDs stable and replace arrays rather than mutating them in place so host change detection and UI rendering see the update.

### Angular + NgRx reference design (host-owned, illustrative)

The shell listens to Custom Events and dispatches domain actions. A reducer owns the conversation and pane state; effects own I/O. Do not call the backend from the reducer or the Custom Element. Define typed action creators such as `chatMessageSent`, `chatReplyReceived`, `chatRequestFailed`, `chatCancelRequested`, `formRequested`, and `actionsRequested` in the host.

```typescript
// Shell component; typed NgRx action creators/selectors are defined in the host app.
readonly messages$ = this.store.select(selectChatMessages);
readonly pending$ = this.store.select(selectChatPending);
readonly chatOpen$ = this.store.select(selectChatOpen);

onMessageSent(event: Event) {
  this.store.dispatch(chatMessageSent({ text: (event as CustomEvent<string>).detail }));
}

onFormRequested(event: Event) {
  this.store.dispatch(formRequested({ formSpec: (event as CustomEvent<{ formSpec: AcpFormSpec }>).detail.formSpec }));
}

onActionsRequested(event: Event) {
  this.store.dispatch(actionsRequested({ item: (event as CustomEvent<{ item: AcpActivityItem }>).detail.item }));
}

onChatOpenChange(event: Event) {
  this.store.dispatch(chatOpenChanged({ open: (event as CustomEvent<boolean>).detail }));
}
```

In the shell template, the existing sidebar button toggles host state and the element's close control synchronizes it. Implement `toggleChat()` in the shell to dispatch `chatOpenChanged({ open: !currentOpen })` using the selected state:

```html
<button type="button" (click)="toggleChat()">AI Agent</button>
<acp-chat-panel
  [open]="(chatOpen$ | async) ?? false"
  [messages]="(messages$ | async) ?? []"
  [pending]="(pending$ | async) ?? false"
  (acp-message-sent)="onMessageSent($event)"
  (acp-form-requested)="onFormRequested($event)"
  (acp-open-change)="onChatOpenChange($event)"
></acp-chat-panel>
```

This is an illustrative shell fragment; wire form/Actions elements and their events as in the integration guide. Angular template event typings may need a typed wrapper/cast depending on the host's Angular version. `CUSTOM_ELEMENTS_SCHEMA` only admits the elements; it does not create NgRx integrations automatically.

```typescript
// Pseudocode for a host effect: choose ONE active transport per request.
message$ = createEffect(() => actions$.pipe(
  ofType(chatMessageSent),
  concatMap(({ text }) => agentApi.send({ text, conversationId: currentId }).pipe(
    map(reply => chatReplyReceived({ reply })),
    catchError(error => of(chatRequestFailed({ error: String(error) })))
  ))
));
```

The host reducer appends the user message once, sets `pending = true`, and then appends the assistant reply or an error message and sets `pending = false`. Maintain an active request ID and cancel the real HTTP request or WebSocket operation when `acp-cancel-request` is dispatched; merely setting `pending = false` does not stop network work. Ignore stale results from canceled or superseded requests. Handle history/new-chat and navigate actions in host effects/router handlers.

## 14. React Mounting (No Angular or NgRx Required)

Import the bundle once at application startup and import both styles globally. React is a host adapter, not an alternate package implementation. In a React shell, mount `<acp-chat-panel>` beside the sidebar; use refs for object properties and native `addEventListener` for custom events. Keep the event handler stable within the effect and remove exactly that handler during cleanup.

```tsx
import '@acp/chat-panel';
import '@acp/chat-panel/tokens.css';
import '@acp/chat-panel/styles.css';
import { useEffect, useRef } from 'react';
import type { AcpChatPanel, AcpChatMessage } from '@acp/chat-panel';

function ChatColumn({ messages, open, onOpenChange, onSend }: {
  messages: AcpChatMessage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string) => void;
}) {
  const chatRef = useRef<AcpChatPanel>(null);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.messages = messages;
    chatRef.current.open = open;
  }, [messages, open]);

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;
    const handleSend = (event: Event) => onSend((event as CustomEvent<string>).detail);
    chat.addEventListener('acp-message-sent', handleSend);
    return () => chat.removeEventListener('acp-message-sent', handleSend);
  }, [onSend]);

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;
    const handleOpen = (event: Event) => onOpenChange((event as CustomEvent<boolean>).detail);
    chat.addEventListener('acp-open-change', handleOpen);
    return () => chat.removeEventListener('acp-open-change', handleOpen);
  }, [onOpenChange]);

  return <acp-chat-panel ref={chatRef} />;
}
```

In the parent shell, keep `open` in state, place `<ChatColumn ... />` next to the sidebar, and set `open` from the sidebar toggle. To hide, set `open` to `false`; to remove, stop rendering `ChatColumn` and its wrapper. The effects above remove host listeners on unmount. This snippet shows only chat: wire `pending`, history, forms, Actions, and width changes in the real shell. JSX custom-element typing can require extending `JSX.IntrinsicElements` depending on React/TypeScript versions. For server-rendered React, register the bundle in a browser-only entry/effect because `HTMLElement` and `customElements` require a DOM. React users can use a Redux store or plain React state; NgRx is Angular-specific.

## 15. Backend and Agentic AI (Recommended, Not Shipped)

The host is the trust boundary. Authenticate to **its own** backend; keep secrets and third-party agent credentials server-side. Let the backend orchestrate model calls, tools, authorization, persistence, and auditing. Do not execute arbitrary tool calls, navigate to untrusted URLs, or treat AI-proposed actions as successful writes without host/server validation.

One possible application-level exchange is:

```json
{
  "requestId": "r-42",
  "conversationId": "c-7",
  "text": "Enroll a student",
  "context": { "route": "/students" }
}
```

For **HTTPS request/response**, the host sends `POST /api/agent/chat`, correlates the response to `requestId`, and maps it to an assistant message. For **streaming**, the host can choose a WebSocket (`wss://...`) and receive ordered frames by `requestId`/`conversationId`; accumulate text deltas in the host, then commit the final assistant message. These URLs and envelopes are examples to design with the backend, not endpoints or protocol provided by this package. HTTP streaming/SSE can be another host transport if desired.

Example host/backend response protocol (design this with the server, then translate it into the package's existing properties):

```json
{ "requestId": "r-42", "type": "message", "message": { "id": "m-2", "role": "assistant", "text": "Let's enroll a student." } }
```

For a socket, frames can use `type: "delta"` with a sequence number and text chunk, `type: "form"` with a validated `formSpec`, `type: "activity"` with an item, and a terminal `type: "done"` or `type: "error"`. Define ordering, duplicate handling, reconnect/resume policy, and authorization with the server. HTTPS can return an array of equivalent outcomes in one response. Neither framing nor response envelope is part of the shipped Custom Element API.

Recommended host API map (adapt paths to the actual product; these routes are **not** implemented by this package):

| Host/backend operation | Example transport | Trigger | Host result |
|---|---|---|---|
| Send prompt | `POST /api/agent/chat` or `wss://.../agent` send frame | `acp-message-sent` | Assistant messages/blocks, form proposals, progress, errors |
| Load history/thread | `GET /api/conversations`, `GET /api/conversations/:id` | App startup / `acp-restore-conversation` | `chatHistory` and `messages` |
| Cancel request | Abort HTTP or send WebSocket cancel frame with request ID | `acp-cancel-request` | Clear `pending`; ignore late results |
| Submit form | `POST /api/forms/:formId/submissions` | `acp-submitted` | Server-confirmed activity item or error |
| Parse/check/submit Buddy records | Product-specific authenticated endpoints | `buddy-parse`, `buddy-check`, `buddy-submit`, `buddy-submit-all` | Updated records, validation, activity |
| Execute suggested action/navigation | Host router or authenticated domain API | `acp-suggestion-click`, `acp-navigate`, `acp-action-click` | Navigation or validated state update |

The host may batch backend outcomes into a single reply or stream them as they occur. Do not trust a suggestion's payload as a URL, command, or write authorization; validate it against permitted routes/actions. Store conversation history on the backend if it must survive refreshes, and feed it back to the UI through `chatHistory`/`messages`.

Map a validated backend result to one or more of these UI outcomes:

1. **Answer:** assistant message with text or markdown blocks.
2. **Progress/data:** status and data blocks, optionally updated during a stream.
3. **Proposed next step:** suggestions, link/navigation, confirmation, or form specification; require user confirmation for consequential actions.
4. **Outcome/error:** form result, activity item, or error message; report actual server success/failure rather than assuming submission succeeded.

Suggested lifecycle: `idle -> sending -> streaming/awaiting-tool-or-user -> completed | failed | canceled`. The host records a conversation ID, request ID, timestamps, and cancellation state. A `tool_call`/agent plan stays on the backend until approved or completed; the UI displays only validated user-facing events. If the backend proposes a form, the host sets `formSpec`/`workspaceOpen`; if it reports a committed action, the host appends an `AcpActivityItem` and opens Actions. Map the same four outcomes identically whether transport is HTTPS or WebSocket.

**Important shipped behavior:** sending `/form ...` emits both `acp-message-sent` and `acp-form-requested`. The Workspace also listens for bubbled form requests and may auto-open; a host that additionally handles that event must synchronize its state rather than create a second pane/request. The current form UI emits `acp-submitted` and a local success `acp-actions-requested` on submit, before any host backend confirms success. A production host should treat `acp-submitted` as an intent, make the API call, and display authoritative success/failure from the backend; recreating the component should avoid claiming success until confirmed.

## 16. Minimal Host State Example

```typescript
chatOpen = false;
chatWidth = 380;
workspaceOpen = false;
workspaceWidth = 540;
workspaceMinimized = false;
actionsOpen = false;
actionsWidth = 280;
actionsMinimized = false;

messages: AcpChatMessage[] = [];
chatHistory: AcpChatHistoryItem[] = [];
activeFormSpec: AcpFormSpec | null = null;
activityItems: AcpActivityItem[] = [];

onMessageSent(text: string) {
  // Append the user message, set pending, call the agent, append its reply.
}

onFormRequested(detail: { formSpec: AcpFormSpec }) {
  this.activeFormSpec = detail.formSpec;
  this.workspaceOpen = true;
  this.workspaceMinimized = false;
}

onActionsRequested(detail: { open: true; item: AcpActivityItem }) {
  this.activityItems = [detail.item, ...this.activityItems];
  this.actionsOpen = true;
  this.actionsMinimized = false;
}
```

## 17. Recreation Acceptance Checklist

- [ ] Importing the runtime registers all four expected custom elements.
- [ ] Chat is closed on first load and opens only from the host sidebar button.
- [ ] Chat is directly beside the sidebar and full height.
- [ ] Composer remains at the bottom while messages grow above it.
- [ ] Search filters messages and exposes a clear/match-count interaction.
- [ ] History can restore a conversation.
- [ ] Pending state displays `Thinking...` and cancellation emits an event.
- [ ] Suggestions, links, and navigation emit actionable events.
- [ ] `/form ...` emits a normalized form request.
- [ ] Workspace opens beside Chat without replacing routed content.
- [ ] Workspace fields validate and submit through `acp-submitted`.
- [ ] Workspace and Actions minimize into clickable rails and can restore/maximize.
- [ ] Actions opens from activity requests without closing Workspace.
- [ ] Activity rows render info/success/warning/error states and actions.
- [ ] Every pane resizes independently and closed panes use zero layout width.
- [ ] Package styling is token-driven and surfaces are opaque.
- [ ] The host can recreate the complete behavior without depending on Angular internals.
- [ ] NgRx actions/effects or React state mediate event-to-backend-to-property flow without network code in the element.
- [ ] HTTPS responses and WebSocket frames map into the same UI contracts; cancellation and stale replies are handled.
- [ ] Host-validated backend success/failure, not the built-in local form toast, is authoritative for writes.

## 18. Source of Truth

When this document and an implementation differ, use the shipped declaration file and runtime archive as the API authority, then update this document. The workspace [`README.md`](./README.md) and [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) remain the quick integration guides; this file is the deeper recreation reference.
