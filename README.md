# Dynamic UI Test (Angular)

This repository contains a chat-driven operations UI built with Angular. The left panel is a reusable chat component, and the right panel currently hosts a dedicated fee collection form component.

Current goal: focus on one production-like workflow (fee collection) while keeping chat independent for site-wide reuse.

## Current Scope

The app currently focuses on:

- Fee Collection

The chat drives the fee collection workflow by interpreting predefined commands.

## Component Structure

- `ChatPanelComponent`: generic/reusable chat UI and message input/output
- `FeeCollectionFormComponent`: fee collection form state and transaction logic
- `AppComponent`: orchestration layer that routes chat prompts to the fee form

## Example Prompts

Use quick commands or type prompts in chat, such as:

- `pick student a`
- `set amount 500`
- `mode cash`
- `show paid tab`

## Prompt Interpretation (Current Logic)

Prompt matching is keyword-based inside the fee collection component:

- Student selection by phrases like `student a` or explicit IDs like `20p074`
- Payment mode shortcuts: `cash`, `cheque`, `online`
- Amount parsing from numeric prompts
- Tab switching commands: `show paid tab`, `show pending tab`

Additional behavior:

- Unknown prompts return a fee-focused guidance message in chat.

## Fee Collection Features

- Student search and selection
- Pending vs paid fee tabs
- Amount and payment mode handling
- Save validation (amount must match selected pending total)

## Run Locally

Prerequisites:

- Node.js and npm installed

Steps:

1. Install dependencies:

	 ```bash
	 npm install
	 ```

2. Start dev server:

	 ```bash
	 npm start
	 ```

3. Open in browser:

	 `http://localhost:4200/`

The app hot-reloads on file changes.

## Helpful Commands

- Run tests:

	```bash
	npm test
	```

- Build production bundle:

	```bash
	npm run build
	```

## Current Limitations

- Prompt parsing is rule/keyword based, not model-based intent parsing.
- Chat and fee form are connected in-memory through the root component.
- No persistence layer or backend orchestration is connected yet.

## Next Enhancements

- Add richer intent extraction for fee collection commands and validation feedback.
- Add API integration for student search, pending fees, and receipt save operations.
- Reuse `ChatPanelComponent` in other pages and connect via a shared chat service.
