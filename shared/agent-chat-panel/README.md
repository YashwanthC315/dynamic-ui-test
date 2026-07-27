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
