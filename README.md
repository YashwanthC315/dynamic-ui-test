# Dynamic UI Test

This repository contains the CampusTrack Angular demo, a reusable Angular chat component, and a separately published Web Component package.

- `campustrack-ui/` is the existing CampusTrack demo (Angular 18). It currently uses the local `AgentChatPanelComponent` and a mock transport.
- `shared/agent-chat-panel/` contains the reusable Angular component source.
- `ct-package-test/` is a separate Angular 22 host for testing the published package. It is not the CampusTrack demo.
- `acp-package-0.2.10/` contains the source files used to package `@yashwanthc315/chat-panel@0.2.10`.

The published Web Component package is a separate integration path from the local Angular component. Installing it does not automatically replace the CampusTrack demo's current chat component.

## Current Scope

The app currently focuses on:

- Fee Collection

In CampusTrack, the chat is currently connected to demo workflows. The shared component itself is host-agnostic.

## Current CampusTrack Chat

- `campustrack-ui/src/app/app.component.ts` imports and hosts `AgentChatPanelComponent`.
- `campustrack-ui/src/app/components/agent-chat-panel.component.ts` contains the app's local component implementation.
- `shared/agent-chat-panel/services/chat-transport-adapter.service.ts` defaults to `MockAgentHarnessService` through `HARNESS_TRANSPORT_CLIENT`.

The demo covers Fee Collection and related CampusTrack navigation/workflows. Its mock responses are for demonstration; the published package's Agent Harness integration is documented separately below.

## Shared Angular Component Source

The shared source is kept under `shared/agent-chat-panel`:

- `shared/agent-chat-panel/components/agent-chat-panel.component.ts`
- `shared/agent-chat-panel/components/agent-chat-panel.component.html`
- `shared/agent-chat-panel/services/chat-contracts.ts`
- `shared/agent-chat-panel/services/chat-transport-adapter.service.ts`
- `shared/agent-chat-panel/services/mock-agent-harness.service.ts`
- `shared/agent-chat-panel/styles/agent-chat-panel.css`

The current CampusTrack app uses its own component files under `campustrack-ui/src/app/components`. The shared folder is the reusable Angular source for apps that intentionally choose the Angular component rather than the published custom-element package.

## Integrate the Shared Angular Component (Legacy Path)

This section applies only when copying the local Angular component source. For the published `@yashwanthc315/chat-panel` package, use the GitHub Packages steps at the bottom of this README and the package's `AGENT_GUIDE.md` instead.

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

## Run Locally

Prerequisites:

- Node.js and npm installed

Steps:

1. Change to the app folder:

	 ```bash
	 cd ct-package-test
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

	 `http://localhost:4300/`

The app hot-reloads on file changes.

## Helpful Commands

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

## Install the Published GitHub Package

The custom-element package is published as `@yashwanthc315/chat-panel` version `0.2.10` in GitHub Packages. The package's integration import name remains `@acp/chat-panel`; use the npm alias below to preserve those imports.

These steps are for the person installing the package in a host app. Run them from the host application's directory, the one containing its `package.json`. The package is private unless its GitHub package visibility has been changed, so the package owner must grant the installing GitHub account read access.

### 1. Create a read token

Each recipient creates their own **personal access token (classic)** in GitHub:

1. Open [GitHub personal access tokens](https://github.com/settings/tokens).
2. Choose **Generate new token (classic)**.
3. Set an expiration and select the `read:packages` scope.
4. Generate the token. If GitHub prompts for organization SSO authorization, authorize it.

Do not send the token to the package owner or coding agent, commit it, or put it in frontend source. This token is for npm registry authentication, not the Agent Harness bearer token used by the running application.

### 2. Map the npm scope to GitHub Packages

From the host app directory, configure the package scope:

```powershell
npm config set "@yashwanthc315:registry" "https://npm.pkg.github.com" --location=project
```

This writes a non-secret registry mapping to the project's `.npmrc`. It is fine to commit that mapping; do not put a token in this project file.

### 3. Log in to GitHub Packages

Run:

```powershell
npm login --scope=@yashwanthc315 --auth-type=legacy --registry=https://npm.pkg.github.com
```

At the prompts, enter the recipient's GitHub username, paste their personal access token as the password directly into the terminal, and enter an email if requested. Do not paste the token into chat or a source file. If npm reports `401 Unauthorized` or says no authentication token was provided, repeat this login step and verify that the token has `read:packages`.

### 4. Install the package

To preserve the package's documented `@acp/chat-panel` imports while downloading the GitHub-scoped package, install the npm alias in the app location:

```powershell
npm install "@acp/chat-panel@npm:@yashwanthc315/chat-panel@0.2.10"
```

If you use the actual `@yashwanthc315/chat-panel` import name instead, install it directly with `npm install @yashwanthc315/chat-panel@0.2.10` and update integration imports to match.

Installation alone does not integrate the elements into the app. Give the coding agent the package's `AGENT_GUIDE.md` and `SPEC_DOC.md` from this repository/package distribution and ask it to adapt the host shell. The separate Angular 22 test host in this repository is `ct-package-test`; the existing CampusTrack demo in `campustrack-ui` still uses the local mock-backed Angular component described above.

The GitHub token only authorizes downloading the package. Configure the Agent Harness URL, agent paths, and runtime bearer-token provider separately as described in the package's `AGENT_GUIDE.md`. Never bundle a production harness secret in a frontend build.
