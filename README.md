# Dynamic UI Test (Angular)

This repository contains a simple Angular UI prototype with:

- A chat-like input panel for natural language prompts.
- Keyword-based prompt parsing (for now) to detect form requests.
- Dynamic loading of prebuilt forms into the main content area.
- Replacement behavior: loading a new form replaces the currently visible form.

This aligns with your current phase before integrating a real agent backend.

## Implemented Forms

The app includes these prebuilt forms:

- Payslip Request Form
- Personal Details Form
- Address Update Form
- Leave Request Form

Example prompts you can type in chat:

- `fetch me form for payslip`
- `show details form`
- `load address form`
- `open leave form`

## How Prompt Matching Works

The app currently uses simple natural-language keyword detection in the frontend.

- `payslip` or `salary` -> Payslip Request Form
- `detail`, `personal`, or `profile` -> Personal Details Form
- `address` or `location` -> Address Update Form
- `leave`, `vacation`, or `time off` -> Leave Request Form

If no keyword matches, the assistant responds with a guidance message in the chat log.

## Run Locally (localhost)

Prerequisites:

- Node.js and npm installed

Steps:

1. Install dependencies:

	```bash
	npm install
	```

2. Start dev server on localhost:

	```bash
	npm start
	```

3. Open:

	`http://localhost:4200/`

The app hot-reloads as you edit files.

## Helpful Commands

- Run tests:

  ```bash
  npm test
  ```

- Build production bundle:

  ```bash
  npm run build
  ```

## Current Limitations and Next Step

- Current behavior supports one active form at a time (replacement model).
- A future enhancement can maintain multiple forms simultaneously in tabs or stacked cards.
- Another future enhancement is replacing keyword parsing with an agent/API-driven intent resolver.
