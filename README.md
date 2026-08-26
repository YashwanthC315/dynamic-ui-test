# Dynamic UI Test (Angular)

This repository contains a chat-driven operations UI built with Angular. The reusable chat panel can be embedded into any Angular website/application as a sidebar.

Current goal: keep chat integration reusable across multiple apps while using CampusTrack as one demo host.

Angular app location: `campustrack-ui`

Shared reusable chat source: `shared/agent-chat-panel`

## Current Scope

The app currently focuses on:

- Fee Collection

In CampusTrack, the chat is currently connected to demo workflows. The shared component itself is host-agnostic.

## Component Structure

- `AgentChatPanelComponent`: generic/reusable chat UI and message input/output
- `AppComponent`: orchestration layer that routes chat prompts to host workflows

## Shared Chat Component (Root Clone)

The reusable chat component is now cloned at the repository root so multiple apps can consume the same base implementation.

Root shared folder:

- `shared/agent-chat-panel/components/agent-chat-panel.component.ts`
- `shared/agent-chat-panel/components/agent-chat-panel.component.html`
- `shared/agent-chat-panel/services/chat-contracts.ts`
- `shared/agent-chat-panel/services/chat-transport-adapter.service.ts`
- `shared/agent-chat-panel/services/mock-agent-harness.service.ts`
- `shared/agent-chat-panel/styles/agent-chat-panel.css`

Use this shared folder as the canonical source when integrating chat into current/future apps.

## Integrate Agent Chat Panel Into Another Angular App

Use this guide when you want to move the reusable chat panel into any Angular website/application.

### 1) Copy the reusable chat files

From `shared/agent-chat-panel`, copy these files into your target app (keep paths similar if possible):

- `components/agent-chat-panel.component.ts` -> `src/app/components/agent-chat-panel.component.ts`
- `components/agent-chat-panel.component.html` -> `src/app/components/agent-chat-panel.component.html`
- `services/chat-contracts.ts` -> `src/app/services/chat-contracts.ts`
- `services/chat-transport-adapter.service.ts` -> `src/app/services/chat-transport-adapter.service.ts`
- `services/mock-agent-harness.service.ts` -> `src/app/services/mock-agent-harness.service.ts`
- `styles/agent-chat-panel.css` -> merge/import into your app stylesheet

### 2) Import and render the standalone component

If your host page is a standalone Angular component, add `AgentChatPanelComponent` to `imports` and render it in template:

```ts
import { AgentChatPanelComponent } from './components/agent-chat-panel.component';

@Component({
	standalone: true,
	imports: [CommonModule, FormsModule, AgentChatPanelComponent],
	templateUrl: './app.component.html',
})
export class AppComponent {
	isAgentOpen = true;

	appContext = {
		app: 'YourApp',
		screen: 'home',
		tab: null,
		role: 'operator',
	};

	// This input can hold any domain/site-specific context your app wants
	// to send with chat requests.
	hostContext = {
		domain: 'generic-site',
		activeEntityId: null,
		filters: {},
	};

	entities = [];

	onAgentEvent(event: Record<string, unknown>): void {
		// Map chat actions to your app navigation/state updates.
		// Keep this host-specific and domain-specific.
	}
}
```

```html
<app-agent-chat-panel
	[isOpen]="isAgentOpen"
	[appContext]="appContext"
	[hostContext]="hostContext"
	[entities]="entities"
	(agentEvent)="onAgentEvent($event)"
></app-agent-chat-panel>
```

### 3) Provide a transport client (real harness or mock)

`ChatTransportAdapterService` depends on the `HARNESS_TRANSPORT_CLIENT` token. You must provide an implementation of:

```ts
export interface HarnessTransportClient {
	send(request: ChatRequest): Observable<ChatResponse>;
}
```

Example provider using a mock harness in `app.config.ts`:

```ts
import { ApplicationConfig } from '@angular/core';
import { HARNESS_TRANSPORT_CLIENT } from './services/chat-transport-adapter.service';
import { MockAgentHarnessService } from './services/mock-agent-harness.service';

export const appConfig: ApplicationConfig = {
	providers: [
		{
			provide: HARNESS_TRANSPORT_CLIENT,
			useExisting: MockAgentHarnessService,
		},
	],
};
```

For production, replace `MockAgentHarnessService` with your API-backed implementation.

### 4) Bring over the panel styles

The component uses class names such as `.agent-panel`, `.agent-msg`, `.agent-input`, and `.agent-action-btn`.
Copy or import `shared/agent-chat-panel/styles/agent-chat-panel.css` into your target app stylesheet (or component theme file), otherwise the panel will render unstyled.

To align with your website design:

- Override `.agent-*` classes in your app stylesheet after importing the shared CSS.
- Keep your host layout responsible for sidebar placement and open/close behavior.
- Render the panel either as a fixed sidebar, docked sidebar, or drawer based on your design system.

### 5) Wire host actions

The panel emits action payloads through `(agentEvent)`. Handle them in your host component (navigate pages, switch tabs, prefill forms, etc.).

The panel also accepts contextual inputs via `[appContext]` and `[hostContext]`; keep them updated so the harness receives accurate context with each prompt.

## Example Prompt For A Coding Agent

Use the following prompt when asking a coding agent to integrate this panel into a new Angular app after you provide the shared folder:

```text
Integrate the reusable Agent Chat Panel into this website without changing the existing application shell.

First inspect the host layout and identify:
- The global header/banner.
- The existing sidebar/nav rail.
- The main routed-content region.
- Any sidebar open/close state or layout mode state.
- Any host components using generic selectors such as `header`, `nav`, or `aside`.

Use these shared files unchanged in purpose:
- shared/agent-chat-panel/components/agent-chat-panel.component.ts
- shared/agent-chat-panel/components/agent-chat-panel.component.html
- shared/agent-chat-panel/services/chat-contracts.ts
- shared/agent-chat-panel/services/chat-transport-adapter.service.ts
- shared/agent-chat-panel/services/mock-agent-harness.service.ts
- shared/agent-chat-panel/styles/agent-chat-panel.css

Layout requirements:

1. If the host has a sidebar/nav rail:
   - Add the Agent trigger as a real navigation item inside that sidebar.
   - Place it at the bottom of the sidebar navigation.
   - Do not position it as a floating button, overlay, or absolutely positioned control in empty sidebar space.
   - The Agent trigger must use the sidebar’s existing visual language.

2. When opened:
   - Render the chat as an extension of the existing sidebar.
   - The layout order must be:

     [existing nav rail] [resizable Agent panel] [main routed content]

   - The Agent panel must be part of the page layout, not a viewport-fixed overlay.
   - It must not create an extra row or push the application content downward.
   - The main header/banner must remain in its existing location and must not be moved into or duplicated inside the Agent panel.
   - The Agent panel must contain only Agent UI. Do not render host header, burger controls, user menus, logs, notifications, dashboard links, or navigation menus inside it.
   - Preserve the panel’s resize behavior.
   - If the sidebar is collapsed or switched to another navigation mode, close the Agent panel automatically and restore the original layout.

3. If the host has no sidebar:
   - Use a fixed floating Agent trigger and viewport-edge drawer instead.

Host integration requirements:

- Pass `appContext`, `hostContext`, and `entities` from host state.
- Keep all host-specific navigation/state handling in a generic host adapter.
- Handle `agentEvent` without adding domain assumptions to the shared component.
- Register `HARNESS_TRANSPORT_CLIENT` with `MockAgentHarnessService`.
- Import the shared Agent styles and add host-specific overrides outside the shared component.
- Avoid selector collisions with host components. For example, if the host uses `header` as an Angular component selector, do not use a native `<header>` element inside the shared panel; use a non-conflicting wrapper with an accessibility role instead.
- Keep all existing routes, header behavior, sidebar behavior, and page content unchanged when Agent is closed.

Validation:

- Verify visually that:
  - There is exactly one host header.
  - There is exactly one sidebar/nav rail.
  - The Agent button is inside the sidebar at the bottom.
  - The Agent panel is directly adjacent to the sidebar.
  - No host navigation or header controls appear inside the Agent panel.
  - Main content is beside the Agent panel, not below it.
  - Resizing works.
  - Closing/collapsing the host sidebar also closes Agent.
- Run the build and tests.
- Fix integration-caused compile or template errors.

Deliverables:

- List of changed files.
- Layout/integration decisions.
- Visual verification summary.
- Build/test results.
- TODOs for replacing mock transport and adding domain-specific intent handling later.
- Explicit confirmation of every acceptance criterion.
```

## Example Prompts

Use quick commands or type prompts in chat, such as:

- `help`
- `status summary`
- `simulate error`
- `show overview`
- `open settings`

## Prompt Interpretation (Current Logic)

Current mock harness behavior is keyword-based and demo-only.

- It returns typed blocks (status/text/markdown/data/suggestions).
- It supports basic demo prompts from the examples above.
- Unknown prompts are still sent as-is and receive a safe fallback response.

## Fee Collection Features

- Student search and selection
- Pending vs paid fee tabs
- Amount and payment mode handling
- Save validation (amount must match selected pending total)

## Run Locally

Prerequisites:

- Node.js and npm installed

Steps:

1. Change to the app folder:

	 ```bash
	 cd campustrack-ui
	 ```

2. Install dependencies:

	 ```bash
	 npm install
	 ```

3. Start dev server:

	 ```bash
	 npm start
	 ```

4. Open in browser:

	 `http://localhost:4200/`

The app hot-reloads on file changes.

## Helpful Commands

- Run tests:

	```bash
	cd campustrack-ui
	npm test
	```

- Build production bundle:

	```bash
	cd campustrack-ui
	npm run build
	```

## Current Limitations

- Prompt handling is rule/keyword based in the mock harness, not model-based.
- No production AI agent/backend integration is connected yet.
- Final domain-specific action mapping must be implemented by each host app.

## Next Enhancements

- Add a production transport adapter per website/domain.
- Add host-specific action adapters for navigation/state mutations.
- Keep `shared/agent-chat-panel` as the canonical reusable chat UI source.
