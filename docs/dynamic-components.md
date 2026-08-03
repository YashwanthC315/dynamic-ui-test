# Reusable Angular AI Chatbox Architecture

## 1. Overview

The chatbox acts as a renderer for UI elements returned by a backend
harness.

    Angular Chat Component
            │
            ▼
         Harness API
            │
            ▼
          AI Agent
            │
            ▼
     Tool Selection Logic
            │
            ▼
         Script / Tool

### Design Principle

-   Agents decide what needs to happen.
-   Scripts perform deterministic work.
-   The chatbox simply renders the conversation and any requested UI.

------------------------------------------------------------------------

## 2. Rendering UI Instead of Only Text

Instead of returning only text, the harness returns one or more UI
blocks.

Example:

``` json
{
  "messages": [
    {
      "type": "text",
      "text": "I need a repository before continuing."
    },
    {
      "type": "form",
      "formId": "repo-selection"
    }
  ]
}
```

The frontend simply renders each message according to its type.

------------------------------------------------------------------------

## 3. Supported Message Types

Possible UI blocks include:

-   Text
-   Markdown
-   Form
-   Table
-   Progress
-   Code Block
-   File Upload
-   Image
-   Button Group
-   Timeline
-   Tree View
-   Branch Graph
-   Chart
-   Confirmation Dialog
-   Custom Component

A conversation might look like:

    User
     ↓
    Text
     ↓
    Form
     ↓
    Progress
     ↓
    Result Table
     ↓
    Markdown Explanation

------------------------------------------------------------------------

## 4. Dynamic Component Rendering

The chat component should maintain a registry that maps message types to
Angular components.

    "text"
        ↓
    TextComponent

    "form"
        ↓
    DynamicFormComponent

    "table"
        ↓
    TableComponent

    "progress"
        ↓
    ProgressComponent

    "gitGraph"
        ↓
    GitGraphComponent

The chat component only asks the registry which component to render.

------------------------------------------------------------------------

## 5. Dynamic Forms

The backend defines forms using JSON.

Example:

``` json
{
  "type": "form",
  "title": "Cherry Pick Request",
  "submitAction": "submitCherryPick",
  "fields": [
    {
      "id": "repo",
      "type": "select",
      "label": "Repository",
      "required": true
    },
    {
      "id": "branch",
      "type": "text",
      "label": "Target Branch"
    },
    {
      "id": "dryRun",
      "type": "checkbox",
      "label": "Dry Run"
    }
  ]
}
```

The frontend builds the form automatically.

------------------------------------------------------------------------

## 6. Dynamic Form Architecture

    JSON Form Definition
            │
            ▼
    DynamicFormComponent
            │
            ▼
    Build FormGroup
            │
            ▼
    Create FormControls
            │
            ▼
    Render Controls

------------------------------------------------------------------------

## 7. Supported Field Types

Recommended field types:

-   Text
-   Textarea
-   Number
-   Checkbox
-   Radio
-   Select
-   Multi-select
-   Date
-   DateTime
-   Password
-   Email
-   URL
-   File Upload
-   Code Editor
-   Markdown Editor
-   Tag Selector
-   Repository Picker
-   Branch Picker
-   User Picker

------------------------------------------------------------------------

## 8. Validation

Validation rules should come from the backend.

``` json
{
  "required": true,
  "minLength": 3,
  "maxLength": 50,
  "pattern": "^release/.*"
}
```

The frontend converts these into Angular validators.

------------------------------------------------------------------------

## 9. Dynamic Data Sources

Some controls require live data.

Examples:

-   Repository list
-   Branch list
-   User list

Instead of embedding values, the schema references a data source.

``` json
{
  "type": "select",
  "source": "/api/repos"
}
```

The frontend loads the options dynamically.

------------------------------------------------------------------------

## 10. Form Submission

When submitted, the frontend sends structured data back to the harness.

``` json
{
  "action": "submitCherryPick",
  "values": {
    "repo": "Workbench",
    "branch": "release/3.8",
    "dryRun": true
  }
}
```

The harness decides which agent and tool to invoke.

------------------------------------------------------------------------

## 11. Multi-Step Conversations

Typical flow:

    User Request
          │
          ▼
    Agent Determines Missing Information
          │
          ▼
    Return Dynamic Form
          │
          ▼
    User Completes Form
          │
          ▼
    Harness Continues Workflow
          │
          ▼
    Tool Executes
          │
          ▼
    Results Returned

------------------------------------------------------------------------

## 12. Component Registry

A registry keeps the chat component generic.

    text        → TextComponent
    markdown    → MarkdownComponent
    form        → DynamicFormComponent
    table       → TableComponent
    progress    → ProgressComponent
    graph       → GitGraphComponent
    upload      → FileUploadComponent

Adding a new UI element requires only:

1.  Create the Angular component.
2.  Register it.
3.  Return the corresponding message type from the harness.

------------------------------------------------------------------------

## 13. Overall Workflow

    User asks question
            │
            ▼
    Chat sends request
            │
            ▼
    Harness
            │
            ▼
    Agent reasons
            │
            ▼
    Need more information?
          /           \
        Yes           No
         │             │
    Return Form     Execute Tool
         │             │
    User submits      │
         │             ▼
         └──────► Stream Progress
                        │
                        ▼
                 Return Results
                        │
                        ▼
            Chat Renders UI Blocks

------------------------------------------------------------------------

## 14. Recommended Separation of Responsibilities

### Chat Component

-   Manages conversation history
-   Sends user messages
-   Renders UI blocks
-   Handles scrolling and layout

### UI Components

-   Forms
-   Tables
-   Progress indicators
-   Graphs
-   File uploads
-   Code viewers

Each component accepts JSON configuration and emits events.

### Harness

-   Orchestrates the conversation
-   Determines which UI blocks to return
-   Invokes agents
-   Receives user input

### Agents

-   Perform reasoning
-   Decide which tools to call
-   Identify missing information

### Tools / Scripts

-   Execute deterministic operations
-   Return structured results
-   Do not make autonomous decisions

------------------------------------------------------------------------

## 15. Key Design Principles

-   Keep the chatbox completely domain-agnostic.
-   Treat every response as one or more renderable UI blocks.
-   Define forms entirely through JSON.
-   Let the backend own business logic and validation.
-   Use a component registry for extensibility.
-   Stream progress for long-running tasks.
-   Ensure only agents make decisions while tools execute deterministic
    actions.
