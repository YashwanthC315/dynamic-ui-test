# Dynamic, Agent-Driven Form Generation — Design Plan

## 1. Problem Statement

Today, forms like **"Add Organization"** are hardcoded Angular components: fields, validators, dropdown sources, and submit logic are all baked into the component. Every new entity (Fee, Student, Event, etc.) requires a brand-new component.

We want:

1. A **single, generic `DynamicFormComponent`** that can render *any* form (textboxes, dropdowns, dates, checkboxes...) from a **schema**, not from hardcoded markup.
2. An **AI Agent** (the CT-Bot Assistant seen in the screenshot) that, given a user intent like *"add organization"*, decides **what fields the form needs** — e.g. "Name → textbox", "Parent → dropdown".
3. The Agent **never** generates HTML/Angular code and **never** talks to APIs. It only calls a small, fixed set of **deterministic tools** that describe form structure. The UI is responsible for turning that structure into real controls, and a separate, API-aware layer is responsible for submission.

This keeps the LLM in a narrow, auditable role (decide *what*), while all rendering and networking stays deterministic, testable, and secure (decide *how*).

---

## 2. Design Principles

- **LLM proposes, deterministic code disposes.** The agent can only call whitelisted tool functions with a strictly validated schema (JSON Schema / Zod). It cannot emit arbitrary markup, bindings, or JS.
- **Separation of concerns (3 layers, strictly one-directional):**
  1. **Agent Layer** — decides form structure (tool calls only).
  2. **Rendering Layer** — `DynamicFormComponent` + `FormFieldRegistry` (deterministic, no API knowledge).
  3. **Integration Layer** — host feature component / submit-handler that *is* API-aware and wires the generic form to a real endpoint.
- **The dynamic form is a dumb, reusable renderer.** It knows nothing about "Organization" or `/api/organizations`. It only knows "here is a list of fields, render them, emit the values on submit."
- **No dynamic code execution.** Everything the agent can do is enumerable and reviewable — this is what "deterministic tools" means: fixed functions with fixed argument shapes, not code-gen.

---

## 3. High-Level Architecture

```
 User chat message
        │
        ▼
 ┌──────────────────┐
 │   AI Agent (LLM)  │   decides intent + field composition
 │  "add organization"│  via TOOL CALLS ONLY
 └────────┬──────────┘
          │ tool calls (structured, validated)
          ▼
 ┌───────────────────────────┐
 │  Agent Tool Handler (TS)   │  deterministic — executes each tool call,
 │  runs in Angular service   │  builds a FormSpec object, validates it
 └────────┬───────────────────┘
          │ FormSpec (typed, validated JSON)
          ▼
 ┌───────────────────────────┐
 │  DynamicFormComponent      │  deterministic renderer.
 │  + FormFieldRegistry       │  maps field.type -> Angular control/component
 │  (NOT API aware)           │
 └────────┬───────────────────┘
          │ (submit) FormGroup.value + FormSpec.formId
          ▼
 ┌───────────────────────────┐
 │  Host / Feature Component  │  API-aware. Knows Organization service,
 │  (e.g. OrganizationPanel)  │  endpoint, success/error handling.
 └───────────────────────────┘
```

The **only** thing that crosses from the Agent into the UI is a **FormSpec** — a plain data object. The only thing that crosses from the DynamicForm into the API layer is a **plain form value**.

---

## 4. Core Building Blocks

### 4.1 FormSpec — the shared contract

```ts
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'checkbox'
  | 'radio';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FormFieldSpec {
  id: string;                 // e.g. 'name', 'shortName', 'parentOrgId'
  label: string;               // 'Name', 'Short Name', 'Parent'
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  helpText?: string;           // e.g. 'Up to 6 characters'
  // For select/radio: NOT raw API data. A symbolic *source key* only.
  optionsSource?: string;      // e.g. 'organizations.parentOptions'
  staticOptions?: FieldOption[]; // for small, fixed enums e.g. Yes/No
  order: number;
}

export interface FormSpec {
  formId: string;              // e.g. 'add-organization' — used by host to route submit
  title: string;                // 'Add Organization'
  description?: string;
  submitLabel?: string;         // 'Submit'
  fields: FormFieldSpec[];
}
```

Key point: `optionsSource` is a **symbolic key**, not a URL. The dynamic form resolves it via a UI-side `OptionsResolverService` that maps keys → real data calls. The agent never sees or invents an endpoint.

### 4.2 Deterministic Agent Tools

These are the *only* functions the LLM is allowed to call (via function-calling / tool-use). Each is a pure, validated TypeScript function — no free text becomes UI.

```ts
// Tool: startForm
startForm(formId: string, title: string, description?: string): void

// Tool: addField
addField(field: {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
}): void

// Tool: addSelectField (dropdown/radio) — options come from a registry, not the agent
addSelectField(field: {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'radio';
  required?: boolean;
  optionsSource: string;   // must match a known key in OPTIONS_SOURCE_REGISTRY
}): void

// Tool: finalizeForm
finalizeForm(submitLabel?: string): FormSpec
```

Each tool call is executed by a deterministic **AgentToolHandler** service that:
- Validates arguments against a JSON Schema (reject unknown field types, unknown `optionsSource` keys, bad IDs).
- Assembles the in-progress `FormSpec`.
- On `finalizeForm`, emits the completed, validated `FormSpec` to the UI.

This is what makes it "deterministic tools": the LLM's only affordance is calling these functions with constrained arguments — it cannot inject arbitrary HTML/JS, and it cannot reference an endpoint or a field the registry doesn't recognize.

### 4.3 `DynamicFormComponent` (Rendering Layer)

- Accepts an `@Input() spec: FormSpec`.
- Builds a reactive `FormGroup` by iterating `spec.fields` and asking `FormFieldRegistry` for the right `FormControl` + validators per `type`.
- Renders each field using an `ngSwitch` (or dynamic component loader) keyed on `field.type` → e.g. `<app-text-field>`, `<app-select-field>`, `<app-date-field>`.
- Resolves `optionsSource` via `OptionsResolverService` (UI-side, injected) — this service *is* allowed to know about data (e.g., it might call an Organization list API), but the **DynamicFormComponent itself never imports any API service directly**; it only calls `optionsResolver.resolve(sourceKey)`.
- On submit, emits:
  ```ts
  @Output() formSubmit = new EventEmitter<{ formId: string; value: Record<string, any> }>();
  ```
- Has **zero knowledge** of what happens after `formSubmit` fires. That's entirely the host's job.

### 4.4 `FormFieldRegistry` (Deterministic factory)

```ts
const FIELD_CONTROL_FACTORY: Record<FieldType, (f: FormFieldSpec) => FormControl> = {
  text: (f) => new FormControl('', f.required ? [Validators.required, Validators.maxLength(f.maxLength ?? 255)] : []),
  select: (f) => new FormControl(null, f.required ? [Validators.required] : []),
  number: (f) => new FormControl(null, f.required ? [Validators.required] : []),
  // ... etc
};
```

This is the single place that decides "textbox needs `Validators.maxLength`", "select needs `Validators.required`", etc. Adding a new field type = adding one entry here + one small presentational component. The LLM never needs to know these details — it just says `type: 'text'`.

### 4.5 Host / Feature Component (Integration Layer — API aware)

```ts
// OrganizationPanelComponent
onFormSubmit({ formId, value }: { formId: string; value: any }) {
  if (formId === 'add-organization') {
    this.organizationService.create(value).subscribe(...);
  }
}
```

Alternatively, use a **submit-handler registry** (`Map<formId, (value) => Observable<any>>`) injected app-wide, so `DynamicFormComponent`'s parent doesn't even need a big `if/else` — it just looks up the handler by `formId`. Either way, **API knowledge lives outside the dynamic form**.

### 4.6 `OptionsResolverService` (dropdown data)

```ts
const OPTIONS_SOURCE_REGISTRY: Record<string, () => Observable<FieldOption[]>> = {
  'organizations.parentOptions': () => orgService.listAsOptions(),
  'organizations.ownerOptions': () => userService.listOwnersAsOptions(),
};
```

The agent says `optionsSource: 'organizations.parentOptions'`. It has no idea this maps to `/api/organizations?type=parent-eligible`. Only this registry (owned by engineers, not the LLM) knows that.

---

## 5. End-to-End Flow (Add Organization example)

1. User: *"add organization"* in AI Agent chat.
2. Agent (LLM) recognizes intent, calls tools in sequence:
   - `startForm('add-organization', 'Add Organization', 'Fill in the organization details, then submit.')`
   - `addField({id:'name', label:'Name', type:'text', required:true})`
   - `addField({id:'shortName', label:'Short Name', type:'text', required:true, maxLength:6, helpText:'Up to 6 characters'})`
   - `addSelectField({id:'parentOrgId', label:'Parent', type:'select', optionsSource:'organizations.parentOptions'})`
   - `addSelectField({id:'ownerId', label:'Owner', type:'select', optionsSource:'organizations.ownerOptions'})`
   - `finalizeForm('Submit')`
3. `AgentToolHandler` validates each call, builds `FormSpec`, emits it.
4. Chat panel (or a side panel, matching the screenshot's right-hand "Add Organization" drawer) binds `<app-dynamic-form [spec]="spec" (formSubmit)="onFormSubmit($event)">`.
5. `DynamicFormComponent` renders controls, resolves dropdown options via `OptionsResolverService`.
6. User fills form, hits Submit → `formSubmit` emits `{formId: 'add-organization', value: {...}}`.
7. Host component looks up the real API call for `add-organization` and executes it — success/error handling, toasts, etc. all live here, not in the dynamic form or the agent.

---

## 6. Validation & Safety

- All tool-call arguments validated with a strict schema (e.g. Zod) **before** they touch `FormSpec`. Unknown `type`, unknown `optionsSource`, or malformed IDs → tool call rejected, agent gets an error result to self-correct.
- `optionsSource` and `formId` are **whitelisted enums**, not free strings, so the agent cannot invent a source that doesn't exist or point a form at a submit handler that isn't registered.
- No `formId` → no submit handler match → host safely no-ops (or shows "unsupported form") instead of guessing an endpoint.
- Field `id`s should be validated against an allow-list per `formId` if you want extra strictness (e.g., only `name`, `shortName`, `parentOrgId`, `ownerId` are valid for `add-organization`), so the agent can choose a *subset* or *order* but not invent new backend fields the API doesn't accept. This is the main guard against "LLM hallucinated a field that breaks the API."

---

## 7. Angular Implementation Sketch (module layout)

```
/dynamic-forms
  /models
    form-spec.model.ts
  /registry
    field-control.registry.ts       (type -> FormControl + validators)
    options-source.registry.ts      (key -> data resolver)
    submit-handler.registry.ts      (formId -> submit fn)
  /components
    dynamic-form/dynamic-form.component.ts
    fields/text-field.component.ts
    fields/select-field.component.ts
    fields/date-field.component.ts
    ...
  /agent
    agent-tools.ts                  (tool function definitions + JSON schema)
    agent-tool-handler.service.ts   (executes tool calls -> FormSpec)
```

---

## 8. Rollout Plan

**Phase 0 — Groundwork**
- Define `FormSpec`, `FieldType`, registries as above.
- Write `DynamicFormComponent` + a handful of field components (text, select, date, checkbox — covers 90% of current forms).

**Phase 1 — Prove parity, no agent yet**
- Migrate the existing hardcoded "Add Organization" component to be schema-driven: hand-write its `FormSpec` as a static constant, feed it into `DynamicFormComponent`.
- Confirm visual/behavioral parity with the screenshot (same validation, same labels, same submit UX).
- This validates the rendering layer in isolation, with zero agent risk.

**Phase 2 — Wire the agent, feature-flagged**
- Implement `agent-tools.ts` + `AgentToolHandler`.
- Expose these tools to the LLM via function-calling in the existing CT-Bot Assistant flow.
- Feature flag: agent-generated forms only for internal/test users initially.
- Add strict schema validation + allow-lists per `formId` (section 6).

**Phase 3 — Expand coverage**
- Add more `formId`s / field allow-lists (Fee, Student, Event, etc.).
- Add more field types as needed (multiselect, file upload, textarea) — always registry-first, agent-second.
- Add `submit-handler.registry.ts` so host wiring is declarative, not a growing if/else.

**Phase 4 — Observability & hardening**
- Log every tool call + resulting `FormSpec` (for audit/debugging bad agent output).
- Add telemetry: how often does the agent produce an invalid tool call (schema rejection rate)?
- Add regression tests comparing agent-generated `FormSpec` for known intents against golden snapshots.
- Consider a "confirm before render" step for low-confidence agent outputs.

---

## 9. Testing Strategy

- **Unit tests — Registry:** each `FieldType` maps to correct control + validators.
- **Unit tests — `DynamicFormComponent`:** given a fixed `FormSpec`, correct controls render, required validation fires, submit emits correct shape.
- **Unit tests — `AgentToolHandler`:** valid/invalid tool-call sequences produce correct `FormSpec` or correct rejection.
- **Contract tests — allow-lists:** a `FormSpec` for `add-organization` can never contain a field ID the Organization API doesn't accept (catches drift between agent behavior and backend schema).
- **E2E:** chat "add organization" → verify same form/fields as current hardcoded version → submit → verify correct API payload sent by host component.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Agent hallucinates a field/type the UI can't render | Strict schema validation + whitelisted `FieldType`/`optionsSource`/`formId` enums; unknown → tool call rejected |
| Agent-produced field doesn't match backend contract | Per-`formId` field allow-list, validated server-side too (defense in depth) |
| Dynamic form silently fails to find a submit handler | `submit-handler.registry` lookup failure surfaces a visible "unsupported form" state, never a silent no-op |
| Divergence between hardcoded and agent-generated forms during migration | Phase 1 static-`FormSpec` parity check before agent is involved at all |
| Harder to debug "why does this form look like this" | Log the full tool-call sequence + resulting `FormSpec` per session |

---

## 11. Open Questions (to resolve before Phase 2)

1. Should field **order/labels** be fully agent-controlled, or should the registry pin canonical labels/order per `formId` and let the agent only choose *which subset* to include (safer, less flexible)?
2. Do we want the agent to be able to **pre-fill values** (e.g., from conversation context) via an `addField({..., defaultValue})`, and if so, how do we validate that against type?
3. Where does tool-call execution happen — client-side (Angular service) or server-side (agent orchestration backend) before the `FormSpec` is pushed to the client over the existing chat/socket channel? (Server-side is generally safer since the client never needs to trust raw LLM output at all — it only ever sees a `FormSpec` your backend already validated.)
4. Do we need versioning on `FormSpec` schema for backward compatibility as new field types are added?
