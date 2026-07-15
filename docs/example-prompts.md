# Example Prompts and Chat Responses

Purpose: concrete prompt-response examples for the current board-plus-fee chat experience.

Legend:
- Available now: implemented and wired in current UI.
- Planned behavior: expected next behavior, not implemented yet.

## Board Home and Help

1. Prompt: "show board"
Response: "Opened the operations board home. Ask for any report, or say open fee collection to work on student receipts."
Status: Available now.

2. Prompt: "help"
Response: "Help: here are the most important commands..." with clickable buttons:
	- Show board
	- Show pending fees report
	- List fee defaulters
	- Open fee collection
	- What is selected
Status: Available now.

3. Prompt: "show pending fees report"
Response: "Pending Fees Report: Rs 3,10,500 outstanding, 48 defaulters across 6 sections..."
Status: Available now.

4. Prompt: "list fee defaulters"
Response: "Top defaulters view: Std X-B, Std IX-A, and B.Com A are currently highest outstanding..."
Status: Available now.

5. Prompt: "admissions summary"
Response: "Admissions summary: 28 students in directory ('20: 2, '21: 1, '22: 10, '23: 15). 28 enabled for fee collection."
Status: Available now.

6. Prompt: "student strength snapshot"
Response: "Student strength snapshot: 28 active students across 15 course sections. Program split: PUC 10, BBA 7, B.Com 6, BCA 5."
Status: Available now.

## Fee Collection Happy Path

1. Prompt: "open fee collection"
Response: Fee workspace becomes active and fee commands are routed to the fee form.
Status: Available now.

2. Prompt: "open receipt for 20P074"
Response: "Selected Chirag Jagadish (20P074)."
Status: Available now.

3. Prompt: "pick 23P112"
Response: "Selected Neha Rao (23P112)."
Status: Available now.

4. Prompt: "show latest receipt"
Response: "Latest receipt for <student>: <receipt no>, amount <amount>, paid on <date>."
Status: Available now when paid records exist.

5. Prompt: "show pending fees"
Response: "Opened Pending Fees tab for <student>."
Status: Available now.

6. Prompt: "set amount 500"
Response: "Amount received set to 500.00."
Status: Available now.

7. Prompt: "mode cash"
Response: "Payment mode set to Cash."
Status: Available now.

8. Prompt: "save transaction"
Response: "Transaction saved for <student> and moved to Fees Paid tab."
Status: Available now when validations pass.

## Duplicate Name Disambiguation

1. Prompt: "pick rahul"
Response: "I found multiple students: 1) Rahul K S (21P101); 2) Rahul Mehta (22P092); 3) Rahul Rao (23P102). Reply with option number, student name, or student ID."
Also returned as clickable buttons (one per student).
Status: Available now.

2. Prompt: click student button "3) Rahul Rao (23P102)"
Response: "Selected Rahul Rao (23P102)."
Status: Available now.

3. Prompt: "2" (after disambiguation)
Response: "Selected Rahul Mehta (22P092)."
Status: Available now.

4. Prompt: "Rahul Rao" (after disambiguation)
Response: "Selected Rahul Rao (23P102)."
Status: Available now.

5. Prompt: "23P102" (after disambiguation)
Response: "Selected Rahul Rao (23P102)."
Status: Available now.

6. Prompt: "ananya"
Response: "I found multiple students: 1) Ananya Rao (20P050); 2) Ananya Sharma (22P091); 3) Ananya Gupta (23P103). Reply with option number, student name, or student ID."
Also returned as clickable buttons.
Status: Available now.

## Validation and Recovery

1. Prompt: "set amount 0"
Response: "Amount must be greater than zero."
Status: Available now.

2. Prompt: "set amount abc"
Response: "Please provide a numeric amount, for example: set amount 500."
Status: Available now.

3. Prompt: "save" (without student)
Response: "Select a student first."
Status: Available now.

4. Prompt: "save" (without payment mode)
Response: "Select payment mode before saving."
Status: Available now.

5. Prompt: "save" (amount mismatch)
Response: "Amount mismatch: difference is <d>. Amount received must match selected pending total."
Status: Available now.

6. Prompt: "network timeout"
Response: "Network timeout noted. No duplicate save was performed. You can safely retry save."
Status: Available now.

## Out-of-Scope in Fee Form

1. Prompt: "what is the weather"
Response: "I can help only with fee collection and receipt actions in this screen..."
Status: Available now when routed to fee flow.

2. Prompt: "book a cab"
Response: "I can help only with fee collection and receipt actions in this screen..."
Status: Available now when routed to fee flow.

## Planned (Not Yet Implemented)

1. Prompt: "download receipt pdf"
Response: "This command is not available yet."
Status: Planned behavior.

2. Prompt: "show receipt for 2026-07-10"
Response: "This date-filtered receipt query is not available yet."
Status: Planned behavior.
