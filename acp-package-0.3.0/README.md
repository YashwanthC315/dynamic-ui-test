# @acp/chat-panel (v0.3.0)

Framework-agnostic chat, dynamic workspace, Buddy enrollment surface, and Assembler (activity) pane delivered as browser custom elements. Angular and other modern web applications can use the package without compiling its components.

## v0.3.0 Changes and Verification Status

Workspace width, height, corner, and keyboard resizing update geometry without recreating the form DOM. Host dimension write-backs also leave the fields intact. The form body and Buddy instance stay mounted across minimize/restore, maximize/restore, menu changes, and close/reopen. Equivalent form specifications no longer reset entered values. A new form specification or information surface still intentionally replaces content.

Assembler no longer reopens merely because Workspace opens, new activity is prepended, and activity-log surfaces restore a minimized Assembler. The connector respects explicit Workspace closure. Standard numeric fields apply the spec's minimum and maximum constraints.

The reusable sources live under `src/app/agent-chat-panel/components/agent-chat-panel.elements.js` and `src/app/agent-chat-panel/services/acp-harness-bridge.js` in the source repository. They retain the existing universal adapter and apply the original Angular component's geometry-only resizing approach. The Angular component and host integration are not replaced. Run `scripts/package-agent-chat-panel.ps1 -Version 0.3.0` from that repository to copy these sources into this release and produce the archive without running lifecycle scripts.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full shell integration and [SPEC_DOC.md](./SPEC_DOC.md) for element and event contracts.
