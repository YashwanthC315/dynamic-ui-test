# ACP Dynamic Container & Dynamic Forms — Implementation Plan (Revised)

## 1. Goal

Extend the existing `@acp/chat-panel` package with a **Dynamic Container** capable of rendering agent-driven forms from a structured `FormSpec`.

The package owns the UI and deterministic form rendering. The host application owns business logic, APIs, option sources, and submission handling.

**Revision note:** The Dynamic Container is no longer an independently positioned surface. It is anchored to the Chat Panel's right edge and fills the remaining horizontal space. There is a single horizontal split (Chat ↔ Container), and the form inside the container has its own, separate resize behavior.

## 2. Architecture

```text
User Request
    |
  Agent
    |
 Tool Layer
    | FormSpec
    v
ACP Dynamic Container
    |
ACP Form Renderer
    +--> text
    +--> number
    +--> date
    +--> checkbox
    +--> select
    +--> textarea
    |
Host Application
    +--> Submit Handler
    +--> Options Registry
    +--> Backend/API
```

The Dynamic Container is a **sibling UI surface to the chat**, not a child of the chat component — anchored to it visually (see Section 3), but never nested in its component tree, even though it is triggered by chat input (see Section 5A, "Chat → Container Wiring").

## 3. Workspace Layout (Revised)

Single horizontal split. The Chat Panel has a resizable width; the Dynamic Container fills whatever remains.

```text
┌────────────────────────────────────────────────────────────────────┐
│                          ACP Workspace                             │
│  ┌──────────────────┐┌───────────────────────────────────────────┐ │
│  │                  ││                                           │ │
│  │       CHAT       ││            DYNAMIC CONTAINER              │ │
│  │    width = W     ││          width = available - W            │ │
│  │                  ││       ┌──────────────────────┐            │ │
│  │                  ││       │     Dynamic Form      │           │ │
│  │                  ││       └──────────────────────┘            │ │
│  └──────────────────┘└───────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                     ▲
                     │
              shared resize boundary (Chat ↔ Container)
```

When there is no Dynamic Container open, the Host Application Content occupies that space instead:

```text
┌──────────────┬───────────────────────────────────────────────┐
│     CHAT     │              HOST APPLICATION                 │
└──────────────┴───────────────────────────────────────────────┘
```

Conceptual CSS:

```css
.acp-workspace {
  display: flex;
}

.acp-chat {
  width: var(--acp-chat-width);
  flex: 0 0 var(--acp-chat-width);
}

.acp-dynamic-container {
  flex: 1 1 auto;
}
```

Requirements:

- Chat and Dynamic Container participate in the application layout via a flex (or equivalent) split — no overlay for either surface.
- The Dynamic Container is **not** independently positionable horizontally. Its left edge is always the Chat Panel's right edge.
- Dragging the Chat ↔ Container boundary resizes the Chat Panel; the Container's width is derived (`available - W`), not set directly.
- Resizing the workspace boundary causes application content to resize when the Container is closed and Host Application Content occupies that space.
- Layout must work across application routes.
- The Dynamic Container may visually cover/replace the host page area, but must remain anchored to the workspace/Chat Panel, never positioned relative to the browser viewport independently.

### Two distinct resize concepts

**Resize 1 — Chat ↔ Container** (workspace-level, changes available Container width)

```text
CHAT                         CONTAINER
◄────────►│◄────────────────────────────►
          ▲
       resize
```

**Resize 2 — Form ↔ Container** (container-level, changes the form's own width within the container it's given)

```text
┌────────────────────────────────────────────┐
│ Dynamic Container                          │
│    ┌─────────────────────┐                 │
│    │        FORM          │                │
│    └─────────────────────┘                 │
│                      ▲                     │
│                  form resize               │
└────────────────────────────────────────────┘
```

The form can remain a compact "application replacement" while the Container provides the full available workspace around it.

## 4. Revised Component Hierarchy

```text
AcpWorkspace
│
├── AcpChatPanel
│
├── AcpDynamicContainer
│   │
│   └── AcpDynamicForm
│       │
│       ├── AcpTextControl
│       ├── AcpNumberControl
│       ├── AcpDateControl
│       ├── AcpCheckboxControl
│       ├── AcpSelectControl
│       └── AcpTextareaControl
│
└── Host Application Content
```

- `AcpWorkspace` owns the Chat ↔ Container relationship (Resize 1).
- `AcpDynamicContainer` owns the Container ↔ Form relationship (Resize 2).
- `Host Application Content` and `AcpDynamicContainer` are mutually exclusive occupants of the same workspace region — Host Application Content shows when no form is open; the Dynamic Container shows when one is.
- `AcpChatPanel` and `AcpDynamicContainer` remain siblings under `AcpWorkspace` even though opening the Container is triggered by chat input — they communicate only via the `(formRequested)` event, never via direct component nesting or references (see Section 5A).

## 5. Open/Close Behavior

No form open:

```text
┌──────────────┬───────────────────────────────────────────────┐
│     CHAT     │              HOST APPLICATION                 │
└──────────────┴───────────────────────────────────────────────┘
```

Form opened:

```text
┌──────────────┬───────────────────────────────────────────────┐
│     CHAT     │          DYNAMIC CONTAINER                    │
│              │       ┌────────────────────────┐              │
│              │       │       Add Org           │             │
│              │       │       Form              │             │
│              │       └────────────────────────┘              │
└──────────────┴───────────────────────────────────────────────┘
```

Closed again:

```text
┌──────────────┬───────────────────────────────────────────────┐
│     CHAT     │              HOST APPLICATION                 │
└──────────────┴───────────────────────────────────────────────┘
```

Opening a new form creates a new `AcpDynamicForm` instance from the new `FormSpec` — the previous form instance is torn down, not reused/mutated in place.

## 5A. Chat → Container Wiring

The trigger for opening the Dynamic Container originates from chat input, but **ChatPanel must never import, render, or hold a direct reference to DynamicContainer.** The two stay sibling, independently testable components. The connection is made with an event, not nesting.

```text
User types in Chat
      |
ChatPanel sends message to Agent
      |
Agent's Tool Layer decides a form is needed -> builds FormSpec
      |
ChatPanel receives this as part of the agent response
      |
ChatPanel emits (formRequested) — it does NOT render a form itself
      |
      v
A listener forwards { formSpec, open: true } to <acp-dynamic-container>
```

`AcpChatPanel` public output:

```typescript
interface AcpFormRequestedEvent {
  formSpec: AcpFormSpec;
}

// (formRequested)="onFormRequested($event)"
```

ChatPanel's only responsibility here is detecting the tool-layer output in the agent response and emitting it. It does not know DynamicContainer exists.

There are two valid places to put the listener that forwards this event to the Container's `[formSpec]` / `[open]` inputs:

**Option A — Workspace owns the wiring (recommended default).**
If `AcpWorkspace` wraps both `AcpChatPanel` and `AcpDynamicContainer` as siblings, the Workspace listens for `(formRequested)` internally and forwards it to the Container. The host mounts `<acp-workspace>` and writes zero glue code. This keeps the package self-contained and matches "package owns UI, host owns business logic."

```html
<!-- inside AcpWorkspace's own template -->
<acp-chat-panel (formRequested)="openForm($event)"></acp-chat-panel>
<acp-dynamic-container [formSpec]="activeFormSpec" [open]="containerOpen"
  (submitted)="onSubmitted($event)" (cancelled)="onCancelled($event)">
</acp-dynamic-container>
```

**Option B — Host UI owns the wiring.**
If the host doesn't use `AcpWorkspace` and instead composes `AcpChatPanel` and `AcpDynamicContainer` directly into its own layout, the host component listens for `(formRequested)` and sets `[formSpec]` / `[open]` on the Container itself.

```html
<!-- inside the host's own layout component -->
<acp-chat-panel (formRequested)="onFormRequested($event)"></acp-chat-panel>
<acp-dynamic-container [formSpec]="formSpec" [open]="open" ...></acp-dynamic-container>
```

Either way, the contract is identical: an output event, never a direct method call via template ref/ViewChild into DynamicContainer from ChatPanel, and never DynamicContainer instantiated as a child of ChatPanel. This is what preserves the Core Principle in Section 18 — testing the Container against static `FormSpec` JSON without the chat/agent pipeline connected at all.

## 6. FormSpec Contract

The agent/tool layer produces plain data, never HTML or executable code.

```json
{
  "formId": "create-student",
  "title": "Create Student",
  "submitLabel": "Create",
  "fields": [
    { "id": "name", "label": "Student Name", "type": "text", "required": true },
    { "id": "age", "label": "Age", "type": "number", "required": true },
    { "id": "joiningDate", "label": "Joining Date", "type": "date" },
    { "id": "department", "label": "Department", "type": "select", "optionsSource": "departments" }
  ]
}
```

Suggested TypeScript contract:

```typescript
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
  type: AcpFieldType;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  optionsSource?: string;
  validation?: {
    min?: number;
    max?: number;
    maxLength?: number;
  };
}

type AcpFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'textarea';
```

## 7. Form Rendering

Use a fixed, engineer-owned control registry.

```text
FormSpec.fields
      |
AcpFormRenderer
      |
      +--> text      -> TextControl
      +--> number    -> NumberControl
      +--> date      -> DateControl
      +--> checkbox  -> CheckboxControl
      +--> select    -> SelectControl
      +--> textarea  -> TextareaControl
```

The agent selects the field type. It does not control HTML, styling, validation implementation, or data access.

## 8. Dynamic Container API

```html
<acp-chat-panel
  (formRequested)="onFormRequested($event)">
</acp-chat-panel>

<acp-dynamic-container
  [formSpec]="formSpec"
  [open]="dynamicFormOpen"
  (submitted)="onFormSubmitted($event)"
  (cancelled)="onFormCancelled($event)">
</acp-dynamic-container>
```

Note: the Container no longer accepts positioning inputs (e.g. no `x`/`left`/`width` props) — its position is fully derived from the workspace split. The only sizing input it should expose is the Form ↔ Container width (Resize 2), if the host wants to control or persist it.

Note: `AcpChatPanel` has no input or reference pointing at `AcpDynamicContainer`. The `(formRequested)` output is its only contribution to opening a form — see Section 5A for who listens to it and forwards to the Container.

Submission event:

```typescript
{
  formId: 'create-student',
  values: {
    name: 'John',
    age: 20,
    joiningDate: '2026-09-07',
    department: 'science'
  }
}
```

The package emits the data. The host decides what to do with it.

## 9. Form Lifecycle

```text
CLOSED
   |
  OPEN
   |
  DIRTY
   |
SUBMITTING
   |
   +---- success ----> SUBMITTED / READ_ONLY
   |
   +---- error ------> DIRTY
```

After successful submission, the form should become read-only or close.

## 10. Options Registry

Select fields reference registered keys rather than API calls or arbitrary code.

```json
{ "type": "select", "optionsSource": "departments" }
```

The host provides the corresponding options through an Options Registry. The agent must not provide URLs, JavaScript, or API logic for option sources.

## 11. Validation

Validation is deterministic and package-owned.

```json
{
  "id": "studentName",
  "label": "Student Name",
  "type": "text",
  "required": true,
  "validation": { "maxLength": 100 }
}
```

Declarative constraints are translated into form validation rules.

## 12. Theme / Design Tokens

Suggested classes:

```text
acp-workspace
acp-chat
acp-container
acp-container-header
acp-form
acp-form-title
acp-form-field
acp-form-label
acp-form-control
acp-form-error
acp-form-actions
acp-button
```

Suggested CSS custom properties:

```css
--acp-chat-width
--acp-container-bg
--acp-container-border
--acp-form-label-color
--acp-form-input-bg
--acp-form-input-border
--acp-button-bg
--acp-button-color
--acp-error-color
```

The package provides defaults. The host application overrides them through its theme.

## 13. Suggested Package Structure

```text
@acp/chat-panel
|
+-- dist/
|   +-- acp-chat-panel.js
|   +-- acp-chat-panel.d.ts
|
+-- styles/
|   +-- acp-chat-panel.css
|   +-- acp-form.css
|   +-- acp-container.css
|   +-- acp-workspace.css
|   +-- acp-default-theme.css
|
+-- src/
|   +-- workspace/       (Resize 1: Chat <-> Container split)
|   +-- chat/
|   +-- container/       (Resize 2: Container <-> Form)
|   +-- forms/
|   +-- controls/
|   +-- contracts/
|
+-- docs/
|   +-- THEME_CONTRACT.md
|   +-- FORM_SPEC.md
|   +-- ARCHITECTURE.md
|
+-- AGENT_GUIDE.md
+-- README.md
+-- package.json
```

## 14. Agent Integration Rules

The integration agent must:

1. Integrate the ACP workspace into the application's existing layout as a single flex/grid split: Chat | Container-or-Host-Content.
2. Place the chat launcher in the application's sidebar.
3. Open the chat beside the application content.
4. Add the Dynamic Container as a real layout surface anchored to the Chat Panel's right edge — never independently positioned.
5. Never implement chat or Dynamic Container as an overlay.
6. Implement the Chat ↔ Container resize boundary so that dragging it changes Chat width and derives Container width as the remainder.
7. Implement the Container ↔ Form resize independently of the Chat ↔ Container resize.
8. Ensure Host Application Content and the Dynamic Container occupy the same workspace region, toggling on open/close.
9. Connect the Dynamic Container to the application's `FormSpec` source.
10. Wire ChatPanel's `(formRequested)` output to the Dynamic Container's `[formSpec]`/`[open]` inputs via a listener (Workspace or host component per Section 5A) — never by nesting DynamicContainer inside ChatPanel or holding a direct component reference between them.
11. Register application-specific option sources.
12. Register form submission handlers.
13. Apply the host application's ACP theme tokens.
14. Keep application-specific API/business logic outside the ACP package.
15. Never modify the package's control registry for application-specific forms.

## 15. Responsibility Boundaries

| Layer | Responsibility |
|---|---|
| Agent | Decides required fields and field types |
| Tool Layer | Validates and builds `FormSpec` |
| FormSpec | Declarative form definition |
| ACP Chat Panel | Detects tool-layer form output; emits `(formRequested)`; never renders or references the Container |
| ACP Workspace | Owns Chat ↔ Container split and resize; listens for `(formRequested)` and forwards it (Option A) |
| ACP Form Engine | Validates and renders forms |
| ACP Dynamic Container | Provides layout/UI surface; owns Container ↔ Form resize |
| Control Registry | Maps field types to controls |
| Host Options Registry | Provides dynamic select options |
| Host Submit Handler | Handles submitted values |
| Host Backend | Performs business operations |
| ACP Theme | Provides default visual styling |
| Host Theme | Overrides design tokens |

## 16. What This Needs to Function

**Package-side (built once, reused by any host):**
- A flex/grid-based `AcpWorkspace` layout primitive with two children: Chat and (Container | Host Content).
- A drag-resize handle component for Resize 1 (Chat ↔ Container), writing to a CSS custom property (`--acp-chat-width`) or equivalent state, with min/max clamping.
- A separate drag-resize handle (or fixed compact width) for Resize 2 (Container ↔ Form), scoped inside the Container so it never affects Chat width.
- `AcpFormRenderer` + the six control components (text, number, date, checkbox, select, textarea).
- Deterministic validation engine driven by `AcpFieldSpec.validation`.
- Form lifecycle state machine (CLOSED → OPEN → DIRTY → SUBMITTING → SUBMITTED/READ_ONLY, with error → DIRTY).
- Default `acp-*` theme stylesheet plus documented CSS custom properties.
- Public API surface: `formSpec`, `open` inputs; `submitted`, `cancelled` outputs; an Options Registry interface; no positioning inputs.
- `AcpChatPanel` must expose a `(formRequested)` output carrying `{ formSpec: AcpFormSpec }` whenever the agent response contains a tool-layer form request — with no import of, or reference to, `AcpDynamicContainer` anywhere in ChatPanel's code.
- If shipping `AcpWorkspace` as the recommended integration path, it must contain the internal listener that forwards `(formRequested)` to the Container's `[formSpec]`/`[open]` inputs (Option A), so hosts using Workspace need zero glue code.

**Host-side (per application):**
- A place in the existing layout to mount `AcpWorkspace` (sidebar chat launcher + a workspace region that can host Host Application Content or the Dynamic Container interchangeably).
- Routing-agnostic mounting so the workspace persists/works across routes.
- An Options Registry implementation mapping `optionsSource` keys (e.g. `"departments"`) to real data.
- A Submit Handler wired to `submitted` that performs the actual API/business operation and reports success/error back for lifecycle transitions.
- A Cancel Handler wired to `cancelled`.
- A `FormSpec` source: the tool layer that turns validated agent tool calls into `AcpFormSpec` JSON.
- Host theme overrides for the exposed CSS custom properties (colors, chat width default, etc.).
- **Only if not using `AcpWorkspace`** (Option B): a host-owned listener for ChatPanel's `(formRequested)` that sets `[formSpec]`/`[open]` on a directly-mounted `<acp-dynamic-container>`.

**Agent/tool-side:**
- Tool definitions constrained to emitting only the six supported field types and declarative validation (`min`/`max`/`maxLength`) — no HTML, scripts, or URLs.
- A tool-layer validation step that rejects malformed `FormSpec` output before it ever reaches the Container.

## 17. Implementation Order

### Phase 1 — Workspace
- Add `AcpWorkspace` with the single flex split (`.acp-chat` fixed/resizable, `.acp-dynamic-container` / Host Content `flex: 1 1 auto`).
- Implement the Chat ↔ Container resize boundary (Resize 1).
- Verify Container width is always derived, never independently set.
- Verify no overlay behavior; verify anchoring holds across routes.

### Phase 2 — Form Contract
- Define `AcpFormSpec`.
- Define `AcpFieldSpec`.
- Define supported field types.
- Define lifecycle states.

### Phase 3 — Renderer
- Implement control registry.
- Implement text, number, date, checkbox, select, and textarea controls.
- Add deterministic validation.
- Implement the Container ↔ Form resize (Resize 2), independent of Resize 1.

### Phase 4 — Host Integration
- Add submit/cancel events.
- Add options registry.
- Add initial values.
- Add success/error handling.
- Wire Host Application Content to show/hide opposite the Dynamic Container.
- Implement ChatPanel's `(formRequested)` output.
- Implement the forwarding listener (in `AcpWorkspace` for Option A, or in the host's layout component for Option B) that connects `(formRequested)` to the Container's `[formSpec]`/`[open]` inputs.
- Verify ChatPanel has zero import/reference to DynamicContainer at build time.

### Phase 5 — Theme
- Add `acp-*` classes, including `acp-workspace` and `acp-chat`.
- Add CSS custom properties, including `--acp-chat-width`.
- Add default theme.
- Document host theme overrides.

### Phase 6 — Agent Integration
- Define form-building tools.
- Convert validated tool calls into `FormSpec`.
- Connect the resulting `FormSpec` to the Dynamic Container.

## 18. Core Principle

Build and test the workspace layout and Dynamic Container using static `FormSpec` JSON **before connecting the agent**.

The final boundary should remain:

```text
Agent
  |
Tool Layer
  |
FormSpec
  |
ACP Dynamic Container  (anchored to Chat Panel, fills remaining width)
  |
ACP Form Renderer      (independently resizable within the Container)
  |
Host Submit Handler
  |
Application API
```

This keeps the package reusable, deterministic, and independent of application-specific business logic — while guaranteeing the Container's left edge always follows the Chat Panel's right edge, including during resize.