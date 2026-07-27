# Reusable Agent Chatbox: UI Design

## Purpose

Define the UI contract and behavior of a reusable chatbox that can be embedded in any website. The chatbox accepts user text, sends one message to an agentic harness, and renders the harness response. It does not interpret intent, choose agents, call LLMs, or own domain workflows.

The design is domain agnostic: fee, student, support, or any future agent is a configuration and transport concern, not a chatbox concern.

## Design principles

- Think in blocks: shell, conversation, composer, transport state, and response blocks are separate UI responsibilities.
- The chatbox owns interaction state; the host owns application state and domain actions.
- The user prompt is sent as-is. Any normalization or enrichment is an explicit, replaceable transformation.
- The harness is the only integration point. The UI should not know how an agent produced a response.
- Every request and response is typed, versioned, and traceable to a conversation and message.
- Rendering is driven by response block type, not by agent name or domain-specific conditionals.

## Component blocks

### 1. Chat shell

Owns open/closed state, sidebar placement, width/resizing, active conversation, and responsive layout. It exposes configuration for title, branding, initial context, and persistence strategy.

### 2. Conversation view

Renders an ordered list of user, assistant, system, and error messages. It supports loading, retry, cancellation, empty state, and auto-scroll rules. It does not parse message text.

### 3. Message renderer

Maps typed response blocks to registered renderers:

- `text` / `markdown`
- `status` or progress
- `data` / key-value result
- `suggestions` or quick actions
- `form` or structured input
- `link` / navigation action
- `error`

Unknown block types must render a safe fallback and be logged; they must not break the conversation.

### 4. Composer

Owns draft text, submit availability, keyboard behavior, character limits, and optional attachments. It emits a submit event containing the exact submitted text.

### 5. Transport adapter

Converts the UI request into the harness API call and converts the API result into the normalized UI response. The chatbox depends on an interface, not on `HttpClient` directly. Streaming can be added behind the same interface.

### 6. Context provider

Supplies host context on request. Context is read-only input to the harness and is never inferred by the chatbox from the text.

## Keyboard and submit behavior

Use one explicit rule set across every host:

| Input | Behavior |
|---|---|
| `Enter` | Submit when the draft is non-empty and no request is active |
| `Shift+Enter` | Insert a newline; never submit |
| `Ctrl+Enter` / `Cmd+Enter` | Submit; useful for power users and multiline editors |
| `Alt+Enter` | Insert a newline; reserve this combination for future host-specific behavior |
| IME composition | Do not submit while composition is active |

The composer must prevent duplicate submits, trim only for the empty check, and preserve the original text in the message payload. Submit behavior should be configurable only if a host has a clear accessibility or product need; the default must remain consistent.

## Submission lifecycle

1. Validate locally: non-empty text, size limit, supported attachment types, and no active duplicate submit.
2. Add a user message immediately with a client-generated `messageId` and `status: 'sent'`.
3. Clear the composer and show a pending assistant turn or progress block.
4. Build a typed request from the prompt, conversation ID, and context.
5. Send one request to the harness through the transport adapter.
6. Render the normalized response blocks when it returns.
7. Mark the turn `completed`, `failed`, or `cancelled`; retain retry metadata without duplicating the user message.
8. Restore focus to the composer unless the user has moved focus elsewhere.

The UI should remain usable while waiting, but should prevent another submit in the same conversation unless parallel requests are explicitly supported. Default: one in-flight request per conversation.

## Chat-to-harness contract

The chat needs only a stable envelope. Agent selection and execution remain inside the harness.

```ts
export interface ChatRequest {
  schemaVersion: '1.0';
  requestId: string;
  conversationId: string;
  messageId: string;
  prompt: string;              // exact user-submitted text
  context: ChatContext;
  capabilities?: string[];     // optional UI capabilities, not intent
  client: { appId: string; appVersion?: string; locale?: string };
}

export interface ChatContext {
  route?: string;
  module?: string;
  entity?: { type: string; id: string };
  user?: { id?: string; role?: string };
  data?: Record<string, unknown>; // host-provided, sanitized context
}
```

The request must identify the source message and conversation so retries, audit logs, and out-of-order responses can be handled safely.

## Harness-to-chat response

The harness identifies the responding agent in metadata, not in UI logic. The chat displays the label only when useful to the user.

```ts
export interface ChatResponse {
  schemaVersion: '1.0';
  requestId: string;
  conversationId: string;
  messageId: string;
  parentMessageId: string;
  agent: { id: string; displayName?: string; avatarKey?: string };
  status: 'completed' | 'failed' | 'cancelled';
  blocks: ChatBlock[];
  context?: ChatContextPatch;
  actions?: ChatAction[];
  diagnostics?: { traceId?: string };
}

export type ChatBlock =
  | { type: 'text' | 'markdown'; id: string; content: string }
  | { type: 'status'; id: string; label: string; state: 'info' | 'success' | 'warning' }
  | { type: 'data'; id: string; data: Record<string, unknown> }
  | { type: 'suggestions'; id: string; items: ChatSuggestion[] }
  | { type: 'form'; id: string; schema: unknown; submitAction: string }
  | { type: 'link'; id: string; label: string; href: string }
  | { type: 'error'; id: string; code: string; message: string };
```

`parentMessageId` lets the UI attach the response to the correct user turn. `agent.id` is metadata only. A response from a student agent and a fee agent follows the same rendering contract.

## Transformations

Transformations are the deliberate seam between generic UI state and the harness contract. They belong in the chat feature/integration layer, not in individual domain components.

```ts
export interface ChatTransformer {
  toRequest(input: SubmitInput, context: ChatContext): ChatRequest;
  toViewModel(response: ChatResponse): ChatMessage;
}
```

Default transformation behavior:

- preserve the raw prompt;
- add IDs, schema version, client metadata, and context;
- validate the response envelope;
- map blocks to renderable UI models;
- map transport or schema failures to a standard error message.

Hosts may register additional transformations for authentication, redaction, feature flags, or context mapping. They must not rewrite user intent or introduce domain parsing in the chat component.

## Context rules

The host provides context through an injectable `ChatContextProvider` or an input observable. The chat snapshots it at submit time and includes that snapshot in the request. The harness may return a `context` patch, but the chat should expose it to the host rather than silently mutating application state.

```ts
export interface ChatContextProvider {
  getContext(): Observable<ChatContext>;
}

export interface ChatContextPatch {
  set?: Record<string, unknown>;
  remove?: string[];
}
```

The host decides whether a returned patch is accepted, persisted, or ignored. Context must be sanitized before transmission and must not contain secrets that the agent does not require.

## Angular and NgRx placement

Recommended module boundaries:

- `chatbox/` — presentational components, public interfaces, block renderer registry.
- `chatbox/data-access/` — transport adapter, transformer, context provider contracts.
- `chatbox/state/` — actions, reducer, selectors, effects; owns conversations and request lifecycle.
- `chatbox/testing/` — mock adapter, fixtures, keyboard and contract tests.
- host feature modules — context provider implementations and domain-specific action handlers.

NgRx should prepare the request in an effect, not in the component:

```ts
submit$ = createEffect(() => this.actions$.pipe(
  ofType(ChatActions.submit),
  withLatestFrom(this.store.select(selectActiveConversation), this.context.getContext()),
  map(([action, conversation, context]) =>
    ChatActions.requestStarted({
      request: this.transformer.toRequest(action.input, context),
      conversationId: conversation.id
    })
  ),
  switchMap(({ request }) => this.adapter.send(request).pipe(
    map(response => ChatActions.responseReceived({ response })),
    catchError(error => of(ChatActions.requestFailed({ requestId: request.requestId, error })))
  ))
));
```

Use `concatMap` if requests must be strictly ordered; use `exhaustMap` to ignore repeated submits; use `switchMap` only when cancellation of the prior request is intended. The initial design uses one active request and `exhaustMap`-like behavior.

The component dispatches `submit`; selectors provide messages, pending state, and errors. It should not call the API or contain agent/domain conditionals.

## Sanity checks and failure behavior

- Reject empty or oversized prompts before dispatch.
- Validate `requestId`, `conversationId`, `parentMessageId`, status, and block types.
- Ignore stale responses whose `requestId` is no longer active.
- Show retry for recoverable transport failures; retain the original prompt.
- Show a generic error for malformed or unsupported responses.
- Never render untrusted HTML without sanitization.
- Ensure accessibility: labelled composer, keyboard-only operation, live-region updates, visible focus, and readable error state.
- Log `traceId` and request IDs for diagnostics without exposing prompt content by default.

## Explicit non-goals

The chatbox does not own intent parsing, agent routing, prompt engineering, authentication policy, domain validation, tool execution, workflow mutation, or decisions about whether an agent's answer is correct.

## Design milestones / tickets

1. Define and version `ChatRequest`, `ChatResponse`, `ChatBlock`, and error envelopes.
2. Build the shell, sidebar, conversation view, composer, and default keyboard behavior.
3. Add the transport adapter and mock harness adapter.
4. Add NgRx state, effects, selectors, retry, cancellation, and stale-response handling.
5. Add block renderer registry with text, status, suggestions, data, and error blocks.
6. Add context provider and host integration example.
7. Add contract tests, keyboard tests, accessibility checks, and malformed-response fixtures.
8. Integrate one real agent without adding agent-specific logic to the chatbox.

## Definition of ready

The chatbox is reusable when a new website can provide a context provider, a harness adapter, branding/configuration, and optional block/action renderers—without changing the chatbox components, state model, or message protocol.
