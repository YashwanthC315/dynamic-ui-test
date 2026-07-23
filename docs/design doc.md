# Structure
- Chat is a part of an existing sidebar, opens as sidebar within a sidebar
- It has three main zones stacked vertically: Header, Conversation Area (scrollable), and Composer/text input (sticky at bottom).
- When closed, the sidebar slides out of view completely.
- Supports manual resizing by dragging the left edge of the sidebar.

## Adopting design tokens
### Design Goal
Make the chat visually blend into any host website with zero or minimal custom CSS from the integrator.

### Core Strategy
Use CSS custom properties (design tokens) as the single source of truth for all visual decisions inside the chat.

### Main Tokens to Define

- Background colors (main panel, message bubbles, composer)
- Border and divider colors
- Text colors (primary, secondary, links)
- Accent/primary color (for buttons, user messages, active states)
- Border radius for bubbles, inputs, cards
- Shadow styles
- Spacing scale (small, medium, large)
- Typography (font family fallback, sizes)

# Submit Flow – Sending Prompt and Receiving Response

### Design Goal
Create a predictable, optimistic, and resilient flow that gives immediate feedback while keeping the UI responsive.

### Full Sequence (User Perspective)

1. User types message and submits (Enter or button).
2. Composer instantly clears and the user’s message appears in the conversation as a right-aligned bubble with “sent” status.
3. A placeholder assistant message appears on the left with a loading/typing indicator.
4. The prompt is sent to the backend.
5. When the response arrives, the placeholder updates with real content (text, blocks, etc.).
6. Status changes to completed. Composer becomes ready for the next input.

