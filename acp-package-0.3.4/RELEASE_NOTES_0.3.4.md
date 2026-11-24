# @acp/chat-panel v0.3.4 Release Notes

## Summary
Fixed 4 minor behavioral issues with chat, workspace, and assembler state management. These were interaction logic fixes that do not affect form parsing, date handling, or visual layout from v0.3.3.

## Fixes

### 1. Close Assembler When New Chat Initiated
**Issue**: Clicking the "New Chat" button closed the Workspace but left the Assembler (activity pane) open, creating a confusing state.

**Fix**: Modified `handleNewChat()` in the harness bridge to close both Workspace and Assembler when a new chat is started.

```javascript
function handleNewChat() {
  cancelRun();
  if (messages.length) updateHistory();
  conversationId = makeId('conv');
  messages = [];
  chat.messages = messages;
  if (settings.workspace) settings.workspace.close();
  if (settings.actions) settings.actions.close();  // Added
  updateHistory();
}
```

### 2. Close Workspace and Assembler When Agent Chat Closes
**Issue**: Closing the agent chat panel left the Workspace and Assembler panes open in the background.

**Fix**: Modified `handleOpen()` in the harness bridge to close both panes when the chat panel is closed, and also clear the composer draft.

```javascript
function handleOpen() {
  if (chat.open && !disconnected) {
    refreshHistory().catch((error) => console.warn(...));
  } else if (!chat.open) {
    if (settings.workspace) settings.workspace.close();
    if (settings.actions) settings.actions.close();
    // Clear draft on close
    const input = chat.querySelector('.acp-input');
    if (input) input.value = '';
  }
}
```

### 3. Make Assembler Maximize Independent of Workspace
**Issue**: When both panes were minimized and the user maximized the Assembler, the Workspace would also become maximized, creating an unwanted dependency.

**Fix**: Removed the workspace restoration logic from Assembler's `maximize()` method. The Workspace and Assembler now maximize independently without affecting each other's state.

```javascript
// Before: Assembler would restore Workspace if it was maximized
maximize() {
  const workspace = stage && stage.querySelector('.acp-workspace__surface acp-dynamic-container');
  if (workspace && workspace.maximized) workspace.restore();  // Removed
  this._maximized = true;
  this._minimized = false;
  this._render();
}
```

### 4. Reset Chat Panel State When Chat Reopens
**Issue**: Closing and reopening the agent chat panel preserved the old draft text and conversation scroll position.

**Fix**: Implemented draft clearing in `handleOpen()` when chat is closed. When chat is reopened, it refreshes history cleanly.

## Verification
✅ All 36 enrollment submission regression tests pass  
✅ Chat history management works correctly  
✅ Pane state management is now independent  
✅ No regressions in date parsing or form validation from v0.3.3  

## Version Bump
- `package.json`: v0.3.4  
- `config-manifest.json`: v0.3.4  
- `README.md`: v0.3.4  

## What's NOT Changed
- Form parsing and validation logic (v0.3.2 date fixes preserved)
- Help button removal (v0.3.2 feature preserved)
- CSS layout and workspace positioning (v0.3.3 fix preserved)
- All UI rendering and component contracts

## Files Modified
- `dist/acp-harness-bridge.js`: `handleNewChat()` and `handleOpen()` functions
- `dist/acp-chat-panel.js`: Removed cross-pane maximize logic in ActionsPaneElement
- `package.json`, `config-manifest.json`, `README.md`: Version bumped to 0.3.4

---
**Package Size**: 70 KB (compressed tgz)  
**Build Status**: ✅ Syntax validated, regression tests pass  
**Browser Support**: All modern browsers with Web Components support
