# ACP Chat Panel Specification

**Spec version:** 0.2.2  
**Status:** Authoritative contract for all implementations

This document defines the behavior, public API, layout contract, data contracts,
event model, and host integration rules for the ACP Chat Panel system
(Chat + Dynamic Workspace + Actions + optional Buddy enrollment surface).

It is intentionally framework-agnostic. An implementation may be delivered as
Custom Elements, React components, Vue components, or any other UI technology.
**The contracts in this document are the authority.**

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used in their usual
normative sense. Notes marked *Reference implementation* describe how one existing
Custom Elements bundle behaves and are **informative only**.

---

## Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Component Set & Responsibilities](#2-component-set--responsibilities)
3. [Required Shell Layout](#3-required-shell-layout)
4. [Initial & Independent State Rules](#4-initial--independent-state-rules)
5. [Public API](#5-public-api)
6. [Data Contracts](#6-data-contracts)
7. [Event / Callback Contract](#7-event--callback-contract)
8. [Form Trigger Behavior](#8-form-trigger-behavior)
9. [Resizing, Rails, Maximize/Restore](#9-resizing-rails-maximizerestore)
10. [Styling & Theming Contract](#10-styling--theming-contract)
11. [Host Responsibilities & Data Flow](#11-host-responsibilities--data-flow)
12. [Backend & Agentic AI Mapping (recommended)](#12-backend--agentic-ai-mapping-recommended)
13. [Acceptance Checklist](#13-acceptance-checklist)
14. [Appendix A: Default Values](#14-appendix-a-default-values)
15. [Appendix B: Conformance for Native Implementations](#15-appendix-b-conformance-for-native-implementations)
16. [Appendix C: Illustrative Host Patterns (Custom Elements reference)](#16-appendix-c-illustrative-host-patterns-custom-elements-reference)
17. [Appendix D: Reference Implementation Notes](#17-appendix-d-reference-implementation-notes)

---

## 1. Purpose & Scope

### 1.1 What this is

The ACP Chat Panel is a **docked, non-overlay AI assistant workspace** that sits
inside a host application's shell, next to its side navigation. It lets a user:

- talk to an AI agent in a full-height chat column,
- work on structured forms the agent opens in an adjacent **Workspace** pane,
- see a running log of completed operations in an **Actions** pane,
- optionally bulk-enter student records in a **Buddy enrollment** workspace,

without leaving or unmounting the page they are on.

### 1.2 Feature list

**Chat**
- Full-height, docked chat column with bottom-anchored composer
- Character counter and configurable max length; Enter to send, Shift+Enter for newline
- Rich message blocks: text, markdown, status, data table, suggestion chips, link, inline form, confirmation, error
- In-conversation search with live result count and clear
- Chat history flyout with one-click conversation restore
- New chat, help, and close controls
- "Thinking..." in-flight indicator and Cancel control
- Agent name tag in header and per-message agent attribution
- Suggestion chips that send a follow-up prompt or request navigation
- Form-command trigger that opens the Workspace with a generated form

**Workspace (Dynamic Container)**
- Renders a form from a JSON form spec (text, number, date, checkbox, select, textarea)
- Native validation (required, min/max, maxLength) before submit
- Automatic Buddy enrollment surface for recognized enrollment form IDs
- Minimize to rail, maximize, restore, close
- Overflow menu with **Open Actions**
- Independent width (and optional height) resizing
- Respects an explicit user close: later agent requests do not force it open

**Actions pane**
- Accumulating activity log with `info` / `success` / `warning` / `error` tints
- Per-item action buttons
- Overflow menu with configurable menu actions
- Minimize to rail, maximize, restore, close
- Independent width (and optional height) resizing
- Opens automatically beside Workspace when an activity item arrives

**Buddy enrollment workspace (optional)**
- Raw text input with Parse
- Record chip strip with search, pagination, saved and invalid markers
- Editable form for the active record
- Clear, Cancel, Validate, Submit, Submit All
- Posts success items to the Actions pane on submit

**Platform**
- Framework-agnostic public contract
- Theming entirely through CSS variables with opaque surfaces
- Keyboard-operable resize handles, accessible controls
- Responsive behavior for narrow viewports

### 1.3 Out of scope

- Calling an AI model or any backend. The host owns all I/O (see Â§11, Â§12).
- Routing. The UI *requests* navigation; the host performs it.
- Persisting state (widths, heights, messages, history). The host stores what it needs.
- Rendering the host's sidebar or launch button.

---

## 2. Component Set & Responsibilities

The system consists of four logical surfaces. Tag names below are conventional
for a Custom Elements reference implementation; other implementations use their
own component names but **MUST** expose the same public contract.

```
| Logical component                         | Typical CE tag                      | Responsibility                                                             | Owns                                                                           |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Chat Panel**                            | `<acp-chat-panel>`                  | Conversation UI, composer, search, history, suggestion chips, form trigger | Draft text, search term, flyout visibility, its own width                      |
| **Dynamic Workspace**                     | `<acp-dynamic-container>`           | Displays the active form spec or Buddy surface; emits submissions          | Current form spec, in-progress field values, rail/maximize state, width/height |
| **Actions Pane**                          | `<acp-actions-pane>`                | Accumulates activity items; exposes item and menu actions                  | Item list, active tab, menu state, rail/maximize state, width/height           |
| **Buddy Enrollment Workspace** *(optional)* | `<buddy-enrol-workspace-surface>` | Multi-record entry: parse, pick, edit, validate, submit                    | Records, active record, saved set, search/page                                 |
```

Components communicate **only through events / callbacks** (Â§7). No component
calls another component's methods directly. Workspace and Actions **MAY** listen
for sibling requests on a common ancestor (or the document root).

```text
Host shell  --props/methods-->  Chat / Workspace / Actions
Chat        --events--------->  Host
Chat        --form-requested--> Workspace (or Host, which then drives Workspace)
Workspace   --events--------->  Host + Actions
Buddy       --events--------->  Host + Actions
Actions     --events--------->  Host
```

---

## 3. Required Shell Layout

### 3.1 Horizontal order

The host shell **MUST** place the components in this left-to-right order:

```text
+---------+--------------------+--------------------------------------------------+
| sidebar | chat (full height) | stage                                            |
| [AI]    | docked next to     | +-----------+---------+                          |
| button  | sidebar            | | Workspace | Actions | (surface layer, on top)  |
|         |                    | +-----------+---------+                          |
|         |                    | routed content (stays mounted underneath)        |
+---------+--------------------+--------------------------------------------------+
```

Order: `sidebar | chat | workspace | actions | routed content`

### 3.2 Layout rules

1. Chat **MUST** be docked beside the sidebar, not on the far side of routed content.
2. Chat, Workspace, and Actions **MUST NOT** be modal dialogs, drawers, or floating overlays detached from the shell.
3. Workspace and Actions **MUST** render above routed content without unmounting it.
4. Opening Actions **MUST NOT** replace or close Workspace; they are adjacent columns.
5. Closed components **MUST** occupy zero width. Wrappers **MUST NOT** have a fixed `width`, `min-width`, or `flex-basis` that reserves space when closed.
6. Minimized components occupy exactly the rail width (see Appendix A).
7. The whole row **MUST** fill the viewport height below the host header; the composer stays pinned to the bottom of Chat.
8. Chat **MUST** live in the app shell, not inside a routed page.

### 3.3 Suggested layout structure (informative)

A practical shell structure:

```text
app-shell
  app-shell__body          (flex row, min-height: 0)
    existing sidebar + AI button
    workspace-root         (flex row, full remaining height)
      chat-slot            (wraps Chat Panel)
      stage                (flex, position: relative)
        routed-content     (scrolls independently)
        surface-layer      (absolutely positioned over stage)
          workspace-slot   (wraps Dynamic Workspace)
          actions-slot     (wraps Actions Pane)
```

---

## 4. Initial & Independent State Rules

### 4.1 Initial state

```
| Component | Initial `open` | Initial `minimized` / `maximized` |
| --------- | -------------- | --------------------------------- |
| Chat      | `false`        | n/a                               |
| Workspace | `false`        | `false` / `false`                 |
| Actions   | `false`        | `false` / `false`                 |
```

- Nothing opens on page load. Hosts **MUST NOT** set `open` in initial markup or in a startup hook.
- The host's single AI button in the sidebar is the only thing that opens Chat on first use.

### 4.2 Who opens what

```
| Trigger                                    | Chat    | Workspace                           | Actions                                        |
| ------------------------------------------ | ------- | ----------------------------------- | ---------------------------------------------- |
| Host AI button                             | toggles | no change                           | no change                                      |
| Form request (`acp-form-requested`)        | no change | opens (unless user closed it, Â§4.3) | opens if the request carries an activity item  |
| Actions request (`acp-actions-requested`)  | no change | no change                           | opens (unless `open === false`), appends item  |
| Workspace overflow â†’ **Open Actions**      | no change | no change                           | opens                                          |
| Workspace re-opens (`open` â†’ true)         | no change | â€”                                   | re-opens **only** if it already has items      |
```

### 4.3 Independence rules

1. Opening Chat **MUST NOT** open Workspace or Actions.
2. Closing any one component **MUST NOT** close, minimize, or resize another.
3. Actions stays open until the user minimizes or closes it.
4. **Explicit close is sticky for Workspace.** After the user closes Workspace, later form requests update its form spec but **MUST NOT** re-open it. Setting `open = true` from the host clears this sticky-closed flag.
5. All components **SHOULD** stay mounted while closed so they can still receive sibling events (or the host must re-dispatch events after remount).

---

## 5. Public API

Property names below are the canonical contract. Implementations **MAY** also
accept equivalent kebab-case attributes or framework-specific prop conventions.
Boolean properties follow normal presence/absence semantics where attributes are used.

### 5.1 Chat Panel

**Properties**

```
| Property            | Type                | Default                       | Description                                       |
| ------------------- | ------------------- | ----------------------------- | ------------------------------------------------- |
| `open`              | boolean             | `false`                       | Visible when true; zero width when false          |
| `title`             | string              | `"AI Agent"`                  | Header title                                      |
| `agentDisplay`      | string              | `""`                          | Agent name shown next to the title                |
| `pending`           | boolean             | `false`                       | Shows "Thinking..." indicator and Cancel control  |
| `placeholder`       | string              | `"How can I help you today?"` | Composer placeholder                              |
| `maxLength`         | number              | `2000`                        | Composer character limit                          |
| `width`             | number (px)         | `380`                         | Column width, clamped to `[minWidth, maxWidth]`   |
| `minWidth`          | number (px)         | `280`                         |                                                   |
| `maxWidth`          | number (px)         | `900`                         |                                                   |
| `messages`          | `ChatMessage[]`     | `[]`                          | Full message list (host-owned; replace to update) |
| `chatHistory`       | `ChatHistoryItem[]` | `[]`                          | Items for the history flyout                      |
| `formTriggerPrefix` | string              | `"/form"`                     | Command prefix for Â§8                             |
| `dock`              | `'left' \| 'right'` | `'left'`                      | Reserved for future layout variants               |
```

**Methods**

```
| Method              | Effect                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| `startNewChat()`    | Clears draft, search, flyouts; emits `acp-new-chat`. Host clears `messages`. |
| `toggleSearch()`    | Opens/closes search bar; closing clears the term                             |
| `clearSearch()`     | Clears the search term                                                       |
| `toggleHistory()`   | Opens/closes the history flyout (closes search)                              |
| `sendMessage(text)` | Sends `text` as if typed and submitted                                       |
```

**Header controls:** New chat, Search, History, Help, Close.

**Composer behavior:**
- Enter sends; Shift+Enter inserts a newline.
- Send is disabled while the draft is blank.
- Empty/whitespace messages are never sent.
- After send the draft clears.
- The component does **not** append the user's message to `messages`; the host does (Â§11).

**Search:** Case-insensitive match over message `text` and each block's relevant
text fields. Shows a live result count and a clear control.

**Empty state:** A ready prompt inviting the user to begin (exact copy is
implementation-defined; **SHOULD** be neutral and helpful).

### 5.2 Dynamic Workspace

**Properties**

```
| Property        | Type                  | Default          | Description                                                       |
| --------------- | --------------------- | ---------------- | ----------------------------------------------------------------- |
| `open`          | boolean               | `false`          | Visible when true **and** a valid `formSpec` exists               |
| `title`         | string                | `"Dynamic Form"` | Fallback header title (spec title wins)                           |
| `formSpec`      | `FormSpec \| null`    | `null`           | Normalized on set (Â§6.3). Resets field values to `initialValues`. |
| `formWidth`     | number (px)           | `540`            | Clamped to `[minFormWidth, maxFormWidth]`                         |
| `minFormWidth`  | number (px)           | `320`            |                                                                   |
| `maxFormWidth`  | number (px)           | `960`            | Also the maximized width                                          |
| `formHeight`    | number (px) \| `null` | `null`           | `null` = full column height                                       |
| `minFormHeight` | number (px)           | `240`            |                                                                   |
| `minimized`     | boolean               | `false`          | Rail mode                                                         |
| `maximized`     | boolean               | `false`          | Expanded to `maxFormWidth`                                        |
```

**Methods**

```
| Method       | Effect                                                 |
| ------------ | ------------------------------------------------------ |
| `collapse()` | Minimize to rail                                       |
| `maximize()` | Expand; emits `acp-workspace-maximize`                 |
| `restore()`  | Exit rail/maximize; emits `acp-restore-default-split`  |
| `close()`    | Close; emits `acp-open-change(false)` and `acp-cancelled` |
```

**Content rules:**
- When `formId` is `student-enroll` or `buddy-enrol`, the Workspace **MUST** present the Buddy enrollment surface (Â§5.4) instead of (or in addition to) a generic form.
- Any other valid spec â†’ generic form: title, optional description, one control per field, Close and Submit.
- On Submit: validation runs first; on success the component emits `acp-submitted`, then **MAY** emit `acp-actions-requested` with a success activity item.
- Number fields submit `number | null`; checkboxes submit `boolean`; everything else submits `string`.

**Header controls:** Overflow (Open Actions), Minimize, Maximize/Restore, Close.

### 5.3 Actions Pane

**Properties**

```
| Property      | Type                  | Default                  | Description                       |
| ------------- | --------------------- | ------------------------ | --------------------------------- |
| `open`        | boolean               | `false`                  |                                   |
| `title`       | string                | `"Actions"`              | Header title                      |
| `items`       | `ActivityItem[]`      | `[]`                     | Activity log (replace to update)  |
| `menuActions` | `ActivityAction[]`    | see Appendix A           | Overflow menu entries             |
| `width`       | number (px)           | `280`                    | Clamped to `[minWidth, maxWidth]` |
| `minWidth`    | number (px)           | `220`                    |                                   |
| `maxWidth`    | number (px)           | `720`                    | Also the maximized width          |
| `height`      | number (px) \| `null` | `null`                   | `null` = full column height       |
| `minHeight`   | number (px)           | `240`                    |                                   |
| `minimized`   | boolean               | `false`                  |                                   |
| `maximized`   | boolean               | `false`                  |                                   |
```

**Methods:** `collapse()`, `maximize()`, `restore()` (emits `acp-restore-default-split`),
`close()` (emits `acp-open-change(false)` and `acp-actions-close`).

**Behavior:**
- Incoming activity items are appended and de-duplicated by `id`.
- Requests the pane would dispatch to itself are ignored (no self-loop).
- Items render with a visual treatment by `kind`, the item `text`, and one control per `actions[]` entry.
- Empty state: a neutral â€œno actions yetâ€ message.
- A default menu action **MAY** provide â€œcopy all saved namesâ€ (or equivalent) behavior that collects success-item labels for the clipboard.

**Header controls:** Overflow, Minimize, Maximize/Restore, Close.

### 5.4 Buddy Enrollment Workspace (optional)

Rendered automatically by the Workspace for `student-enroll` / `buddy-enrol`
forms, or placed directly by the host.

**Properties**

```
| Property         | Type            | Description                                      |
| ---------------- | --------------- | ------------------------------------------------ |
| `records`        | `BuddyRecord[]` | Records shown in the chip strip                  |
| `activeRecordId` | string          | Record shown in the editable form                |
| `buddyText`      | string          | Raw text in the parser input                     |
| `parseInFlight`  | boolean         | Parse control shows in-flight state and is disabled |
| `checkInFlight`  | boolean         | Validate control shows in-flight state and is disabled |
```

**Required layout (top â†’ bottom):**
heading Â· raw text input + Parse Â· search + record chips (paginated) Â· editable
fields Â· Clear, Cancel, Validate, Submit, Submit All.

**Editable fields for the built-in enrollment form:** Name, Date of Birth, Gender,
Course, Email, Mobile, Father Name.

**Chip markers:** clear indication for submitted records and for `valid === false`.

**Behavior:**

```
| Control    | Effect                        | Event(s)                                                                 |
| ---------- | ----------------------------- | ------------------------------------------------------------------------ |
| Parse      | Sets `parseInFlight`          | `buddy-parse { text }`                                                   |
| Chip click | Sets `activeRecordId`         | â€”                                                                        |
| Search     | Filters records; resets page  | â€”                                                                        |
| Field edit | Updates the active record     | â€”                                                                        |
| Clear      | Clears active record          | `buddy-clear { recordId }`                                               |
| Cancel     | Closes parent Workspace       | `buddy-cancel`                                                           |
| Validate   | Sets `checkInFlight`          | `buddy-check { records }`                                                |
| Submit     | Marks active as saved         | `buddy-submit { recordId, record }` + activity request                   |
| Submit All | Marks all as saved            | `buddy-submit-all { records }` + activity request                        |
```

---

## 6. Data Contracts

TypeScript notation is used for precision. Implementations in other languages
**MUST** accept the same JSON shapes.

### 6.1 Chat messages

```ts
type ChatRole = 'user' | 'assistant' | 'system' | 'error';

interface ChatMessage {
  id: string;
  role: ChatRole;           // 'error' renders with error styling
  text?: string;            // used when blocks is empty / absent
  blocks?: ChatBlock[];     // rendered in order; takes precedence over text
  timestamp?: string | Date;
  agent?: { id?: string; name?: string } | null;
}

interface ChatHistoryItem {
  id: string;
  title: string;            // fallback title if blank is implementation-defined
  updatedAt: string | Date;
}
```

### 6.2 Message blocks

```
| `type`         | Required fields                 | Renders as                         | Interaction                                         |
| -------------- | ------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `text`         | `text`                          | Paragraph                          | â€”                                                   |
| `markdown`     | `markdown` (or `text`)          | Formatted text (see note)          | â€”                                                   |
| `status`       | `text`, `level?`                | Status line; loading may animate   | â€”                                                   |
| `data`         | `items: {key, value}[]`         | Key/value table                    | â€”                                                   |
| `suggestions`  | `suggestions: Suggestion[]`     | Chips                              | `acp-suggestion-click`, plus prompt/navigate (Â§7.1) |
| `link`         | `label`, `href` or `route`      | Button / link control              | `acp-link-click`                                    |
| `form`         | `title?`, `fields: FieldSpec[]` | Inline mini-form                   | Implementation-defined submit behavior              |
| `confirmation` | `text`                          | Text + Confirm / Cancel            | `acp-confirmation-action`                           |
| `error`        | `message`, `details?`           | Error treatment                    | â€”                                                   |
| *(unknown)*    | â€”                               | Falls back to plain text           | â€”                                                   |
```

**Markdown note:** Implementations **SHOULD** render `markdown` blocks as
Markdown when practical. Rendering as preformatted / plain text is acceptable
and is what the reference Custom Elements bundle does.

```ts
interface Suggestion {
  id: string;
  label: string;
  action: {
    id: string;
    label: string;
    payload?:
      | { type: 'internal.prompt'; prompt: string }   // sends prompt as a new message
      | { type: 'navigate'; href?: string; route?: string }
      | Record<string, unknown>;                      // host-defined
  };
}
```

All agent-supplied text **MUST** be treated as untrusted. Implementations
**MUST NOT** render agent-supplied strings as raw HTML.

### 6.3 Form spec

```ts
type FieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';

interface FieldSpec {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[] | string[];  // select only
  optionsSource?: string;                                   // opaque host hint
  validation?: { min?: number; max?: number; maxLength?: number };
}

interface FormSpec {
  formId: string;
  title: string;
  description?: string;
  submitLabel?: string;   // default "Submit"
  cancelLabel?: string;   // default "Close"
  initialValues?: Record<string, unknown>;
  fields: FieldSpec[];
}
```

**Normalization (MUST be applied on input):**

```
| Input                    | Result                                              |
| ------------------------ | --------------------------------------------------- |
| Unknown field `type`     | `text`                                              |
| Field `id`               | Stable id derived from given id / label / index     |
| Missing field `label`    | Derived from id                                     |
| `formId`                 | Stable id derived from given formId / title         |
| Missing `title`          | Derived from formId                                 |
| String options           | `{ label: s, value: s }`                            |
| Options with empty value | Dropped                                             |
| **No valid fields**      | **Spec rejected (`null`); Workspace does not open** |
```

### 6.4 Activity

```ts
interface ActivityAction {
  id: string;
  label: string;
  type?: string;
  payload?: Record<string, unknown>;
}

interface ActivityItem {
  id: string;                                    // de-duplication key
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
  recordId?: string;
  actions?: ActivityAction[];
}
```

### 6.5 Buddy record

```ts
interface BuddyRecord {
  id: string;
  name: string;
  dob?: string;          // ISO date, YYYY-MM-DD
  gender?: string;
  course?: string;
  email?: string;
  mobile?: string;
  fatherName?: string;
  valid?: boolean;       // false shows invalid marker
}
```

---

## 7. Event / Callback Contract

Events **MUST** be exposed with the names below (or equivalent `on`-prefixed
camelCase callbacks in component frameworks). Payloads **MUST** match the shapes
described. In a DOM implementation, events **SHOULD** bubble and be composed so
a common ancestor can listen.

### 7.1 Chat Panel emits

```
| Event                      | Detail                     | When                                             |
| -------------------------- | -------------------------- | ------------------------------------------------ |
| `acp-open-change`          | `boolean`                  | Open state changed (typically close)             |
| `acp-message-sent`         | `string`                   | User sends a message (trimmed)                   |
| `acp-form-requested`       | `{ formSpec }`             | Sent message matches the form trigger (Â§8)       |
| `acp-new-chat`             | â€”                          | New chat requested                               |
| `acp-search-toggle`        | `{ open, term }`           | Search opened/closed                             |
| `acp-history-toggle`       | `{ open }`                 | History flyout opened/closed                     |
| `acp-restore-conversation` | `{ conversationId, item }` | History item selected                            |
| `acp-help`                 | â€”                          | Help requested                                   |
| `acp-cancel-request`       | â€”                          | Cancel while `pending`                           |
| `acp-suggestion-click`     | `{ suggestion }`           | Any suggestion chip clicked (always first)       |
| `acp-navigate`             | `{ href }`                 | Chip with navigate payload                       |
| `acp-link-click`           | `{ href, label }`          | Link block clicked                               |
| `acp-confirmation-action`  | `{ confirmed: boolean }`   | Confirm / Cancel on a confirmation block         |
| `acp-width-change`         | `number`                   | Width changed by user                            |
```

A suggestion with `payload.type === 'internal.prompt'` **MUST** additionally
result in a message send (emitting `acp-message-sent`).

### 7.2 Workspace emits

```
| Event                       | Detail                 | When                                              |
| --------------------------- | ---------------------- | ------------------------------------------------- |
| `acp-open-change`           | `true` / `false`       | Opened by a form request / closed                 |
| `acp-submitted`             | `{ formId, values }`   | Valid generic form submitted                      |
| `acp-cancelled`             | â€”                      | Closed via close control or Buddy Cancel          |
| `acp-actions-requested`     | `{ open: true, item }` | After submit or forwarded activity from a request |
| `acp-open-actions`          | â€”                      | Overflow â†’ Open Actions                           |
| `acp-workspace-maximize`    | â€”                      | Maximized                                         |
| `acp-restore-default-split` | â€”                      | Restored from rail or maximize                    |
| `acp-form-width-change`     | `number`               | Width changed                                     |
| `acp-form-height-change`    | `number`               | Height changed (when height resizing is supported)|
```

### 7.3 Actions Pane emits

```
| Event                       | Detail               | When                         |
| --------------------------- | -------------------- | ---------------------------- |
| `acp-open-change`           | `true` / `false`     | Opened by a request / closed |
| `acp-actions-close`         | â€”                    | Closed                       |
| `acp-action-click`          | `{ item, actionId }` | Item action control          |
| `acp-menu-action-click`     | `{ actionId }`       | Overflow menu entry          |
| `acp-restore-default-split` | â€”                    | Restored                     |
| `acp-actions-width-change`  | `number`             | Width changed                |
| `acp-actions-height-change` | `number`             | Height changed (when supported) |
```

### 7.4 Buddy surface emits

- `buddy-parse { text }`
- `buddy-check { records }`
- `buddy-clear { recordId }`
- `buddy-cancel`
- `buddy-submit { recordId, record }`
- `buddy-submit-all { records }`
- plus `acp-actions-requested` on successful submit (see Â§5.4)

### 7.5 Events components may listen for

```
| Listener  | Event / detail                                              | Reaction                                                                 |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Workspace | `acp-form-requested` `{ formSpec, activityItem? }`           | Set spec; open unless sticky-closed; forward activity item if present    |
| Actions   | `acp-actions-requested` `{ open?, item? }`                   | Append item; open unless `open === false`                                |
| Actions   | `acp-open-actions`                                           | Open                                                                     |
| Actions   | Workspace `acp-open-change` with `true`                      | Re-open if it already has items                                          |
```

The host **MAY** dispatch any of these events / call the equivalent APIs itself
to drive the panes.

---

## 8. Form Trigger Behavior

When a sent message starts with the configured trigger prefix, Chat emits
`acp-form-requested` **in addition to** `acp-message-sent`.

1. Prefixes checked (case-insensitive, longest first): `formTriggerPrefix`, then
   common aliases such as `/forms` and `/form` if distinct.
2. An optional `:` after the prefix is ignored. An empty remainder does nothing.
3. The remainder is interpreted:

```
| Remainder                                | Resulting form                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Starts with `{`                          | Parsed as JSON `FormSpec` and normalized. Invalid JSON or no valid fields â†’ no event |
| Contains `enroll`, `enrol`, or `student` | Built-in Student Enrollment form (`formId: student-enroll`) â†’ Buddy surface         |
| Anything else                            | Generic form titled from the text, with Name (required) + Details (textarea)        |
```

**Built-in Student Enrollment fields** (when that form is produced):

| Field        | Type     | Required |
| ------------ | -------- | -------- |
| Name         | text     | yes      |
| Date of Birth| date     | yes      |
| Gender       | select   | yes (Male / Female / Other) |
| Course       | select   | yes (Science / Commerce / Arts) |
| Email        | text     | no       |
| Mobile       | text     | no       |
| Father Name  | text     | no       |

The trigger is a convenience for demos and power users. Production agents
**SHOULD** open forms by supplying a full `FormSpec` through the host (Â§12).

---

## 9. Resizing, Rails, Maximize/Restore

### 9.1 Resizing

```
| Component | Handle(s)           | Axis        | Keyboard (focused handle) | Limits                          | Event(s)                    |
| --------- | ------------------- | ----------- | ------------------------- | ------------------------------- | --------------------------- |
| Chat      | Trailing edge       | Width       | Arrow keys Â± step         | `minWidth`â€“`maxWidth`           | `acp-width-change`          |
| Workspace | Trailing edge       | Width       | Arrow keys Â± step         | `minFormWidth`â€“`maxFormWidth`   | `acp-form-width-change`     |
| Workspace | Bottom edge / corner| Height / both | Arrow keys Â± step       | `minFormHeight`â€“viewport limit  | `acp-form-height-change` (+ width if corner) |
| Actions   | Trailing edge       | Width       | Arrow keys Â± step         | `minWidth`â€“`maxWidth`           | `acp-actions-width-change`  |
| Actions   | Bottom edge / corner| Height / both | Arrow keys Â± step       | `minHeight`â€“viewport limit      | `acp-actions-height-change` (+ width if corner) |
```

**Rules:**
- Width resizing is **required**.
- Height and corner resizing **SHOULD** be supported; if not implemented, height stays full-column (`null`).
- Sizes are clamped on every update. Events fire only when the clamped value changes.
- A pane with no explicit height fills the full column. Once height-resized, it keeps that height until the host sets the height property back to `null`.
- Height handles are hidden while a pane is minimized or maximized.
- Each component resizes independently; resizing one never changes another's stored size.

### 9.2 Rails (minimize)

- Minimize collapses Workspace or Actions to a vertical rail of fixed width
  (see Appendix A) showing a vertical label and a close control.
- Activating the rail (except the close control) restores the pane.
- The freed width is reclaimed immediately; no empty column remains.

### 9.3 Maximize / Restore

- Maximize expands the pane to its max width and full column height. The adjacent pane stays open.
- Restore returns to the stored width/height and emits `acp-restore-default-split`.
- Maximize and minimize are mutually exclusive.

---

## 10. Styling & Theming Contract

### 10.1 Rules

1. All colors, radii, shadows, and shell geometry **MUST** come from `--acp-*`
   CSS custom properties (or an equivalent theming mechanism that maps to the same roles).
2. Pane, header, bubble, and input backgrounds **MUST** be opaque. Routed content
   must never show through a pane.
3. Hosts theme by overriding tokens, ideally mapping to their own design tokens.
4. Hosts **SHOULD NOT** depend on internal class names for styling. Token-based
   overrides are the supported extension point across versions.

### 10.2 Token groups

```
| Group           | Roles (token names are conventional)                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Surfaces        | surface, panel, header, stage, user bubble, agent bubble, input, rail, rail hover                    |
| Text            | primary, secondary, muted, on-primary, font family                                                   |
| Borders & radii | border color; small / medium / large / pill radii                                                    |
| Accent & focus  | primary, primary hover, primary light, focus ring                                                    |
| Status          | success / warning / error / info foreground and background                                           |
| Elevation       | small / medium / large shadow                                                                        |
| Geometry        | app header height, pane header height, rail width                                                    |
```

Exact token names **SHOULD** use the `--acp-*` prefix for interoperability with
the reference stylesheets.

### 10.3 Responsive

At narrow viewports (approximately â‰¤ 900px) the surface layer **SHOULD** adapt
so Workspace and Actions remain usable (for example by allowing horizontal scroll
or constrained default widths). Exact breakpoints are implementation-defined.

---

## 11. Host Responsibilities & Data Flow

### 11.1 The host MUST

1. Render a shell that satisfies Â§3 and apply theming per Â§10.
2. Provide exactly **one** AI toggle control, at the bottom of its existing sidebar
   (create a sidebar only if none exists). Do not place the only launch control in a top bar.
3. Own and synchronize the `open` state of each component from open-change events.
4. Own the message list: on `acp-message-sent`, append the user message, set
   `pending = true`, call the backend, append the reply, set `pending = false`.
5. Handle `acp-cancel-request` by aborting the in-flight call and clearing `pending`.
6. Perform navigation for `acp-navigate` / `acp-link-click`.
7. Persist submissions from `acp-submitted` and `buddy-*` events with host/server authority.
8. Optionally persist sizes from width/height-change events.
9. Prefer keeping components mounted and controlling visibility through `open`.

### 11.2 The host MUST NOT

- Open any component on page load.
- Open Workspace or Actions as a side effect of opening Chat.
- Wrap the panes in modal dialogs, drawers, or floating overlays that break the docked layout.
- Render agent-supplied HTML inside the components.

### 11.3 Typical turn (informative)

```text
User types message â†’ Chat emits acp-message-sent
Host appends user message, sets pending, calls backend
Backend returns assistant message Â± formSpec Â± activityItems
Host appends assistant message, clears pending
Host drives Workspace / Actions from formSpec / activityItems
User submits form â†’ Workspace emits acp-submitted
Host validates with backend and updates activity as needed
```

---

## 12. Backend & Agentic AI Mapping (recommended)

The UI is transport-agnostic. The following mapping is recommended so any agent
backend can drive the surface with plain JSON.

### 12.1 Suggested agent response envelope

```ts
interface AgentTurnResponse {
  message: ChatMessage;              // role 'assistant'; blocks preferred
  formSpec?: FormSpec;               // â†’ open / update Workspace
  activityItems?: ActivityItem[];    // â†’ append to Actions
  navigate?: { href: string };       // optional; prefer suggestion chips
  conversationId: string;
}
```

### 12.2 Mapping table

```
| Agent concept                | UI contract                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Plain answer                 | `ChatMessage` with `text` or a `text` / `markdown` block                     |
| Tool call in progress        | `pending = true`, or a `status` block with loading level                     |
| Tool result / record summary | `data` block                                                                 |
| Follow-up options            | `suggestions` block with `internal.prompt` payloads                          |
| Deep link into the app       | `suggestions` with navigate payload, or a `link` block                       |
| Needs structured input       | `formSpec` â†’ Workspace                                                       |
| Needs yes/no before acting   | `confirmation` block â†’ `acp-confirmation-action`                             |
| Committed side effect        | `ActivityItem` (`success`) â†’ Actions                                         |
| Partial failure              | `ActivityItem` (`warning`/`error`) and/or `error` block                      |
| Bulk record extraction       | Buddy: `buddy-parse` â†’ backend â†’ set `records`                               |
| Record validation            | Buddy: `buddy-check` â†’ backend â†’ set `valid` on records                      |
| Conversation list            | `chatHistory` from a history endpoint; restore on `acp-restore-conversation` |
| User abort                   | `acp-cancel-request` â†’ abort request / cancel agent run                      |
```

### 12.3 Agent guidance

- Send **context** with each turn: current route, whether Workspace is open,
  active `formId`, active Buddy record id, so the agent can refine an open form.
- Validate all agent output against Â§6 before handing it to the UI. Drop specs
  that normalize to `null`.
- Treat every agent string as untrusted text. Never inject it as HTML.
- Keep consequential side effects behind a confirmation block or an explicit form Submit.
- Treat UI-emitted form success activity as **intent**, not authoritative success;
  confirm writes with the backend before presenting final success to the user.

---

## 13. Acceptance Checklist

**Layout**
- [ ] Order is `sidebar | chat | workspace | actions | routed content`.
- [ ] Chat fills full height; composer pinned to bottom at any message count.
- [ ] Workspace and Actions render above routed content without unmounting it.
- [ ] Closed components leave no residual column.

**Initial & independent state**
- [ ] On load, Chat, Workspace, and Actions are all closed.
- [ ] Exactly one AI launch control at the bottom of the host sidebar; it toggles Chat.
- [ ] Opening Chat opens nothing else.
- [ ] Closing any component leaves the others unchanged.
- [ ] After the user closes Workspace, a new form request does not re-open it.

**Chat**
- [ ] Enter sends, Shift+Enter adds a newline, blank messages are not sent.
- [ ] `pending` shows an in-flight indicator and Cancel; Cancel emits `acp-cancel-request`.
- [ ] Search filters messages and shows a result count.
- [ ] History flyout lists items and emits `acp-restore-conversation`.
- [ ] Every block type in Â§6.2 renders; chips send prompts or request navigation.

**Workspace & forms**
- [ ] A valid form request opens Workspace beside Chat.
- [ ] A spec with no valid fields does not open Workspace.
- [ ] Required fields block submit; valid submit emits `acp-submitted` with typed values.
- [ ] Enrollment form IDs open the Buddy surface with the required controls.

**Actions**
- [ ] Activity items open Actions beside Workspace without closing it.
- [ ] Duplicate item ids are not added twice.
- [ ] Item and menu controls emit the corresponding action events.

**Window management**
- [ ] Minimize â†’ rail; rail activation â†’ restore; freed width reclaimed at once.
- [ ] Maximize keeps the adjacent pane open; restore returns to stored sizes.
- [ ] Width resizing works for Chat, Workspace, and Actions within limits and emits events.
- [ ] Height resizing (if implemented) works within limits and emits events.

**Styling & safety**
- [ ] Visual design is driven by theme tokens; surfaces are opaque.
- [ ] Overriding tokens re-themes the components.
- [ ] Agent-supplied markup in any string renders as text, never as HTML.

---

## 14. Appendix A: Default Values

```
| Token / property              | Default        |
| ----------------------------- | -------------- |
| Chat `width` / `minWidth` / `maxWidth` | 380 / 280 / 900 |
| Workspace `formWidth` / min / max      | 540 / 320 / 960 |
| Actions `width` / min / max            | 280 / 220 / 720 |
| `minFormHeight` / `minHeight`          | 240            |
| Rail width                             | 52px           |
| Pane header height                     | 44px           |
| Composer `maxLength`                   | 2000           |
| Form trigger prefix                    | `/form`        |
| Default Actions menu action            | `{ id: 'copy_all_names', label: 'Copy all saved names' }` |
| Keyboard resize step                   | ~24px          |
```

---

## 15. Appendix B: Conformance for Native Implementations

A React, Vue, Svelte, or other native implementation **conforms** to this
specification if and only if it:

1. Exposes the properties in Â§5 with the same names, types, defaults, and clamping semantics.
2. Emits the events / callbacks in Â§7 with the same names (or conventional `on`-prefixed equivalents) and payloads.
3. Accepts and normalizes the data contracts in Â§6.
4. Satisfies every normative rule in Â§3, Â§4, Â§8, Â§9, and Â§10.
5. Passes the acceptance checklist in Â§13.

Component display names and internal DOM structure are not constrained.
Tag names used by a Custom Elements reference are conventional only.

---

## 16. Appendix C: Illustrative Host Patterns (Custom Elements reference)

These sketches show how a host might consume a Custom Elements reference
implementation. They are **not** part of the normative contract.

### C.1 Plain HTML / JavaScript (sketch)

```html
<!-- load tokens + styles, then the module that registers the elements -->
<div class="app-shell__body">
  <nav class="app-sidebar">
    <!-- host items -->
    <button type="button" class="app-sidebar__ai">AI Agent</button>
  </nav>
  <div class="acp-workspace">
    <div class="acp-workspace__chat"><acp-chat-panel></acp-chat-panel></div>
    <section class="acp-workspace__stage">
      <main class="acp-workspace__content"><!-- routed page --></main>
      <div class="acp-workspace__surface-layer">
        <div class="acp-workspace__surface"><acp-dynamic-container></acp-dynamic-container></div>
        <div class="acp-workspace__actions"><acp-actions-pane></acp-actions-pane></div>
      </div>
    </section>
  </div>
</div>
```

Host logic: toggle `chat.open` from the sidebar button; listen for
`acp-message-sent`, manage `messages` / `pending`, call the backend, and
dispatch form / activity events into the workspace root as needed.

### C.2 React (ref-based, React 18-compatible sketch)

```tsx
function AcpChat({ open, messages, pending, onOpenChange, onSend }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.open = open;
    el.messages = messages;
    el.pending = pending;
  }, [open, messages, pending]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onOpen = (e) => onOpenChange(e.detail);
    const onMsg  = (e) => onSend(e.detail);
    el.addEventListener('acp-open-change', onOpen);
    el.addEventListener('acp-message-sent', onMsg);
    return () => {
      el.removeEventListener('acp-open-change', onOpen);
      el.removeEventListener('acp-message-sent', onMsg);
    };
  }, [onOpenChange, onSend]);

  return <acp-chat-panel ref={ref} />;
}
```

### C.3 Angular (schema + property/event binding sketch)

Allow custom elements via `CUSTOM_ELEMENTS_SCHEMA` (or the equivalent standalone
schema). Bind properties and listen to the custom events listed in Â§7.

### C.4 Vue 3 (sketch)

Configure the compiler to treat `acp-*` / `buddy-*` tags as custom elements.
Bind with `.prop` for objects/arrays and listen with `@acp-â€¦`.

---

## 17. Appendix D: Reference Implementation Notes

Informative only. Describes one existing Custom Elements bundle; not required
for conformance.

- Package name historically used: `@acp/chat-panel`.
- Entry module registers the four custom elements on import.
- Styles ship as token + component stylesheets using `--acp-*` variables.
- Markdown blocks are rendered as preformatted text (not parsed as Markdown).
- Actions â€œStatusâ€ tab may currently mirror the Activity list.
- Buddy surface may ship with demo records and short auto-reset timers for
  in-flight flags; production hosts should drive `parseInFlight` / `checkInFlight`
  from real async work.
- Some internal refresh paths may depend on subsequent user interaction rather
  than deep property observation; hosts that need immediate re-render should
  prefer replacing array/object references.
- Height and corner resizing were introduced in the 0.2.2 line of the reference
  bundle; width resizing has always been part of the core contract.

When this specification and a particular implementation differ on a normative
requirement, **this document wins** for new work. When they differ only on an
informative note, the implementation may document its deviation.
