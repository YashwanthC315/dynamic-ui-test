# Fee Collection Form Chat Use Cases

Purpose: capture the implemented use cases for the current board-first chat and fee collection flow.
Scope: board routing, compact help actions, student disambiguation, fee actions, validation, and recovery.

## Board and Routing Use Cases

- User types "show board" and chat keeps Board Home active with board insight cards.
- User types "open fee collection" and chat switches workspace to the fee form.
- User types "show pending fees report" and chat returns board report summary with action buttons.
- User types "list fee defaulters" and chat returns defaulter summary with action buttons.
- User types "help" and chat returns only core clickable actions:
	- Show board
	- Show pending fees report
	- List fee defaulters
	- Open fee collection
	- What is selected
- Prompt catalog is not shown on the board; discovery is chat-first via help.

## Student Lookup and Disambiguation Use Cases

- User types only first name "rahul" and chat returns duplicate options with clickable student buttons.
- User can resolve duplicate student list by clicking a button.
- User can resolve duplicate student list by typing option number (for example, "2").
- User can resolve duplicate student list by typing student name (for example, "Rahul Rao").
- User can resolve duplicate student list by typing student ID (for example, "23P102").
- Duplicate response text explicitly allows number, student name, or student ID.
- User types unique full name and chat selects that student directly.
- User types valid full student ID and chat selects that student directly.

## Fee Collection Happy Path Use Cases

- User types "open receipt for 20P074" and chat selects that student.
- User types "show pending fees" and chat opens Pending Fees tab for selected student.
- User types "show paid" and chat opens Fees Paid tab for selected student.
- User types "set amount 500" and chat sets amount received to 500.00.
- User types "mode cash" and chat sets payment mode to Cash.
- User types "mode cheque" and chat sets payment mode to Cheque.
- User types "mode online" and chat sets payment mode to Online.
- User types "today receipt" and chat sets receipt date to today.
- User types "select all pending" and chat selects all pending fee rows.
- User types "clear selection" or "unselect all" and chat clears selected pending rows.
- User types "what is selected" and chat returns current student/form summary.
- User types "save" after valid setup and chat confirms transaction saved.

## Validation and Sanity Check Use Cases

- User types amount less than or equal to zero and chat replies amount must be greater than zero.
- User types non-numeric amount and chat requests numeric amount.
- User types "save" without student and chat replies "Select a student first".
- User types "save" without selected pending row and chat asks to select at least one pending fee.
- User types "save" without payment mode and chat asks to select payment mode.
- User types "save" with mismatch amount and chat shows exact difference.

## Out-of-Scope and Recovery Use Cases

- Out-of-scope fee commands (weather/cab/etc.) return fee-scope guidance when routed to fee flow.
- User types "backend lookup failed" and chat returns retry guidance.
- User types "student list failed to load" and chat suggests manual ID fallback.
- User types "network timeout" and chat confirms safe retry behavior.
- User types "retry save after timeout" and chat runs idempotency guard message.

## Current Constraints

- Prompt parsing is keyword/rule based (not model-intent based).
- Board help is intentionally compact and does not include "Pick rahul" as a clickable help option.
- Extended features such as receipt PDF export are not implemented yet.
