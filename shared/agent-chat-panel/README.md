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

## Notes

- The component remains domain-agnostic at the UI layer.
- Host app owns navigation/state updates from `agentEvent` output.
- Replace `MockAgentHarnessService` with a real harness/API transport for production.
