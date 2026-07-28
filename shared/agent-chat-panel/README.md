# Shared Agent Chat Panel

This folder is the root-level shared copy of the reusable Angular chat component.

## Contents

- `components/agent-chat-panel.component.ts`
- `components/agent-chat-panel.component.html`
- `services/chat-contracts.ts`
- `services/chat-transport-adapter.service.ts`
- `services/mock-agent-harness.service.ts`
- `styles/agent-chat-panel.css`

## Intended Use

Each app (current and future) can copy these files into its own `src/app` structure and wire host-specific state/actions.

Suggested destination in an app:

- `src/app/components/agent-chat-panel.component.ts`
- `src/app/components/agent-chat-panel.component.html`
- `src/app/services/chat-contracts.ts`
- `src/app/services/chat-transport-adapter.service.ts`
- `src/app/services/mock-agent-harness.service.ts`

Then import `styles/agent-chat-panel.css` rules into the app-level stylesheet.

Recommended shared component inputs in host templates:

- `[appContext]`: high-level app/screen metadata.
- `[hostContext]`: domain-specific context payload.
- `[entities]`: optional generic entity list for count/context.

Backward compatibility aliases are still accepted:

- `[feeContext]` (legacy alias of `hostContext`)
- `[students]` (legacy alias of `entities`)

The host app should decide:

- Sidebar placement (left/right, docked, drawer, overlay).
- Open/close interaction and shell layout behavior.
- Final visual theming via `.agent-*` style overrides.

## Notes

- The component remains domain-agnostic at the UI layer.
- Host app owns navigation/state updates from `agentEvent` output.
- AI/agent backend integration is intentionally deferred.
- Keep `MockAgentHarnessService` for initial UI integration.
- Replace mock transport with website/domain-specific agent integration later.

## Copy-Paste Prompt (Strict Sidebar Integration)

Use this exact prompt when asking a coding agent to integrate the shared chat into a target app.

```text
Integrate the shared Agent Chat Panel into this Angular app with strict UI behavior.

Mandatory requirements (non-negotiable):
1) Use only the provided shared files from shared/agent-chat-panel.
2) Add an "Agent" trigger in the host navigation area:
	- If the app already has a sidebar/nav rail, add an Agent button there.
	- If no sidebar exists, add a persistent floating Agent button.
3) Clicking the Agent button must open a side chat panel (drawer/sidebar).
4) Clicking the Agent button again (or close control) must close the panel.
5) The panel must be rendered as a side panel, not inline in page content.
6) The panel must preserve existing host app behavior and routes.
7) Bind host inputs:
	- [appContext]
	- [hostContext]
	- [entities]
8) Register HARNESS_TRANSPORT_CLIENT using MockAgentHarnessService.
9) Import shared styles and add host overrides so chat visually matches host design.
10) Keep integration domain-agnostic: no fee/dashboard/student-specific assumptions.

Fallback UI rules:
- Existing sidebar app: Agent button must be inside sidebar/rail, visually consistent with other nav items.
- No-sidebar app: Agent button must be fixed (bottom-right by default), and open a right-side drawer.

Acceptance criteria:
- Agent button is visible on initial load.
- Agent button toggles open/close state of side panel.
- Side panel is attached to viewport edge (left or right), not embedded mid-content.
- App builds successfully after integration.
- Existing pages continue to function.

Output requirements:
- Provide changed files using workspace-relative paths only.
- Include where Agent button was added and where panel mount was added.
- Confirm acceptance criteria one by one.
```
