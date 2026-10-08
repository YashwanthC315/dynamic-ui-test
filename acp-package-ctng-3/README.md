# @acp/chat-panel

A directly installable browser Custom Elements package, with an integration guide targeting Angular 22. The standalone bundle does not require Angular to render the panel. A full Angular 22 build has not been verified.

The component is designed to live **inside the application's layout**, beside routed content. It is not an overlay, modal, floating drawer, or fixed-position chat window.

## Install

Copy the package into the target app folder and install it

```bash
npm install ./acp-chat-panel-0.2.3.tgz
```

## Angular 22 integration

## Minimum requirements
- **Angular:** The guide targets a standalone Angular 22 host; verify compatibility in the target application before deployment.
- **Node.js:** Use the versions supported by your target Angular release. The browser bundle itself does not require Node.js at runtime.
- **npm:** npm 10+ recommended.
- **TypeScript:** Compatible with the TypeScript version used by Angular 22 projects.
- **Framework integrations:** The package is framework-agnostic beyond the custom element API; it does **not** require NgRx, Angular Material, or other state/UI frameworks. If your app uses NgRx or other state managers, integrate `messages` with your store as the host owns the message array.
- **Build setup:** Load `@acp/chat-panel/dist/styles.css` in global styles. Register the custom elements once via `import '@acp/chat-panel'` in browser bootstrap, not during server-side rendering.
- **Browser support:** Depends on browsers supported by your Angular build; if supporting older browsers, ensure custom elements / web component polyfills are included.

## Launch button

Appears in the sidebar and clicking it opens the chat panel

## Agent guide

Provide the below agent guide to the agent and give the prompt 
```bash
Integrate the installed acp-chat-panel to the application using the provided agent guide
```

See [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) for the integration procedure and acceptance checklist.

Keep Chat, Workspace, Assembler, and routed content as direct flex siblings.
Do not collapse Assembler from a Workspace maximize event. The supplied styles
stack panes on narrow screens and preserve scrolling when minimum widths cannot fit.

## Source snapshot and verification

The `src/app/agent-chat-panel` folder preserves all 55 current Angular 7 feature
files, including file-run transport/store changes. This is a separate source
integration requiring host dependencies, not part of the standalone browser API.
See [the source portability guide](./docs/agent-chat-panel-portability-guide.md).

From the originating repository, run `npm --prefix acp-package-0.2.3 run verify`.
Open `tests/regression.html` in a browser and run `runRegressionChecks()` to
exercise the shipped bundle and stylesheet. Backend-authenticated workflows
and full Angular 22 compilation require validation in the target host.
