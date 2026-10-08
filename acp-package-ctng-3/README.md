# @acp/chat-panel (v0.2.3)

Framework-agnostic chat panel, dynamic workspace, Buddy enrollment surface, and Actions pane delivered as browser custom elements. It works with Angular applications of any version and modern web applications without requiring the host application's Angular compiler to build the panel.

The panel is designed to live **inside the application's layout**, beside routed content. It is not an overlay, modal, floating drawer, or fixed-position chat window.

## Install

```bash
npm install ./acp-chat-panel-0.2.3.tgz
```

## What's New in v0.2.3

- Refreshed release package with the complete 0.2.2 custom-element runtime, type declarations, styles, and integration documentation.
- No public API changes; existing chat, workspace, Buddy, and Actions functionality remains compatible.

The package UI is host-agnostic. Backend transport, conversation persistence, application state, and navigation remain owned by the integrating application.

## Integration Requirements

- Use the Node.js, npm, and TypeScript versions supported by the host application's toolchain.
- Angular hosts may need `CUSTOM_ELEMENTS_SCHEMA` where custom elements are used.
- Load the package styles globally and register the elements once with `import '@acp/chat-panel'` during application bootstrap.
- For older browsers, ensure custom elements support is available.

The host application owns the single AI chat toggle in its existing vertical sidebar. The button toggles the panel's `open` property; the package does not render a sidebar or launch button.

See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the integration procedure and acceptance checklist. The property and event contract is documented in [SPEC_DOC.md](./SPEC_DOC.md).
