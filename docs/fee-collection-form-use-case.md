# Fee Collection Form Chat Use Cases

Purpose: capture realistic chat use cases before changing chat behavior.
Scope: student lookup, receipt intent, fee collection form intent, sanity checks, fallback behavior, and edge cases.
Format: one-line use cases that can later map to prompt rules, UX copy, and tests.
Naming rule: avoid aliases like "student A" and prefer student ID or full name plus disambiguation.

## Happy Path Use Cases

- User types "open receipt for 20P074" and chat opens the receipt flow for that exact student ID.
- User types a full student name and chat selects that exact student when a unique match exists.
- User types a valid student ID and chat directly selects that student without extra confirmation.
- User types "show latest receipt" after selecting a student and chat opens paid records for that student.
- User types "show pending fees" and chat switches to pending fee view for the selected student.
- User types "set amount 500" and chat prefills amount received with 500.
- User types "mode cash" and chat sets payment mode to cash.
- User types "mode cheque" and chat sets payment mode to cheque.
- User types "mode online" and chat sets payment mode to online.
- User types "today receipt" and chat keeps receipt date as today.
- User types "save transaction" after all required fields are valid and chat confirms save success.
- User types "clear selection" and chat resets selected pending fee choices.
- User types "select all pending" and chat checks all pending fee rows for the current student.
- User types "unselect all" and chat unchecks all selected pending rows.
- User types "how much is pending" and chat replies with total selected pending and total remaining pending.

## Name Search and Matching Use Cases

- User types only first name "ananya" and chat returns all matching students with IDs for disambiguation.
- User types only last name "rao" and chat returns all matching students with IDs and courses.
- User types "rahul" where multiple Rahuls exist and chat asks "Which student do you mean" with options.
- User types "rahul rao" and chat picks that exact person if it is a unique full-name match.
- User types "kiran" and chat shows both Kiran records when more than one exists.
- User types "sharma" and chat lists all Sharma students in deterministic order.
- User types mixed case "AnAnYa" and chat still matches case-insensitively.
- User types extra spaces "  nisha   rao  " and chat trims whitespace before matching.
- User types punctuation "rahul, rao" and chat normalizes punctuation and still matches.
- User types partial ID "23p1" and chat either suggests nearest IDs or asks for full ID.
- User types nickname "chiru" and chat says no confident match unless nickname mapping exists.
- User types transliterated variation and chat attempts soft matching if enabled, otherwise asks for exact name or ID.

## Duplicate First Name Use Cases

- User types "select ananya" and chat returns Ananya Rao, Ananya Sharma, and Ananya Gupta as numbered options.
- User chooses option number after duplicate prompt and chat selects that specific student.
- User types "open receipt for ananya in bca" and chat narrows duplicate results using course.
- User types "ananya 22p091" and chat resolves ambiguity immediately using the supplied ID.
- User types "ananya r" and chat asks for one more token because prefix is still ambiguous.

## Duplicate Last Name Use Cases

- User types "show rao students" and chat returns all Rao students with IDs and first names.
- User types "pick sharma" and chat asks for first name or student ID because multiple Sharma entries exist.
- User types "riya sharma" and chat selects exact match if unique.
- User types "mehta" and chat lists Rahul Mehta, Neha Mehta, and Aditya Mehta if present.
- User types "nair" and chat lists Arjun Nair, Pooja Nair, Riya Nair, and Vikram Nair when available.

## Context and Follow-up Use Cases

- User selects a student, then types "show paid" and chat uses currently selected student context.
- User types "set amount 750" after selecting student and chat updates only amount field.
- User types "change mode to online" and chat updates payment mode while preserving other inputs.
- User types "switch student to 23P112" and chat moves context to that student.
- User types "back to pending" and chat switches tab without losing form data.
- User types "what is selected" and chat summarizes selected student, amount, mode, and chosen pending fees.
- User types "undo last change" and chat rolls back one user action if undo stack is implemented.
- User types "start over" and chat resets fields but keeps student if reset policy says so.
- User types "start over completely" and chat resets all fields including selected student.

## Validation and Sanity Check Replies

- User types an amount less than or equal to zero and chat replies that amount must be greater than zero.
- User types non-numeric amount and chat replies with a numeric input hint.
- User types "save" without selecting student and chat replies "Select a student first".
- User types "save" without payment mode and chat replies "Select payment mode".
- User types "save" with amount mismatch and chat replies with exact difference value.
- User types "adjustment yes" when adjustment should be disabled and chat explains why it is unavailable.
- User types invalid date format and chat asks for date in expected format.
- User types future date beyond policy limit and chat asks for a valid receipt date.
- User attempts to save with no pending rows selected and chat asks user to select at least one pending fee.
- User sets amount greater than selected pending and chat suggests using adjustment only when rule allows.

## Wrong Question or Out-of-Scope Use Cases

- User asks unrelated question like weather and chat replies that it handles fee or receipt operations only.
- User asks "book a cab" and chat politely refuses and suggests fee-related commands.
- User asks "mass attendance" in fee-only mode and chat explains feature is not available in this screen.
- User asks "create exam timetable" and chat returns a narrow-scope guidance reply.
- User asks for system password and chat refuses sensitive operations.
- User asks to delete all data and chat asks for admin flow outside current UI.
- User asks unsupported report type and chat suggests available options.

## Error and Recovery Use Cases

- Backend lookup fails and chat replies with temporary issue message and retry suggestion.
- Receipt save fails and chat keeps form state intact for retry.
- Student list fails to load and chat offers manual ID entry fallback.
- Network timeout occurs and chat confirms no duplicate save was made.
- User repeats save after timeout and chat performs idempotency check before retry.
- Partial update error occurs and chat asks user to refresh affected student data.

## Data Quality Use Cases

- Student has no pending fees and chat says "No pending fees for this student".
- Student has no paid history and chat says "No paid records yet".
- Student record missing course and chat displays fallback like "Course not available".
- Pending fee row has missing due date and chat displays "Due date not available".
- Duplicate pending fee lines appear and chat groups or flags duplicates per rule.

## Prompt Robustness Use Cases

- User sends very short prompt "paid" and chat interprets as tab switch using current context.
- User sends long sentence with extra words and chat extracts the core actionable intent.
- User sends all caps prompt and chat handles it case-insensitively.
- User sends prompt with typos like "fe colletcion" and chat uses fuzzy intent matching when confidence is high.
- User sends multiple commands in one line and chat executes in sequence or asks for confirmation.
- User sends contradictory command like "show paid and pending" and chat asks user to pick one.
- User sends command in local language phrase and chat replies with unsupported language guidance if localization is absent.

## Accessibility and UX Use Cases

- User submits empty prompt and chat does not send, then keeps input focused.
- User presses Enter in chat input and command is submitted once.
- User clicks quick command chip and chat logs it as a user message.
- Chat history autoscrolls to newest message while preserving manual scroll behavior.
- Chat shows concise actionable replies, not verbose paragraphs, for routine updates.
- Chat response includes next step suggestion when validation fails.

## Operational Logging Use Cases

- Each prompt stores timestamp, user text, and assistant response for audit trail.
- Validation errors are tagged with reason codes for analytics.
- Ambiguity events are logged to improve student matching rules.
- Repeated fallback prompts are logged as potential missing intents.
- Save success and save failure events are captured for monitoring.

## Performance Use Cases

- Student search remains responsive with 30 plus students.
- Chat reply stays under target latency for local parsing.
- Large chat history remains scrollable without UI freeze.
- Rapid repeated commands do not create duplicate state updates.
- Debounced search avoids excessive filtering calls while typing.


## Deferred Use Cases (Not Testable In Current Setup)

- Security and safety scenarios are deferred until backend integration and access controls are available.
- User attempts script injection in prompt and chat treats it as plain text.
- User enters SQL-like string and chat does not execute or echo risky operations.
- User asks to expose hidden student data and chat only returns permitted fields.
- User asks to bypass validation and chat refuses non-compliant action.
- User asks for internal tokens or secrets and chat refuses.

## Future-Ready Use Cases

- User asks for receipt PDF and chat can route to export flow when feature is added.
- User is able to view multiple forms
- User types "help", "commands", or "what can you do"
- User asks "how do I [action]"
- "Generate receipt", "print receipt", "download PDF", or "export receipt"
- "Show receipt for [specific date]" or "receipt number XXXX".
- 
