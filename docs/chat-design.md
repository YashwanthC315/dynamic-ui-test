# Reusable Agent Chatbox — Condensed Design Plan (Angular)

## Purpose
- Embeddable chatbox component for any website.
- Sends one message to an agentic harness, renders the response.
- Domain-agnostic: does not interpret intent, pick agents, call LLMs, or run workflows.

## Core Principles
- Separate concerns into blocks: shell, conversation, composer, transport, response rendering.
- Chatbox owns UI/interaction state; host owns application/domain state.
- Prompt sent as-is — no silent normalization.
- Harness is the single integration point; UI stays agent-agnostic.
- Every request/response is typed, versioned, traceable (conversationId, messageId).
- Rendering driven by response **block type**, never by agent name or domain logic.

## Component Blocks

1. **Chat shell**
   - Open/close state, placement, resizing, active conversation, responsive layout.
   - Config: title, branding, initial context, persistence strategy.

2. **Conversation view**
   - Renders ordered message list (user/assistant/system/error).
   - Handles loading, retry, cancel, empty state, auto-scroll.
   - No text parsing.

3. **Message renderer**
   - Maps block type → registered renderer:
     - `text` / `markdown`
     - `status` / progress
     - `data` (key-value)
     - `suggestions` / quick actions
     - `form`
     - `link`
     - `error`
   - Unknown block type → safe fallback + log (must not break conversation).

4. **Composer**
   - Owns draft text, submit state, keyboard rules, char limits, attachments.
   - Emits submit event with exact text.

5. **Transport adapter**
   - Converts UI request → harness API call, and API result → normalized UI response.
   - Depends on an interface, not a concrete HTTP client — allows swapping in streaming later.

6. **Context provider**
   - Supplies read-only host context to harness.
   - Chatbox never infers context from message text.

## Keyboard Rules (fixed across hosts)

| Input | Behavior |
|---|---|
| Enter | Submit (if non-empty, no active request) |
| Shift+Enter | Newline, never submits |
| Ctrl/Cmd+Enter | Submit (power-user shortcut) |
| Alt+Enter | Newline (reserved for host-specific use) |

- Prevent duplicate submits.
- Trim only for empty-check; preserve original text in payload.
- Keep default behavior consistent; make configurable only for real accessibility/product need.

## Submission Lifecycle
1. Local validation: non-empty, size limit, valid attachments, no duplicate in-flight submit.
2. Add user message immediately (`messageId`, `status: 'sent'`).
3. Clear composer, show pending/progress state.
4. Build typed request (prompt + conversationId + context).
5. Send via transport adapter.
6. Render normalized response blocks.
7. Mark turn `completed` / `failed` / `cancelled`; keep retry metadata, don't duplicate user message.
8. Restore composer focus (unless user moved focus elsewhere).

- Default: **one in-flight request per conversation** unless parallel requests explicitly supported.

## Chat ↔ Harness Contract

**Request** (`ChatRequest`)
- `schemaVersion`, `requestId`, `conversationId`, `messageId`
- `prompt` — exact user text
- `context: ChatContext`
- `capabilities?` — optional UI capabilities (not intent)
- `client: { appId, appVersion?, locale? }`

**Response** (`ChatResponse`)
- `schemaVersion`, `requestId`, `conversationId`, `messageId`, `parentMessageId`
- `agent: { id, displayName?, avatarKey? }` — metadata only, shown to user only if useful
- `status`: `completed | failed | cancelled`
- `blocks: ChatBlock[]`
- `context?` (patch), `actions?`, `diagnostics?: { traceId? }`

- `parentMessageId` ties response to the correct user turn.
- Same rendering contract regardless of which agent responded.

## Transformations
- Sit in the chat feature/integration layer — not inside domain components.
- Responsibilities:
  - Preserve raw prompt.
  - Add IDs, schema version, client metadata, context.
  - Validate response envelope.
  - Map blocks → renderable view models.
  - Map transport/schema failures → standard error message.
- Hosts may add transforms for auth, redaction, feature flags, context mapping — but must not rewrite user intent or add domain parsing into the chatbox.

## Context Rules
- Host supplies context via `ChatContextProvider` (observable-based).
- Chat snapshots context at submit time and includes it in the request.
- Harness may return a context **patch**; chat exposes it to host — does not silently mutate app state. Host decides accept/persist/ignore.
- Context must be sanitized before send; no secrets beyond what the agent needs.

## Angular Module Structure
- `chatbox/` — presentational components, public interfaces, block renderer registry.
- `chatbox/data-access/` — transport adapter, transformer, context provider contracts.
- `chatbox/state/` — NgRx actions, reducer, selectors, effects (conversations + request lifecycle).
- `chatbox/testing/` — mock adapter, fixtures, keyboard/contract tests.
- Host feature modules — context provider implementations + domain action handlers.

**NgRx approach:**
- Effect builds the request (transformer + latest conversation + context) — not done in the component.
- Component only dispatches `submit`; selectors expose messages/pending/errors.
- No API calls or agent/domain conditionals inside the component.
- Concurrency strategy: `switchMap` only if cancel-on-new-submit is wanted; `concatMap` if strict ordering required; default behavior = single in-flight request (exhaustMap-like).

## Sanity Checks & Failure Handling
- Reject empty/oversized prompts before dispatch.
- Validate `requestId`, `conversationId`, `parentMessageId`, `status`, block types.
- Ignore stale responses (requestId no longer active).
- Retry option for recoverable transport failures; retain original prompt.
- Generic error for malformed/unsupported responses.
- Never render untrusted HTML unsanitized.
- Accessibility: labeled composer, full keyboard operability, live-region updates, visible focus, readable errors.
- Log `traceId`/request IDs for diagnostics; don't expose prompt content by default.

## Explicit Non-Goals
- Intent parsing, agent routing, prompt engineering.
- Authentication policy, domain validation.
- Tool execution, workflow mutation.
- Judging correctness of agent answers.

## Delivery Milestones
1. Define/version `ChatRequest`, `ChatResponse`, `ChatBlock`, error envelopes.
2. Build shell, sidebar, conversation view, composer, default keyboard behavior.
3. Add transport adapter + mock harness adapter.
4. Add NgRx state: effects, selectors, retry, cancellation, stale-response handling.
5. Add block renderer registry (text, status, suggestions, data, error).
6. Add context provider + host integration example.
7. Add contract tests, keyboard tests, accessibility checks, malformed-response fixtures.
8. Integrate one real agent — with zero agent-specific logic in the chatbox itself.

## Definition of "Ready to Reuse"
A new website can adopt the chatbox by providing:
- a context provider
- a harness adapter
- branding/configuration
- optional block/action renderers

...**without** modifying chatbox components, state model, or message protocol.
