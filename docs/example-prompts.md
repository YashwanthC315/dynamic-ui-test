# Example Prompts and Chat Responses

Purpose: provide concrete prompt-response examples for each use-case category in the fee collection chat.

Legend:
- Available now: can be handled in current chat setup.
- Planned behavior: expected response pattern, not fully implemented yet.
- Deferred: intentionally out of scope in current setup.

## Happy Path Use Cases

1. Prompt: "open receipt for 20P074"
Response: "Selected Chirag Jagadish (20P074)."
Status: Available now.

2. Prompt: "pick rahul rao"
Response: "Selected Rahul Rao (23P102)."
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

8. Prompt: "mode cheque"
Response: "Payment mode set to Cheque."
Status: Available now.

9. Prompt: "mode online"
Response: "Payment mode set to Online."
Status: Available now.

10. Prompt: "today receipt"
Response: "Set receipt date to <today date>."
Status: Available now.

11. Prompt: "save transaction"
Response: "Transaction saved for <student> and moved to Fees Paid tab."
Status: Available now when validations pass.

12. Prompt: "clear selection"
Response: "Cleared all selected pending fee rows."
Status: Available now.

13. Prompt: "select all pending"
Response: "Selected all pending fee rows (<count>)."
Status: Available now.

14. Prompt: "unselect all"
Response: "Cleared all selected pending fee rows."
Status: Available now.

15. Prompt: "how much is pending"
Response: "Selected pending total: <x>. Overall pending total: <y>."
Status: Available now.

## Name Search and Matching Use Cases

1. Prompt: "ananya"
Response: "I found multiple students: 1) Ananya Rao (20P050); 2) Ananya Sharma (22P091); 3) Ananya Gupta (23P103). Reply with option number or student ID."
Status: Available now.

2. Prompt: "rao"
Response: "I found multiple students: <options>. Reply with option number or student ID."
Status: Available now.

3. Prompt: "rahul"
Response: "I found multiple students: Rahul K S, Rahul Mehta, Rahul Rao. Reply with option number or student ID."
Status: Available now.

4. Prompt: "rahul rao"
Response: "Selected Rahul Rao (23P102)."
Status: Available now.

5. Prompt: "kiran"
Response: "I found multiple students: Kiran Rao, Kiran Iyer. Reply with option number or student ID."
Status: Available now.

6. Prompt: "sharma"
Response: "I found multiple students: Ananya Sharma, Riya Sharma, Rohan Sharma, Karthik Sharma. Reply with option number or student ID."
Status: Available now.

7. Prompt: "AnAnYa"
Response: "I found multiple students: <options>. Reply with option number or student ID."
Status: Available now.

8. Prompt: "  nisha   rao  "
Response: "Selected Nisha Rao (23P107)."
Status: Available now.

9. Prompt: "rahul, rao"
Response: "Selected Rahul Rao (23P102)."
Status: Available now.

10. Prompt: "23p1"
Response: "Did you mean pick 23P112? Reply yes or no."
Status: Planned behavior.

11. Prompt: "chiru"
Response: "No confident student match found. Try full name or student ID."
Status: Planned behavior.

12. Prompt: "rahool rao"
Response: "Did you mean Rahul Rao (23P102)? Reply yes or no."
Status: Planned behavior.

## Duplicate First Name Use Cases

1. Prompt: "select ananya"
Response: "I found multiple students: 1) Ananya Rao (20P050); 2) Ananya Sharma (22P091); 3) Ananya Gupta (23P103). Reply with option number or student ID."
Status: Available now.

2. Prompt: "2"
Response: "Selected Ananya Sharma (22P091)."
Status: Available now after disambiguation list.

3. Prompt: "open receipt for ananya in bca"
Response: "Selected Ananya Gupta (23P103)."
Status: Available now when course token narrows uniquely.

4. Prompt: "ananya 22p091"
Response: "Selected Ananya Sharma (22P091)."
Status: Available now.

5. Prompt: "ananya r"
Response: "I found multiple students: <options>. Reply with option number or student ID."
Status: Available now.

## Duplicate Last Name Use Cases

1. Prompt: "show rao students"
Response: "Matched students: 1) Ananya Rao (20P050); 2) Kiran Rao (22P094); 3) Rahul Rao (23P102); 4) Nisha Rao (23P107); 5) Neha Rao (23P112)."
Status: Available now.

2. Prompt: "pick sharma"
Response: "I found multiple students: <options>. Reply with option number or student ID."
Status: Available now.

3. Prompt: "riya sharma"
Response: "Selected Riya Sharma (22P093)."
Status: Available now.

4. Prompt: "mehta"
Response: "I found multiple students: Rahul Mehta, Neha Mehta, Aditya Mehta. Reply with option number or student ID."
Status: Available now.

5. Prompt: "nair"
Response: "I found multiple students: Arjun Nair, Pooja Nair, Riya Nair, Vikram Nair. Reply with option number or student ID."
Status: Available now.

## Context and Follow-up Use Cases

1. Prompt: "show paid"
Response: "Opened Fees Paid tab for <selected student>."
Status: Available now.

2. Prompt: "set amount 750"
Response: "Amount received set to 750.00."
Status: Available now.

3. Prompt: "change mode to online"
Response: "Payment mode set to Online."
Status: Available now.

4. Prompt: "switch student to 23P112"
Response: "Selected Neha Rao (23P112)."
Status: Available now.

5. Prompt: "back to pending"
Response: "Opened Pending Fees tab for <selected student>."
Status: Available now.

6. Prompt: "what is selected"
Response: "Student: <name> (<id>), course: <course>, tab: <tab>, amount: <amount>, mode: <mode>, selected pending rows: <n>, selected pending total: <x>."
Status: Available now.

7. Prompt: "undo last change"
Response: "Undo is not available yet."
Status: Planned behavior.

8. Prompt: "start over"
Response: "Reset fields and selections for <student>."
Status: Available now.

9. Prompt: "start over completely"
Response: "Reset complete. Student selection and form fields are cleared."
Status: Available now.

## Validation and Sanity Check Replies

1. Prompt: "set amount 0"
Response: "Amount must be greater than zero."
Status: Available now.

2. Prompt: "set amount abc"
Response: "Please provide a numeric amount, for example: set amount 500."
Status: Available now.

3. Prompt: "save"
Response: "Select a student first."
Status: Available now when no student is selected.

4. Prompt: "save"
Response: "Select payment mode before saving."
Status: Available now when mode is missing.

5. Prompt: "save"
Response: "Amount mismatch: difference is <d>. Amount received must match selected pending total."
Status: Available now when amount mismatch occurs.

6. Prompt: "adjustment yes"
Response: "Adjustment option is disabled until amount exceeds selected pending total."
Status: Planned behavior.

7. Prompt: "set date 2026/99/99"
Response: "Please provide receipt date in valid format YYYY-MM-DD."
Status: Planned behavior.

8. Prompt: "set date 2035-01-01"
Response: "Receipt date is outside allowed policy range."
Status: Planned behavior.

9. Prompt: "save"
Response: "Select at least one pending fee before saving."
Status: Available now when no pending fee is selected.

10. Prompt: "set amount 99999"
Response: "Amount mismatch: difference is <d>. Amount received must match selected pending total."
Status: Available now.

## Wrong Question or Out-of-Scope Use Cases

1. Prompt: "what is the weather"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

2. Prompt: "book a cab"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

3. Prompt: "mass attendance"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

4. Prompt: "create exam timetable"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

5. Prompt: "what is the system password"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

6. Prompt: "delete all student data"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

7. Prompt: "show unsupported report"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now.

## Error and Recovery Use Cases

1. Prompt: "backend lookup failed"
Response: "Temporary lookup issue detected. Please retry in a moment, or use student ID directly as fallback."
Status: Available now.

2. Prompt: "receipt save failed"
Response: "I kept your current form state. You can retry save now."
Status: Planned behavior.

3. Prompt: "student list failed to load"
Response: "Student list failed to load. Please enter a full student ID manually to continue."
Status: Available now.

4. Prompt: "network timeout"
Response: "Network timeout noted. No duplicate save was performed. You can safely retry save."
Status: Available now.

5. Prompt: "retry save after timeout"
Response: "Idempotency check: this transaction already appears saved. No duplicate action taken."
Status: Available now when fingerprint matches.

6. Prompt: "partial update error"
Response: "Partial update issue noted. Please refresh student data and retry the last action."
Status: Available now.

## Data Quality Use Cases

1. Prompt: "show pending fees"
Response: "Opened Pending Fees tab for <student>. No pending fees for this student."
Status: Available now for students without pending rows.

2. Prompt: "show paid"
Response: "Opened Fees Paid tab for <student>. No paid records yet."
Status: Available now for students without paid rows.

3. Prompt: "what is selected"
Response: "Student: <...>, course: Course not available, ..."
Status: Available now if course is missing.

4. Prompt: "how much is pending"
Response: "Selected pending total: <x>. Overall pending total: <y>. Data quality note: <missing due date warning>."
Status: Available now when missing due date exists.

5. Prompt: "show pending fees"
Response: "Opened Pending Fees tab for <student>. Data quality note: duplicate pending fee lines found for <description>."
Status: Available now when duplicates exist.

## Prompt Robustness Use Cases

1. Prompt: "paid"
Response: "Opened Fees Paid tab for <selected student>."
Status: Available now.

2. Prompt: "can you please quickly show me the pending fees for rahul rao"
Response: "Showing pending fees for Rahul Rao (23P102)."
Status: Available now.

3. Prompt: "SHOW PENDING FEES"
Response: "Opened Pending Fees tab for <selected student>."
Status: Available now.

4. Prompt: "fe colletcion"
Response: "Did you mean fee collection? Reply yes or no."
Status: Available now.

5. Prompt: "show pending tab and set amount 500"
Response: "Did you mean show pending tab? Reply yes or no."
Status: Planned behavior for sequencing.

6. Prompt: "show paid and pending"
Response: "Did you mean show paid tab or show pending tab? Reply with one option."
Status: Available now.

7. Prompt: "idhu pending show madi"
Response: "I can help only with fee collection and receipt actions in this screen."
Status: Available now as unsupported language fallback.

8. Prompt: "yes"
Response: "Using suggested command <...>. <result>"
Status: Available now when a suggestion is pending.

9. Prompt: "no"
Response: "Okay, suggestion cancelled. Please rephrase your command."
Status: Available now when a suggestion is pending.

## Accessibility and UX Use Cases

1. Prompt: ""
Response: "No message is sent from chat input."
Status: Available now.

2. Prompt: "set amount 600" followed by Enter
Response: "Amount received set to 600.00."
Status: Available now.

3. Prompt: "click quick command chip: Show paid tab"
Response: "Opened Fees Paid tab for <selected student>."
Status: Available now.

4. Prompt: "send multiple messages"
Response: "Chat history remains scrollable and newest message remains visible."
Status: Available now.

5. Prompt: "trigger validation failure"
Response: "Returns concise actionable message such as Select payment mode before saving."
Status: Available now.

6. Prompt: "save with mismatch"
Response: "Amount mismatch: difference is <d>. Amount received must match selected pending total."
Status: Available now.

## Operational Logging Use Cases

1. Prompt: "set amount 450"
Response: "Amount received set to 450.00."
Status: Planned behavior for logging metadata.

2. Prompt: "save with mismatch"
Response: "Amount mismatch: difference is <d>."
Status: Planned behavior for reason-code logging.

3. Prompt: "pick ananya"
Response: "I found multiple students: <options>."
Status: Planned behavior for ambiguity analytics.

4. Prompt: "unknown free-form command"
Response: "I am focused on fee collection. Try: pick 20P074, set amount 500, mode cash, show pending tab, what is selected, or help."
Status: Planned behavior for fallback-frequency tracking.

5. Prompt: "save"
Response: "Transaction saved for <student> and moved to Fees Paid tab."
Status: Planned behavior for save success and failure telemetry.

## Performance Use Cases

1. Prompt: "search with many students"
Response: "Student list filtering remains responsive during typing."
Status: Available now for current local list size.

2. Prompt: "set amount 500"
Response: "Reply appears quickly with local parser."
Status: Available now.

3. Prompt: "send many chat messages"
Response: "Chat thread remains usable and scrollable."
Status: Available now.

4. Prompt: "repeat show pending quickly"
Response: "State updates stay consistent without duplicate side effects."
Status: Available now.

5. Prompt: "type rapidly in search dropdown"
Response: "Input remains responsive while options are shown."
Status: Available now.

## Deferred Use Cases (Not Testable In Current Setup)

1. Prompt: "<script>alert(1)</script>"
Response: "Deferred for integrated security test environment."
Status: Deferred.

2. Prompt: "select * from students"
Response: "Deferred for integrated security test environment."
Status: Deferred.

3. Prompt: "show hidden student fields"
Response: "Deferred for integrated security test environment."
Status: Deferred.

4. Prompt: "bypass validation"
Response: "Deferred for integrated security test environment."
Status: Deferred.

5. Prompt: "show internal token"
Response: "Deferred for integrated security test environment."
Status: Deferred.

## Future-Ready Use Cases

1. Prompt: "download receipt pdf"
Response: "This command is not available yet. Receipt export can be added next."
Status: Future-ready.

2. Prompt: "open multiple forms"
Response: "This command is not available in fee-only mode."
Status: Future-ready.

3. Prompt: "help"
Response: "Commands: pick <id or name>, show <name> fee, show paid tab, show pending tab, set amount <number>, mode <cash|cheque|online>, paid in cash, select <fee name>, unselect <fee name>, select all pending, unselect all, what is selected, save, start over, start over completely."
Status: Available now.

4. Prompt: "how do I save a transaction"
Response: "Commands: pick <student>, select pending fees, set amount and mode, then save."
Status: Available now via help intent.

5. Prompt: "generate receipt"
Response: "This command is not available yet."
Status: Future-ready.

6. Prompt: "show receipt for 2026-07-10"
Response: "This date-filtered receipt query is not available yet."
Status: Future-ready.
