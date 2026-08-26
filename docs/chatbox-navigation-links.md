# Navigation Links & In-App Route Actions

## Purpose

Define how the reusable chatbox displays and handles navigation to internal routes of the host website (e.g. “open fees section”, “take me to admin”, “go to student list”).

The chatbox must remain domain-agnostic. It never inspects user text for keywords or decides which page to open. All intent understanding and route selection belong to the harness/agent. The chatbox only renders structured link/action blocks and notifies the host when the user activates them.

## Design Principles

- Intent parsing and route resolution live in the harness, never in the chat UI.
- The chatbox only understands typed response blocks (`link`, `suggestions`, or future action types).
- Clicking a navigation element never performs side effects inside the chatbox itself.
- The host retains full ownership of routing (Angular Router, custom navigation service, etc.).
- Available routes can be supplied to the agent via context so the agent can choose correctly, but the chat component does not store or match against a route map.
- Unknown or malformed navigation blocks render as a safe fallback and do not break the conversation.

## End-to-End Flow

1. User types a natural-language request that implies navigation  
   (“open the fees section”, “take me to admin dashboard”, “show student profile”).

2. Chatbox sends the exact prompt + current context to the harness (normal `ChatRequest`).

3. Harness / agent:
   - Interprets the intent.
   - Decides whether a navigation action is appropriate.
   - Looks up the correct internal route (using host-provided route metadata if available).
   - Returns a `ChatResponse` that contains one or more navigation blocks.

4. Chatbox receives the response, matches it to the correct conversation turn, and renders the navigation block(s) using the registered renderer.

5. User clicks the rendered button/chip.

6. Chatbox emits a structured action event to the host (or uses a host-provided navigation handler). The host performs the actual route change.

7. Optionally the host can update context (new route, entity, etc.) so subsequent messages remain aware of the new location.

## Response Contract

Prefer the existing `link` block. Extend it slightly for richer navigation semantics if needed.

### Recommended `link` block

```ts
{
  type: 'link';
  id: string;
  label: string;          // User-facing button text, e.g. "Open Fees"
  href: string;           // Internal path or deep-link, e.g. "/fees" or "/admin/students/42"
  target?: 'internal' | 'external';  // default: 'internal'
  description?: string;   // Optional helper text shown under the button
}
```

### Alternative / complementary: `suggestions` block

Useful when the agent wants to offer multiple possible destinations:

```ts
{
  type: 'suggestions';
  id: string;
  items: Array<{
    id: string;
    label: string;
    action: 'navigate';
    payload: {
      href: string;
      target?: 'internal' | 'external';
    };
  }>;
}
```

The agent may also return a normal text/markdown block alongside the link so the reply feels conversational (“Sure, here’s the Fees section:”).

## UI Rendering Rules

- A `link` block with `target: 'internal'` (or omitted) renders as a primary or secondary button/chip with the provided `label`.
- External links (`target: 'external'`) may show a different visual treatment (external-link icon) and open in a new tab when activated.
- Multiple links from the same response appear as a horizontal or wrapped row of chips/buttons under the message.
- The conversation view must not auto-navigate. The user always initiates the navigation by clicking.
- Loading, disabled, and error states for the button are owned by the host if the navigation itself is asynchronous.

## Click Handling

The chatbox never calls Angular Router or any host navigation service directly.

Two supported integration patterns (host chooses one):

1. **Output Event (preferred for maximum reusability)**  
   Chatbox emits a typed event, e.g. `navigationRequested` or the generic `action` output already planned in the shell.  
   Payload contains at minimum: `{ href, label, target, messageId, conversationId }`.  
   Host listens and performs `router.navigateByUrl(href)` or equivalent.

2. **Injectable Navigation Handler**  
   Host provides an implementation of a small interface (`ChatNavigationHandler`) that the transport/integration layer can call.  
   Useful when the chat is deeply embedded and the host wants a single place to intercept all navigation.

In both cases the chatbox remains free of any knowledge of the host’s routing library.

## Providing Route Knowledge to the Agent

The chat component itself does not contain a list of routes. The host can optionally enrich context so the agent makes better decisions:

```ts
// Example context snapshot supplied by ChatContextProvider
{
  route: '/dashboard',
  module: 'admin',
  availableRoutes?: [
    { path: '/fees', label: 'Fees', keywords: ['fees', 'fee', 'payment'] },
    { path: '/admin', label: 'Admin', keywords: ['admin', 'administration'] },
    { path: '/students', label: 'Students', keywords: ['student', 'students'] }
  ]
}
```

- `availableRoutes` is completely optional.
- The agent (not the UI) may use the keywords, labels, or path information to decide which `href` to return.
- The chatbox never reads or matches against this list.

This keeps the original design principle intact: context is read-only input to the harness.

## Explicit Non-Goals

- The chatbox must not perform keyword matching on the user prompt.
- The chatbox must not maintain its own route registry.
- The chatbox must not call `router.navigate` or equivalent itself.
- Automatic navigation without a user click is forbidden.
- Domain-specific route logic must not appear inside chatbox components or NgRx state.

## Edge Cases & Safety

- Malformed `href` → render as disabled button + log diagnostic.
- Unknown block type → safe fallback card (“Unsupported content”).
- User clicks a link while a previous request is still in flight → allow it; navigation is independent of the request lifecycle.
- Deep links that require authentication → host is responsible for redirecting to login if needed.
- Relative vs absolute paths → host normalizes; chatbox treats `href` as opaque string.
- Multiple agents returning different links in the same conversation → each response’s links are scoped to that message.

## Accessibility

- Navigation buttons must be keyboard-reachable and have clear focus styles.
- Use appropriate ARIA labels (the `label` field is usually sufficient).
- Announce new link blocks via the existing live-region mechanism used for messages.
- External links should indicate they open in a new context (visually and to screen readers).

## Implementation Milestones

1. Confirm / slightly extend the `link` block shape in the shared contract.
2. Implement the default link renderer (button/chip) inside the message renderer registry.
3. Add the `navigationRequested` (or generic `action`) output on the shell.
4. Document the two host integration patterns (event vs injectable handler).
5. Add a mock harness response that returns sample navigation links for testing.
6. Provide a minimal host example that listens for the event and calls Angular Router.
7. Optional: allow host to supply `availableRoutes` via context for richer agent behavior.
8. Contract tests covering rendering, click emission, and malformed link handling.

## Definition of Ready

A host can receive a navigation intent from any agent, render a clear “Open Fees” (or similar) button, and navigate the user to the correct internal page by handling a single typed event—without any changes to the chatbox components, state model, or message protocol.
