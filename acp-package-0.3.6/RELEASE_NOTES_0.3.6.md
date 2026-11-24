# @acp/chat-panel v0.3.6 Release Notes

Session lifecycle fixes. No other behavior changes.

## Changed files
- `dist/acp-harness-bridge.js`: new `resetSession()` / `closeSurfaces()`; `handleNewChat()` and `handleOpen()` (chat closed) now use them. Adds `acp-session-reset` event. Falls back to the shell's own Workspace/Assembler elements when not passed in.
- `dist/acp-chat-panel.js`: additive `AcpDynamicContainer.reset()`. Existing methods are unchanged.
- `dist/acp-chat-panel.d.ts`: `reset(): void` on `AcpDynamicContainer`.
- Docs: INTEGRATION_SPEC 7.11, SPEC_DOC section 5/mount-hide table/events, README, CHANGELOG, AGENT_GUIDE.

## Behavior
| Action | Result |
|---|---|
| New Chat | Workspace + Assembler closed, content cleared, transcript cleared, new conversation id |
| Close Chat (x or sidebar toggle) | Same as New Chat |
| Reopen Chat | Blank panel; earlier conversations in Recent chats |
| Next agent form after a reset | Workspace opens normally |
| User closes Workspace | Unchanged: explicit close is still respected |
