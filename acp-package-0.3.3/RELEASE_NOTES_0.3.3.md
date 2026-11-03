# @acp/chat-panel v0.3.3 Release Notes

## Summary
Fixed a CSS issue where the Workspace pane was opening on the right side instead of the left. Removed unnecessary `order` properties that conflicted with the built-in flexbox layout.

## Fixes
1. **Workspace positioning** — Removed `order: 0` from `.acp-workspace__surface` and `order: 1` from `.acp-workspace__actions` in the CSS. These properties were causing the surface layer to reorder incorrectly, making Workspace open on the right side. The package now uses `justify-content: flex-start` and natural DOM order for consistent left-edge docking.

## Documentation
- Updated **INTEGRATION_SPEC.md** section 13 ("Stable dock order") with a warning against adding CSS `order` properties to workspace surface elements. The note explains that the built-in layout uses flexbox `justify-content: flex-start` and DOM order, and custom `order` properties will break positioning.

## Verification
- ✅ All 36 enrollment submission regression tests pass  
- ✅ Workspace opens on the left beside Chat  
- ✅ Assembler pane positioning is unaffected  
- ✅ No CSS or layout regressions from v0.3.2  

## Version Bump
- `package.json`: v0.3.3  
- `config-manifest.json`: v0.3.3  
- `README.md`: v0.3.3  

## What's Included
- `dist/acp-chat-panel.js` with workspace CSS fixes  
- `dist/acp-harness-bridge.js` (unchanged from v0.3.2)  
- Updated `AGENT_GUIDE.md` with workspace ordering clarification  
- All styles, tokens, tests, and documentation  

## No Breaking Changes
- All existing APIs remain unchanged  
- All form submission and enrollment features from v0.3.2 are preserved  
- Date parsing from v0.3.2 continues to work  
- Help button removal from v0.3.2 is maintained  

---
**Package Size:** 70 KB (compressed tgz)  
**Build Status:** ✅ Syntax validated, regression tests pass  
**Browser Support:** All modern browsers with Web Components and flexbox support
