# ACP Chat Panel Recreation Specification

## 1. Purpose

This document describes the behavior, public API, layout contract, and host integration required to recreate the `@acp/chat-panel` package used in this folder.

The package is a framework-agnostic set of browser Custom Elements. It provides a docked AI chat column plus optional dynamic-form, Buddy enrollment, and activity/action panes. It is not an Angular component library and it is not an overlay or modal system.

## 2. Package Identity

- Package name: `@acp/chat-panel`
- Archive currently stored here: `acp-chat-panel-0.2.2.tgz`
- Manifest/runtime version inside the archive: `0.2.1`
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

## 4. Required Shell Layout

The visual order is:

```text
sidebar | chat | workspace/actions stage | routed content
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

## 12. Angular Integration Sequence

1. Install the local archive: `npm install ./acp-chat-panel-0.2.2.tgz`.
2. Import `@acp/chat-panel` once from the application bootstrap entry point.
3. Add `CUSTOM_ELEMENTS_SCHEMA` to the Angular module/component that contains the custom elements.
4. Load `tokens.css` and `styles.css` globally.
5. Add the AI button to the bottom of the existing vertical sidebar.
6. Mount Chat in the shell beside the sidebar and mount Workspace/Actions in the stage.
7. Bind all input properties and output events listed above.
8. Connect `acp-message-sent` to the host's agent transport.
9. Verify initial closed state, independent close state, resizing, rails, form requests, activity requests, and routed-content preservation.

## 13. Minimal Host State Example

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

## 14. Recreation Acceptance Checklist

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

## 15. Source of Truth

When this document and an implementation differ, use the shipped declaration file and runtime archive as the API authority, then update this document. The workspace [`README.md`](./README.md) and [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) remain the quick integration guides; this file is the deeper recreation reference.
