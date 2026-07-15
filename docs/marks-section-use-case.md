# Marks Section Chat Use Cases

Purpose: capture implemented use cases for the marks endpoint and marks-focused chat flow.
Scope: section filtering, summary insight, top scorer discovery, cross-screen routing suggestions, and recovery.

## Marks Endpoint and Context Use Cases

- User navigates to /marks and sees marks workspace with section selector and FA1 table.
- User opens AI Agent on marks screen and prompt is handled by marks context.
- User types help and gets marks-specific clickable actions.
- Marks conversation history stays scoped to marks context when switching from Operations and back.

## Section Discovery and Selection Use Cases

- User types show section list and chat returns all available sections except All Sections.
- User types list section and chat returns the same section inventory.
- User types set section all sections and chat sets section filter to All Sections.
- User types all and chat sets section filter to All Sections.
- User types a valid section name in prompt and chat sets that section.
- After section selection, chat confirms selected section and visible student count.

## Marks Summary and Ranking Use Cases

- User types show marks summary and chat returns selected scope metrics.
- Summary includes student count, average, highest, and lowest marks.
- User types overview and receives the same summary behavior.
- User types show top scorers and chat returns top 3 students by marks in current section scope.
- User types highest and chat returns top scorer list in current section scope.
- If no rows match selected filter, top scorers flow returns no students available message.

## Cross-Screen Suggestion Use Cases

- User asks fee or receipt command in marks screen and chat suggests moving to Operations section.
- Chat returns two choices for cross-screen request:
  - Open operations section
  - Stay in marks
- User chooses Open operations section and global agent can route to operations context.
- User chooses Stay in marks and chat returns marks help.

## Out-of-Scope and Recovery Use Cases

- Empty prompt returns guidance to enter a marks command and try help.
- Unsupported prompt returns marks-scope guidance with valid examples.
- User asks unrelated domain tasks in marks context and chat remains scoped to marks actions.

## Current Constraints

- Marks commands are rule and keyword based, not model intent classification.
- Marks rows are generated from enabled student directory entries.
- Marks values are deterministic from student ID and not persisted as manual edits yet.
- Grade bands are fixed in current implementation:
  - A: 35 and above
  - B: 28 to 34
  - C: 20 to 27
  - D: below 20
