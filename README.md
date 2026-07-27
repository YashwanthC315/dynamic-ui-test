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

The panel also accepts contextual inputs via `[appContext]` and `[feeContext]`; keep them updated so the harness receives accurate context with each prompt.

## Example Prompt For A Coding Agent

Use the following prompt when asking a coding agent to integrate this panel into a new Angular app after you provide the shared folder:

```text
Integrate the reusable Agent Chat Panel into this Angular app.

Requirements:
1) Use the provided files:
	 - shared/agent-chat-panel/components/agent-chat-panel.component.ts
	 - shared/agent-chat-panel/components/agent-chat-panel.component.html
	 - shared/agent-chat-panel/services/chat-contracts.ts
	 - shared/agent-chat-panel/services/chat-transport-adapter.service.ts
	 - shared/agent-chat-panel/services/mock-agent-harness.service.ts
	 - shared/agent-chat-panel/styles/agent-chat-panel.css
2) Render the panel as a sidebar (or drawer) on the main shell page.
3) Add a toggle button in the host UI to open/close the panel.
4) Pass appContext, hostContext, and entities inputs from host state using host-appropriate values.
5) Handle agentEvent output with a generic host adapter so events can trigger host-specific navigation/state actions.
6) Register HARNESS_TRANSPORT_CLIENT with the mock harness in app configuration.
7) Import shared .agent-* styles and override them so the panel matches this app's visual design system.
8) Keep all existing app behavior unchanged.
9) Run tests/build and fix any compile errors caused by integration.
10) Do not add fee-specific, dashboard-specific, or domain-specific assumptions inside the shared chat component.

Scope note:
- AI/agent backend integration is deferred.
- Keep mock transport in place for now.
- The final transport and intent/action logic will be implemented per website/domain later.

Deliverables:
- List of changed files
- Short summary of integration decisions
- Any follow-up TODOs for replacing mock transport with real website/domain agent integration
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
