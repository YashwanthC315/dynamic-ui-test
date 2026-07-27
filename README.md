# Dynamic UI Test (Angular)

This repository contains a chat-driven operations UI built with Angular. The left panel is a reusable chat component, and the right panel currently hosts a dedicated fee collection form component.

Current goal: focus on one production-like workflow (fee collection) while keeping chat independent for site-wide reuse.

Angular app location: `campustrack-ui`

Shared reusable chat source: `shared/agent-chat-panel`

## Current Scope

The app currently focuses on:

- Fee Collection

The chat drives the fee collection workflow by interpreting predefined commands.

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

Use this guide when you want to move the reusable chat panel into a different Angular website/application.

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
		screen: 'dashboard',
		tab: null,
		role: 'operator',
	};

	feeContext = {
		selectedStudentId: null,
		selectedStudentName: null,
		totalDue: 0,
		selectedPendingCount: 0,
		amount: '',
	};

	students = [];

	onAgentEvent(event: Record<string, unknown>): void {
		// Map chat actions to your app navigation/state updates.
	}
}
```

```html
<app-agent-chat-panel
	[isOpen]="isAgentOpen"
	[appContext]="appContext"
	[feeContext]="feeContext"
	[students]="students"
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

### 5) Wire host actions

The panel emits action payloads through `(agentEvent)`. Handle them in your host component (navigate pages, switch tabs, prefill forms, etc.).

The panel also accepts contextual inputs via `[appContext]` and `[feeContext]`; keep them updated so the harness receives accurate context with each prompt.

## Example Prompt For A Coding Agent

Use the following prompt when asking a coding agent to integrate this panel into a new Angular app after you provide the component and services files:

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
2) Render the panel as a right-side overlay/panel on the main shell page.
3) Add a toggle button in the host UI to open/close the panel.
4) Pass appContext, feeContext, and students inputs from host state.
5) Handle agentEvent output to support at least:
	 - navigate to dashboard
	 - switch to fees tab: collection
	 - switch fee view: pending/paid
6) Register HARNESS_TRANSPORT_CLIENT with the mock harness in app configuration.
7) Copy required .agent-* styles so the panel is visually correct.
8) Keep all existing app behavior unchanged.
9) Run tests/build and fix any compile errors caused by integration.

Deliverables:
- List of changed files
- Short summary of integration decisions
- Any follow-up TODOs for replacing mock transport with real API transport
```

## Example Prompts

Use quick commands or type prompts in chat, such as:

- `pick student a`
- `set amount 500`
- `mode cash`
- `show paid tab`

## Prompt Interpretation (Current Logic)

Prompt matching is keyword-based inside the fee collection component:

- Student selection by phrases like `student a` or explicit IDs like `20p074`
- Payment mode shortcuts: `cash`, `cheque`, `online`
- Amount parsing from numeric prompts
- Tab switching commands: `show paid tab`, `show pending tab`

Additional behavior:

- Unknown prompts return a fee-focused guidance message in chat.

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

- Prompt parsing is rule/keyword based, not model-based intent parsing.
- Chat and fee form are connected in-memory through the root component.
- No persistence layer or backend orchestration is connected yet.

## Next Enhancements

- Add richer intent extraction for fee collection commands and validation feedback.
- Add API integration for student search, pending fees, and receipt save operations.
- Reuse `AgentChatPanelComponent` in other pages and connect via a shared chat service.
