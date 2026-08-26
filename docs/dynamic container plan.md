# How Agent-Driven Dynamic Forms Work

## The Big Picture

```
┌─────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  User   │ ──▶ │   Agent   │ ──▶ │  Tool Layer   │ ──▶ │  Form UI     │ ──▶ │   Host   │
│ request │     │ (decides  │     │ (validates +  │     │ (renders     │     │ (calls   │
│         │     │  WHAT)    │     │  builds spec) │     │  controls)   │     │  API)    │
└─────────┘     └───────────┘     └──────────────┘     └─────────────┘     └──────────┘
                      │                    │                    │                 │
                 picks fields        deterministic         deterministic     only place
                 + types only        function calls         rendering         API-aware
```

Four separate concerns, four separate owners:

| Layer | Decides | Does NOT know about |
|---|---|---|
| Agent | Which fields, what type each is | HTML, validators, APIs |
| Tool Layer | Whether the agent's choices are valid | Rendering, APIs |
| Form UI | How a field-type becomes a control | Business meaning, APIs |
| Host | What happens with submitted data | How the form was built |

---

## Step 1 — Agent Understands the Requirement

The agent is given a **fixed menu of tools**, not free rein to generate UI.

```
System context given to agent:
  "You can call these tools only:
     startForm(id, title)
     addField(id, label, type)
     addSelectField(id, label, optionsSource)
     finalizeForm()
   Allowed types: text | number | date | checkbox | select | textarea"

User: "<some request describing a record to create>"

Agent reasoning (not code, not markup):
  → identify the entity being created
  → identify its attributes
  → map each attribute to the closest allowed field type
  → call tools in order
```

The agent's output is a **sequence of tool calls**, e.g.:

```
startForm("create-record", "Create Record")
addField(id: "title", label: "Title", type: "text", required: true)
addField(id: "quantity", label: "Quantity", type: "number")
addSelectField(id: "category", label: "Category", optionsSource: "record.categories")
finalizeForm(submitLabel: "Save")
```

Nothing here is HTML. It's a plan, expressed only through the tool signatures it was given.

---

## Step 2 — Tool Layer Turns the Plan into a Spec

```
 tool call ──▶ [validate against schema] ──▶ pass?
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼ yes                                       ▼ no
                append field to FormSpec                    reject / error back to agent
```

Checks performed here (all deterministic, no LLM involved):

- Is `type` one of the allowed types?
- Is `id` allowed for this `formId` (optional allow-list)?
- Does `optionsSource` match a registered key?
- Are required arguments present?

Output: a single **FormSpec** — plain data, nothing executable.

```
FormSpec {
  formId, title, submitLabel,
  fields: [
    { id, label, type, required, optionsSource? }, ...
  ]
}
```

This is the **only handoff** between "agent side" and "UI side."

---

## Step 3 — UI Picks the Right Element per Field

The form renderer never asks "what is this field for" — only "what type is it."

```
 FormSpec.fields
       │
       ▼
 for each field ──▶ look up field.type in Type→Control Registry
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                        ▼
     "text"                  "select"                 "date"
        │                       │                        │
        ▼                       ▼                        ▼
  <input type=text>     <select> + resolve         <input type=date>
                         optionsSource via
                         Options Registry
```

```
Type → Control Registry (fixed, engineer-owned)
─────────────────────────────────────────────
 text      → text input        + required/maxLength validators
 number    → number input      + required validator
 date      → date picker       + required validator
 checkbox  → checkbox          + requiredTrue validator
 select    → dropdown          + options resolved by key, not by agent
 textarea  → multi-line input  + required/maxLength validators
```

The agent chose *type: "select"*. It never chose *how* a select renders, what CSS it uses, or what data fills it — that's this registry's job.

---

## Step 4 — Submission Never Touches the Agent or the Renderer

```
 Form UI ──(formId, values)──▶ Host / Submit-Handler Registry ──▶ real API
     ▲                                     │
     │                                     ▼
     └──────────── success / error ────────┘
```

- Form UI emits: `{ formId, values }` — plain object, no knowledge of where it goes.
- A **submit-handler registry**, keyed by `formId`, maps to the real API call.
- Agent and Form UI are both unaware this mapping exists.

---

## Why This Split Matters

```
 Agent freedom          Deterministic guarantees
 ───────────────        ─────────────────────────
 chooses WHAT fields     controls HOW they render
 chooses field TYPES     controls validation rules
 chooses field ORDER     controls data sources
                         controls API calls
                         rejects invalid/unknown output
```

- Agent output is **structured and constrained** (tool calls with a fixed schema) — never free-form code or markup.
- Every stage after the agent is **deterministic and testable** independent of the LLM.
- Swapping the agent for a smarter model, or swapping the API layer for a different backend, requires no change to the other layers.
