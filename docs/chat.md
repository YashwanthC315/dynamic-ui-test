# Chat Architecture and UX Direction

## Purpose

This document describes how to evolve the current chat experience into an agentic, context-aware, platform-agnostic assistant that can work across products like Campus Track, fee collection, student operations, and future modules.

The goal is not just to answer questions. The goal is to:

- understand where the user is
- understand who the user is
- understand what just happened
- route the request to the right agent or workflow
- return an answer in the right UI shape, not only plain text

## Recommended Direction

Use a **hybrid model**:

- a **generic chat shell** at the application level
- a **context router** that decides which agent should answer
- a **screen-level context** when the chat is opened inside a specific area
- an **explicit AI mode** the user can enter, with optional implicit suggestions

This gives us flexibility without making the experience confusing.

### Why hybrid is the best default

- Generic chat alone is too broad and loses context.
- Screen-specific chat alone becomes fragmented and hard to maintain.
- A hybrid approach lets the same UI work across Campus Track, fee collection, student views, and future systems.

## What the System Should Do

The chat should be able to:

- answer general questions
- answer screen-specific questions
- remember the current conversation and selected context
- switch between agents depending on location or user intent
- show actions as buttons instead of only plain text
- open forms, tabs, or workflows dynamically
- adapt to policy, role, and recent activity

### Example outcomes

- In fee collection, the chat uses the fee agent.
- In student management, the chat uses the student agent.
- In Campus Track, the same shell can feel native because it uses the platform's design tokens and context.
- After an exam period ends, the assistant can proactively suggest reports instead of waiting for a request.

## How Context Routing Should Work

The assistant should not blindly answer everything with one model prompt. It should first resolve context.

### Context inputs

- current app or module
- current screen or route
- current form or tab
- user role and permissions
- recent activity
- time-sensitive events
- conversation history
- selected entity, such as a student, fee record, or receipt
- policy constraints

### Routing decision

The system should decide:

1. Is this a general question or a workflow action?
2. Is the request relevant to the current screen?
3. Which agent owns this domain?
4. Which tools can the agent use?
5. Should the chat respond with text, buttons, a form, or a navigation event?

### Recommended routing rule

Prefer the following order:

1. **Current screen agent**
2. **Current app agent**
3. **Fallback general assistant**

That keeps the chat relevant without making it too restrictive.

## Explicit vs Implicit AI Mode

This is one of the biggest product decisions.

### Option 1: Explicit mode

The user clicks or toggles into AI mode before chatting.

Pros:

- clear intent
- lower surprise
- easier policy control
- easier to separate normal UI from agent actions

Cons:

- one extra step
- less seamless

### Option 2: Implicit mode

The assistant appears automatically in the context of the page.

Pros:

- faster
- feels more integrated
- better for workflow guidance

Cons:

- can feel invasive
- needs strong routing and guardrails

### Recommendation

Use a **hybrid entry model**:

- keep a visible AI entry point
- allow the user to explicitly open AI mode
- also surface contextual suggestions when the system is confident

This answers both needs:

- "kind of login to this first" -> user enters AI mode
- "based on where the user is" -> system can still pre-route and suggest

## Conversation History

Conversation history should be first-class, not an afterthought.

### What history should contain

- user message
- assistant response
- selected context at that moment
- active screen or form
- agent used
- actions taken
- timestamps

### Why it matters

- the user can return to previous conversations
- the system can continue a thread without losing context
- the UI can show prior choices and decisions
- the assistant can avoid repeating itself

### How to expose it

The chat should include:

- a history list or sidebar
- tabs for recent conversations
- a way to jump back into a thread
- a visual indicator of the current active context

### When switching context

If the user changes form, tab, or screen, the system should decide whether to:

- continue the same thread
- fork into a new thread
- preserve only global memory, not local workflow state

Recommended rule:

- keep a **global conversation memory**
- create **context-specific subthreads** per workflow or screen

That way, the assistant remembers the user, but the workflow remains clean.

## Dynamic UI Component

The current chat mainly renders text and simple quick commands. The next version should support richer response types.

### Response types

- plain text
- quick action buttons
- suggested next steps
- field chips
- embedded forms
- tab switches
- confirmation dialogs
- warnings or validation messages

### Why buttons matter

Text-only replies force the user to retype actions.
Buttons reduce friction and make the assistant feel more agentic.

Examples:

- "Open student profile"
- "Show pending fees"
- "Create receipt"
- "Switch to paid tab"
- "Use Rahul"

This is especially useful when the chat replies with options instead of a single answer.

## Dynamic Forms

The assistant should be able to create or update forms dynamically when needed.

### What that means

The chat can return a form schema instead of only text.

Example use cases:

- receipt creation
- fee selection
- student lookup
- report filters
- approval workflows

### What happens when forms switch

When the user changes from one form to another:

- preserve safe state only if it still applies
- discard incompatible inputs
- tell the user what was kept and what was reset

Example:

- if the user moves from fee entry to student details, keep the selected student
- if the user changes to a different student, reset fee-specific fields

This avoids confusing partial state.

## State Management

The chat needs a dedicated state model, not just a message array.

### Suggested state layers

- `conversationState`
- `contextState`
- `screenState`
- `formState`
- `agentState`
- `policyState`

### Why this matters

Without separate state layers, context switching becomes brittle.

If everything is stored in one blob, the UI will not know:

- what belongs to the current page
- what belongs to the conversation
- what should survive a tab switch
- what should be reset

## Policy-Aware Behavior

You mentioned "based on policy" and that should be treated as a first-class rule set.

Policy should control:

- which agents can run
- which actions are allowed
- which fields are visible
- whether the assistant can auto-act or only suggest
- whether a workflow needs user confirmation

### Example

If policy says a fee action requires confirmation:

- the assistant should show a confirm button
- it should not execute immediately

If policy says a report can be suggested after an exam period:

- the assistant should proactively offer the report button

## Platform Agnosticism

The AI layer should be decoupled from Angular, React, or any specific UI framework.

### Recommendation

Use a configuration-driven contract:

- JSON
- key-value configuration
- screen metadata
- design tokens
- agent registry

The frontend framework should only render the contract.

### What should be configurable

- app name
- screen name
- agent id
- available tools
- allowed actions
- message styles
- theme tokens
- workflow schemas
- fallback behavior

### Why this helps

It makes the same assistant usable in:

- Angular
- React
- Vue
- plain web apps
- Campus Track or any future platform

## Design Tokens

You mentioned design tokens, and that is the right direction.

The assistant should inherit the host platform's visual identity instead of looking like a separate chatbot widget.

### Token categories

- colors
- typography
- spacing
- border radius
- shadows
- elevation
- icon style
- motion
- density

### Desired outcome

If embedded in Campus Track, the chat should feel like part of Campus Track.

If embedded in another platform, it should adapt to that product without custom CSS rewrites.

## Agent Model

The assistant should use an **agentic harness**.

That means each domain gets its own agent, with a shared orchestration layer.

### Example agents

- fee agent
- student agent
- attendance agent
- report agent
- general campus assistant

### Why separate agents help

- each agent can stay focused
- policies are easier to enforce
- tools are smaller and safer
- prompts are easier to maintain
- responses are more accurate in domain-specific flows

### How the harness should choose an agent

The router can look at:

- current screen
- user intent
- selected entity
- policy
- confidence score

If the confidence is high, route directly.
If not, show the user a choice.

## What the User Will Do

The user should not have to think about internals.

### User flow

1. Open the relevant app or screen.
2. Enter AI mode, or accept a contextual suggestion.
3. Ask a question or choose a quick action.
4. The assistant resolves context and selects an agent.
5. The assistant returns either:
   - an answer
   - a set of buttons
   - a form
   - a workflow transition
6. The user continues with fewer manual steps.

### Good user behaviors to support

- ask a question in plain language
- click suggested actions
- go back to previous conversation
- switch form or tab without losing the entire conversation
- resume where they left off

## What the Developer Will Build

From an implementation point of view, this should become a few reusable pieces.

### Core pieces

- chat shell UI
- conversation store
- context resolver
- agent registry
- policy engine
- response renderer
- form renderer
- design-token adapter

### Suggested contract

The frontend receives a normalized response like:

```json
{
  "conversationId": "conv_123",
  "agentId": "fee-agent",
  "message": "Select a student first.",
  "actions": [
    { "type": "button", "label": "Pick Rahul", "value": "pick rahul" }
  ],
  "forms": [],
  "context": {
    "app": "Campus Track",
    "screen": "Fee Collection",
    "entityId": "20P074"
  }
}
```

The UI should render that contract consistently across platforms.

## What Should Happen on Context Switching

This is one of the most important UX behaviors.

### If the user changes tabs

- keep the current conversation thread
- update the active context
- tell the user what changed

### If the user changes form

- preserve shared context
- reset incompatible local fields
- show a short state summary

### If the user changes entity

- either fork the context or explicitly ask if they want to continue with the new entity

### If the user changes screen

- route to a different agent if needed
- preserve the conversation history
- keep the UI feeling continuous

## Making Replies More Useful

Right now, replies are mostly text. The next step is to make replies actionable.

### Recommended enhancements

- turn common replies into buttons
- show next-step chips after every validation
- summarize the current state at the top of the thread
- provide "back to previous conversation" controls
- show history breadcrumbs
- expose "continue this flow" prompts

### Examples

- Instead of: "I found multiple students"
- Return: buttons for each student, plus a search refinement button

- Instead of: "Select payment mode"
- Return: mode buttons

- Instead of: "No pending fees found"
- Return: buttons for "show paid", "change student", "view report"

## Campus Track Fit

If this is integrated into Campus Track, the assistant should behave like a native part of the product.

### Implications

- same layout language
- same design tokens
- same terminology
- same permission model
- same reporting vocabulary

### Result

The assistant should feel like:

- "part of Campus Track"
- not "an external chatbot bolted on top"

## How to Expand Later

The system should be designed so new agents and new workflows can be added without rewriting the UI.

### Examples of future expansion

- more screen-specific agents
- cross-app workflows
- proactive suggestions based on time or policy
- richer forms
- document generation
- report generation
- approvals

## Practical Recommendation

If we need a single sentence decision:

**Build a generic chat shell with screen-aware routing, agent-specific backends, policy-aware actions, and dynamic response rendering.**

That gives us:

- platform agnosticism
- context awareness
- time awareness
- richer UI
- reusable architecture

## Open Questions To Resolve Next

- Should AI mode be explicit, implicit, or hybrid by default?
- Which state should survive a form switch?
- Should history be global, screen-specific, or both?
- Which actions are safe to auto-run and which need confirmation?
- What is the JSON contract for responses?
- What tokens are required to make the assistant inherit the host design system?
- Which agents are mandatory for v1?

## Suggested v1 Scope

For a first version, keep it focused:

- generic chat shell
- agent routing by screen
- conversation history
- quick action buttons
- basic form rendering
- design-token support
- policy-aware confirmations

That is enough to validate the approach without overbuilding.

