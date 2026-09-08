# @acp/chat-panel

A small, directly installable chat-panel package for Angular 22 applications. It exposes a native custom element so the package does not require the host application's Angular compiler configuration to build the panel.

The component is designed to live **inside the application's layout**, beside routed content. It is not an overlay, modal, floating drawer, or fixed-position chat window.

## Install

After making the supplied folder into an npm tarball:

```bash
npm install ./acp-chat-panel-0.1.1.tgz
```

## Angular 22 integration

## Minimum requirements
- **Angular:** v22 (host application built with Angular 22). Older or newer major versions are not tested — verify compatibility before use.
- **TypeScript:** Compatible with the TypeScript version used by Angular 22 projects.
- **Framework integrations:** The package is framework-agnostic beyond the custom element API; it does **not** require NgRx, Angular Material, or other state/UI frameworks. If your app uses NgRx or other state managers, integrate `messages` with your store as the host owns the message array.
- **Build setup:** Host must allow importing package CSS into the global styles (or copy `theme.css`/`styles.css` into global styles). Register the custom element once via `import '@acp/chat-panel'` in a file executed on bootstrap.
- **Browser support:** Depends on browsers supported by your Angular build; if supporting older browsers, ensure custom elements / web component polyfills are included.

## Launch button

The package does not own the host application's sidebar. Add one chat action to the existing sidebar and toggle `chatOpen` from that control. Do not create a second floating launch button.

Do not modify the package JavaScript just to apply application branding.

## Agent guide

Provide the below agent guide to the agent and give the prompt 
```bash
Integrate the installed acp-chat-panel to the application using the provided agent guide
```

See [`AGENT_GUIDE.md`](./AGENT_GUIDE.md) for the integration procedure and acceptance checklist.
