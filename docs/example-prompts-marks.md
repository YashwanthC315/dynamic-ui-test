# Example Prompts Marks

Purpose: concrete prompt-response examples for the marks section and marks AI handler.

Legend:
- Available now: implemented and wired in current UI.
- Planned behavior: expected next behavior, not implemented yet.

## Marks Help and Context

1. Prompt: "help"
Response: "Marks help: choose a section, show summary, or list top scorers." with clickable buttons:
	- Show section list
	- Set section All Sections
	- Show marks summary
	- Show top scorers
Status: Available now.

2. Prompt: "commands"
Response: Same as help with marks-focused quick actions.
Status: Available now.

## Section Discovery and Selection

1. Prompt: "show section list"
Response: "Available sections: <section1>; <section2>; ..."
Status: Available now.

2. Prompt: "list section"
Response: Same section list output.
Status: Available now.

3. Prompt: "set section all sections"
Response: "Section set to All Sections. Showing <n> students."
Status: Available now.

4. Prompt: "all"
Response: "Section set to All Sections. Showing <n> students."
Status: Available now.

5. Prompt: "set section bca 1"
Response: "Section set to BCA 1. Showing <n> students."
Status: Available now when section exists.

## Summary and Top Scorers

1. Prompt: "show marks summary"
Response: "Marks summary for <section>: students <count>, average <avg>, highest <max>, lowest <min>."
Status: Available now.

2. Prompt: "overview"
Response: Same marks summary output.
Status: Available now.

3. Prompt: "show top scorers"
Response: "Top scorers in <section>: 1) <name> (<id>) - <marks>; 2) ...; 3) ..."
Status: Available now.

4. Prompt: "highest"
Response: Same top scorer output.
Status: Available now.

5. Prompt: "top marks"
Response: Same top scorer output.
Status: Available now.

## Cross-Screen Suggestions

1. Prompt: "open fee collection"
Response: "This looks like an operations or fee question. Do you want to move to Operations section?" with buttons:
	- Open operations section
	- Stay in marks
Status: Available now.

2. Prompt: "show pending fee report"
Response: Same operations suggestion response with action buttons.
Status: Available now.

3. Prompt: Click "Stay in marks"
Response: Returns marks help options.
Status: Available now.

## Out-of-Scope in Marks

1. Prompt: "book a cab"
Response: "I can assist only with marks workflow in this screen. Try: help, show section list, set section <name>, show marks summary, or show top scorers."
Status: Available now.

2. Prompt: "download marks pdf"
Response: Same marks-scope guidance (feature not available yet).
Status: Available now.

## Planned (Not Yet Implemented)

1. Prompt: "save marks for section bca 1"
Response: "Marks save workflow is not available yet."
Status: Planned behavior.

2. Prompt: "show subject-wise marks"
Response: "Subject-wise breakup is not available yet in this endpoint."
Status: Planned behavior.
