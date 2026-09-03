# ACP Theme Contract

The `acp-*` class names are the public visual contract between the package and the host application.

The package owns structure and interaction. The host application owns the final visual values.

## Selectors

| Selector | Responsibility |
|---|---|
| `.acp-panel` | Overall panel surface, typography, border |
| `.acp-header` | Header height, background, border, padding |
| `.acp-header__title` | Header title typography |
| `.acp-header__actions` | Header action layout |
| `.acp-icon-button` | Header action button appearance |
| `.acp-messages` | Conversation viewport |
| `.acp-message` | Message spacing/alignment |
| `.acp-message--user` | User-message alignment/variant |
| `.acp-message__bubble` | Message bubble surface and typography |
| `.acp-message__time` | Timestamp styling |
| `.acp-empty-state` | Empty conversation state |
| `.acp-composer` | Composer surface and separator |
| `.acp-input` | Message textarea |
| `.acp-composer__bottom` | Composer footer layout |
| `.acp-counter` | Character counter |
| `.acp-send` | Send action |
| `.acp-resize-handle` | Resize affordance |

## Design-token principle

Prefer existing application tokens:

```css
.acp-panel {
  color: var(--app-text-primary);
  background: var(--app-surface);
  border-color: var(--app-border);
}
```

The package should not become the owner of application-wide tokens. If the host uses SCSS maps, utility classes, CSS variables, or another token mechanism, adapt the ACP selectors to that existing mechanism.
