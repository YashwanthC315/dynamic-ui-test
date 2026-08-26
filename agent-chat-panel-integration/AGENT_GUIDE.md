# Agent Chat Panel — Integration Guide (for a coding agent)

> **If you're the person who downloaded this:** hand this whole folder,
> along with this file, to your coding agent (Claude Code, Cursor, etc.) and
> ask it to "integrate the agent chat panel into this app following
> AGENT_GUIDE.md." You shouldn't need to edit anything yourself.

> **If you're the coding agent reading this:** you're integrating a
> pre-built Angular chat panel component into an existing Angular
> application. Two files are finished and must not be redesigned:
> `src/app/agent-chat-panel/agent-chat-panel.component.ts` and
> `src/app/agent-chat-panel/agent-chat-panel.component.html`.
> The **one exception** is the Angular-version compatibility patch in
> Task 1a below — apply it only if the version check calls for it, and
> change nothing else in those two files. Everything else in this folder
> is a scaffold for you to complete using patterns already present in the
> target repo — don't invent a parallel backend contract, a parallel HTTP
> client, or a parallel design system when the app already has one. Work
> through the tasks below in order.

---

## What's in this folder

```
src/app/agent-chat-panel/
  agent-chat-panel.component.ts     Finished. Do not modify, except the
                                    Task 1a compatibility patch if it applies.
  agent-chat-panel.component.html   Finished. Do not modify.
  agent-chat-panel.component.css    Starter styles using --agent-* CSS
                                    variables with fallback values.
                                    Map the variables to this app's real
                                    design tokens (Task 5).
  chat.contracts.ts                 Finished. TypeScript types for chat
                                    requests/responses/blocks. Do not
                                    modify unless the target backend's
                                    shape genuinely can't fit these types.
  agent-chat-port.contracts.ts      Finished. The two interfaces
                                    (AgentChatStatePort,
                                    AgentChatResponsePort) the component
                                    depends on. Do not modify.
  agent-chat-panel.module.ts        Skeleton NgModule. Needs the service
                                    (below) registered once it exists
                                    (Task 3).
  agent-chat.service.template.ts    Scaffold, NOT a working file. Rename
                                    to agent-chat.service.ts and fill in
                                    every TODO using this app's existing
                                    API/HTTP/auth/router patterns (Task 3).
```

The component only ever talks to `AgentChatStatePort` /
`AgentChatResponsePort` (defined in `agent-chat-port.contracts.ts`) — it has
no idea what backend, HTTP client, or state library is behind them. That's
the whole point: your job is to satisfy those two interfaces using what this
specific app already has, not to build something new and separate.

---

## Task 1 — Discover the target app's conventions

Before writing anything, find and note:

1. **HTTP/API layer.** Is there a shared service that wraps `HttpClient`
   (e.g. `ApiService`, `HttpService`, generated OpenAPI/Swagger clients)?
   Search for `HttpClient` usages and see what pattern is repeated. Prefer
   reusing this over injecting `HttpClient` directly, so auth headers,
   error handling, and base-URL config stay consistent with the rest of the
   app.
2. **Auth.** How does the app attach credentials to requests (an
   `HttpInterceptor`, a token in `localStorage`/a store, cookies)? You
   generally don't need to touch this — just make sure whatever HTTP call
   you add goes through the same path as the rest of the app's calls, so it
   picks up auth automatically.
3. **Environment/config.** Where does the app keep its API base URL(s) —
   `environment.ts` / `environment.prod.ts`, or a runtime config service?
4. **Existing agent/chat backend, if any.** Search the codebase and any
   backend/API docs in the repo for something that already looks like an
   AI assistant, chatbot, or agent endpoint. If one exists, you likely just
   need to adapt `chat.contracts.ts` request/response shapes to match it
   (or vice versa) rather than building a new endpoint.
5. **Routing.** Find `AppRoutingModule` (or equivalent) and list the app's
   real top-level routes — you'll need this for `allowedNavigationHrefs`
   (Task 4).
6. **App shell.** Find the root/shell component whose template wraps the
   whole app (e.g. `AppComponent`, a `ShellComponent`, a layout component)
   — this is where the panel and its toggle button will live.
7. **Module system.** Is this an NgModule-based app or a standalone-
   components app (Angular 15+, `bootstrapApplication`)? Affects how you
   import `AgentChatPanelModule` in Task 2.
8. **Design tokens.** CSS custom properties on `:root`, a theme SCSS file,
   or a UI-kit theme (Angular Material, PrimeNG, Tailwind config). Needed
   for Task 5.
9. **Angular version.** Open the repo's root `package.json` and check the
   `"@angular/core"` version (also cross-check `angular.json` /
   `node_modules/@angular/core/package.json` if the root one is a caret
   range). Write down the major version — it's needed immediately in
   Task 1a below, before you build anything.

Keep notes on all of the above — you'll reference them in every later task.

---

## Task 1a — Angular version compatibility check (do this before Task 2)

`src/app/agent-chat-panel/agent-chat-panel.component.ts` includes an **optional** feature (the
right-hand "surface panel", used only if you register `AGENT_CHAT_SURFACE_PLUGINS`
in Task 3+) that dynamically creates a component at runtime. The method
`tryRenderSurface()` calls:

```ts
this.rightPanelComponentRef = this.rightPanelContainer.createComponent(plugin.component);
```

This is the Angular **13+** signature of `ViewContainerRef.createComponent()`,
which accepts a component `Type` directly. On Angular **12 and earlier**,
`createComponent()` only accepts a `ComponentFactory`, not a `Type`, and
this line fails to compile with an error like:
error TS2345: Argument of type 'Type<any>' is not assignable to parameter of type 'ComponentFactory<any>'.

**Check the Angular major version you noted in Task 1, step 9, and act accordingly:**

- **Angular 13 or newer:** no action needed. Leave the file as-is.
- **Angular 12 or older:** apply this scoped patch to
  `src/app/agent-chat-panel/agent-chat-panel.component.ts` — this is the
  one permitted edit to that file.

  1. Add `ComponentFactoryResolver` to the `@angular/core` import at the
     top of the file, and inject it in the constructor:
```ts
     constructor(
       // ...existing injected params...
       private readonly componentFactoryResolver: ComponentFactoryResolver,
     ) { /* ...existing body... */ }
```
  2. In `tryRenderSurface()`, replace:
```ts
     this.rightPanelComponentRef = this.rightPanelContainer.createComponent(plugin.component);
```
     with:
```ts
     const factory = this.componentFactoryResolver.resolveComponentFactory(plugin.component);
     this.rightPanelComponentRef = this.rightPanelContainer.createComponent(factory);
```
  3. Do not change anything else in the file.

If you're not planning to use the surface-panel feature at all (most
integrations don't — see Task 4/README note on `AGENT_CHAT_SURFACE_PLUGINS`),
this code path still needs to **compile**, so the patch above is still
required on Angular ≤12 even if you never register a plugin.
---

## Task 2 — Wire the module into the app

Ensure all panel files are present under `src/app/agent-chat-panel/`.
If you are importing this feature into another repo, copy the folder there
first and preserve the same internal file names.

**NgModule-based app:** import `AgentChatPanelModule` into the module that
declares your shell component (often `AppModule`):

```ts
import { AgentChatPanelModule } from './agent-chat-panel/agent-chat-panel.module';

@NgModule({
  imports: [
    // ...
    AgentChatPanelModule,
  ],
})
export class AppModule {}
```

If your folder has a different name, adjust the import path accordingly.

```ts
import { AgentChatPanelModule } from './agent-chat-panel/agent-chat-panel.module';
```

**Standalone-components app:** add `AgentChatPanelModule` to the shell
component's `imports` array (NgModules can be imported directly into a
standalone component).

Don't add the module to `providers` anywhere yet — that happens in Task 3
once the service exists.

---

## Task 3 — Implement the backend connection

1. Ensure `agent-chat.service.ts` exists in `src/app/agent-chat-panel/`.
  If only `agent-chat.service.template.ts` exists, rename it.
2. Work through every `TODO` in that file using what you found in Task 1:
   inject the app's existing API/HTTP service (not a bare `HttpClient`,
   unless the app truly has nothing like it) and its `Router`.
3. Implement `sendRequest()` and `emitEvent()` to call the app's existing
   agent/chat backend endpoint if one exists, or add a new endpoint that
   follows the same request-wrapper/error-handling conventions as the app's
   other API calls if one doesn't. The request/response shapes to
   send/expect are `ChatRequest` / `ChatResponse` from `chat.contracts.ts`
   — adapt field mapping as needed if the real backend's shape differs
   slightly, but keep the TypeScript types in `chat.contracts.ts` as the
   contract the component itself relies on.
4. Implement `loadConversations()` / `restoreConversationById()` only if
   the app has (or should have) persisted chat history. If not, leave them
   as no-ops — the panel degrades gracefully (history panel just stays
   empty).
5. Implement `navigate()` using the app's existing `Router`.
6. Register the service in `agent-chat-panel.module.ts` — uncomment the
   import and the three provider lines at the bottom of that file.

---

## Task 4 — Place the panel and wire its inputs to real app data

In the app shell component found in Task 1:

```html
<button type="button" (click)="isAgentChatOpen = !isAgentChatOpen">Ask AI</button>

<app-agent-chat-panel
  [isOpen]="isAgentChatOpen"
  appId="<a short slug identifying this app>"
  [appContext]="agentChatAppContext"
  [hostContext]="agentChatHostContext"
  [allowedNavigationHrefs]="agentChatAllowedRoutes"
></app-agent-chat-panel>
```

In the shell component class:

- `isAgentChatOpen = false;` plus the toggle button above.
- `agentChatAppContext` — an object built from real, current app state the
  backend should know about (current route/page name, current
  record/view id if applicable, feature flags — whatever's relevant).
  Rebuild it on navigation if it should reflect "where the user currently
  is" (e.g. in the shell's `Router.events` subscription, or a getter).
  **Never put secrets/tokens here** — the component strips common
  secret-like keys automatically, but don't rely on that as your only
  safeguard.
- `agentChatHostContext` — session/user info the backend needs (e.g.
  `{ persona: currentUser.role }`), sourced from the app's real
  auth/user service, not hardcoded.
- `agentChatAllowedRoutes` — the real route list from Task 1's routing
  discovery, e.g. `['/dashboard', '/settings', '/reports']`. **This
  defaults to empty in the component, so no navigation action will work
  until you set it.** Only include routes that are safe and meaningful for
  an assistant to send the user to.

Optional inputs you can also wire if relevant: `quickActions` (starter
prompts, only if you have real ones worth suggesting — don't invent
placeholder content), `navigationTabs` (if the app has a tab/sidebar
structure the assistant should be able to open), `greeting`.

Handle `(agentEvent)` on the panel if the backend will send action payload
types beyond the built-in ones (see the comment block at the top of
`runAction()` in `agent-chat-panel.component.ts` for the built-in list) —
otherwise this can be left unhandled.

---

## Task 5 — Match the app's visual style

Open `agent-chat-panel.component.css`. Each `--agent-*` variable is defined
as `var(--app-color-*, <fallback hex>)`. For each one:

- If the app already exposes a matching CSS custom property (check
  `:root`, a theme class, or a global stylesheet from Task 1), you're
  already done — the panel will pick it up automatically, no edit needed.
- If the app uses SCSS/LESS variables or a TS design-tokens object instead
  of CSS custom properties, either expose them as CSS custom properties
  globally (preferred, reusable) or replace the fallback hex values in this
  file directly with the app's literal values.
- If there's no token system at all, hand-tune the fallback hex values to
  visually match the app's primary color, surface color, border color, and
  corner radius. Check the result against a couple of real screens.

If the app keeps all styles in one global stylesheet by convention rather
than per-component files, it's fine to move this file's rules there instead
and delete the `styleUrls: ['./agent-chat-panel.component.css']` line from
`agent-chat-panel.component.ts` — keep the `.agent-*` class names as-is
either way.

---

## Task 6 — Verify

- [ ] App builds with no new errors (including the Angular-version check
      from Task 1a — if the build error mentions `createComponent` and
      `ComponentFactory`, the Task 1a patch wasn't applied or was applied
      to the wrong Angular version branch).
- [ ] Toggle button opens/closes the panel.
- [ ] Sending a message shows the loading state, then a real backend
      response (not the "not implemented yet" transport error from the
      template).
- [ ] Panel visually matches the rest of the app (colors, font, radius).
- [ ] `allowedNavigationHrefs` reflects real routes; a `navigate` action or
      `link` block only works for routes in that list.
- [ ] If the app persists chat history: reopening/restoring a past
      conversation works.
- [ ] `appContext`/`hostContext` reflect real, current app state (spot-check
      by logging the built `ChatRequest` once, or checking what the backend
      receives).
- [ ] No secrets end up in `appContext`/`hostContext`.
