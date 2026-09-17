# CT-Bot Mock Harness (WebSocket)

Deterministic mock server for the FE↔harness protocol, with two modes:

- **`canned`** (default): fixed intent-based responses
- **`live`**: OpenAI-compatible chat-completions call mapped to validated protocol `assistant_response`
- **SQLite persistence + REST history API**: user-scoped conversation list/load for FE restore

## Protocol

- `hostProtocolVersion`: `"1.0"`
- FE → harness: `hello`, `user_message`, `emit_event`, `context_response`
- Harness → FE: `assistant_response`, `error`
- Block types: `text`, `markdown`, `suggestions`, `link`, `form`, `confirmation`
- Action types: `change_state`
- REST history endpoints:
  - `GET /v1/conversations`
  - `GET /v1/conversations/:id`
  - `POST /v1/conversations` (optional pre-create)
  - `DELETE /v1/conversations/:id` (optional)

Persistence behavior:

- On each `user_message`, harness upserts conversation and appends the user row.
- When sending `assistant_response`, harness appends assistant row with full renderable payload (`messages[]`, `actions[]`, correlation/version metadata).
- `context.view` snapshots are **not** stored in SQLite.
- Title uses first user message text (trimmed) or `New chat` until first user turn.
- The database is local-only and must not be committed. The harness creates its parent directory, database file, tables, and indexes automatically.

### Host context bag (Phase 6c)

`user_message.context` and `emit_event.context` use the same lightweight shape:

```json
{
  "route": "/current/path",
  "persona": "Admin",
  "moduleFlags": {
    "underFees": false,
    "underConnect": false,
    "underStudent": false
  },
  "view": {
    "module": "fees",
    "screen": "transactions",
    "title": "Fees Transactions",
    "source": "store.fees.txList",
    "filters": { "query": "searchText=abhay", "searchText": "abhay" },
    "columns": ["studentName", "txDate", "amount", "due", "txNo"],
    "rowCount": 2,
    "truncated": false,
    "maxRows": 30,
    "rows": [
      { "studentName": "Abhay Kulkarni", "txDate": "2026-07-02", "amount": 1200, "due": 300, "txNo": "RCPT-101" }
    ]
  },
  "focus": { "type": "student", "id": "stu_123", "label": "Ananya Rao" },
  "flags": { "underFees": false }
}
```

Field guarantees:

- `route`: always present
- `moduleFlags`: always present (`underFees`, `underConnect`, `underStudent`; derived from route)
- `persona`: best-effort (omitted when unavailable)
- `view`: present when a view provider can supply snapshot data (currently Fees provider under `/fees`)
- `focus`: best-effort (`student` / `applicant` / `null`) and not required for fee answers
- `flags.underFees`: retained for backward compatibility with older logic

How to inspect it:

- Browser DevTools → Network → WS → outbound `user_message` / `emit_event` frame payloads.
- In `live` + `debug` log level, harness debug logs include the host-context lines sent to the LLM request wrapper (`moduleFlags` and `view` included).
- `emit_event` info logs include parsed context summary (`route`, `persona`, `focus`, `underFees`, `underConnect`, `underStudent`, `viewModule`, `viewScreen`, `viewRows`).

Shared types live in:

- `src/app/agent-chat-panel/services/ct-bot-host-protocol.ts`

Live-mode system instructions are maintained in:

- `mock-harness/AGENTS.md`

## Configuration

Default config path:

- `mock-harness/config.json` (optional)

Override config file path:

- `MOCK_HARNESS_CONFIG=/absolute/or/relative/path/to/config.json`

Example file:

- `mock-harness/config.example.json`

```json
{
  "host": "0.0.0.0",
  "port": 8787,
  "mode": "canned",
  "logLevel": "info",
  "live": {
    "provider": "openrouter",
    "apiKey": "",
    "model": "openai/gpt-4o-mini",
    "baseUrl": "https://openrouter.ai/api/v1",
    "temperature": 0.2,
    "maxTurns": 4
  }
}
```

### Env overrides

- `MOCK_HARNESS_MODE=canned|live`
- `MOCK_HARNESS_HOST=0.0.0.0`
- `MOCK_HARNESS_PORT=8787`
- `MOCK_HARNESS_LOG_LEVEL=debug|info|error`
- `MOCK_HARNESS_LIVE_PROVIDER=openrouter|openai`
- `MOCK_HARNESS_LIVE_API_KEY=...` (or `OPENAI_API_KEY`)
- `MOCK_HARNESS_LIVE_BASE_URL=...` (or `OPENAI_BASE_URL`)
- `MOCK_HARNESS_LIVE_MODEL=...`
- `MOCK_HARNESS_LIVE_TEMPERATURE=0.2`
- `MOCK_HARNESS_LIVE_MAX_TURNS=4`
- `MOCK_HARNESS_SQLITE_PATH=...` (absolute/relative path to SQLite file; default `mock-harness/data/conversations.sqlite3`)
- `MOCK_HARNESS_CORS_ORIGIN=http://localhost:4200`

The SQLite path can also be set once in `mock-harness/config.json`:

```json
{
  "sqlitePath": "data/conversations.sqlite3"
}
```

Relative config paths are resolved from the `mock-harness` directory. `MOCK_HARNESS_SQLITE_PATH` takes precedence over `config.json`, and the default is used when neither is set. Copy `config.example.json` to `config.json` as a starting point.

Back-compat host/port overrides are still accepted:

- `CT_BOT_MOCK_HOST`
- `CT_BOT_MOCK_PORT`

### Log levels

- `error`: only failures
- `info`: startup + per-turn live summary logs
- `debug`: includes `info` plus debug details (response size, finish reason, live endpoint startup detail)

Set with either config JSON (`"logLevel": "debug"`) or env:

```bash
MOCK_HARNESS_LOG_LEVEL=debug npm run mock-harness:dev:live
```

## History API auth scoping

WS and REST both use the same user-id resolver and the same auth inputs:

1. `AccessToken` header, `Authorization: Bearer <token>`, or `access_token` query param.
2. The resolver derives a stable user id from that token.
3. If no token exists, a deterministic local anonymous fallback is used.

`X-User-Id` is not used for ownership resolution.

The API never returns another user’s conversations; mismatched ownership returns `401`.

Quick verification:

1. In one browser session, send a chat message over WS.
2. In the same session, call `GET /v1/conversations` (or open chat history in FE) and confirm the same thread appears.
3. Refresh and load that conversation id; transcript should restore with text/link/suggestions blocks.

The default database path is `mock-harness/data/conversations.sqlite3` (the startup log prints its absolute path). Start the mock and confirm the file exists immediately, or send the first message and check again. SQLite `-wal` and `-shm` sidecar files, when present, are local-only and ignored as well.

After a successful WS assistant response, the Angular host refreshes `GET /v1/conversations`, so a new thread appears in the history dropdown without a page reload. Clicking `+` only starts a new client conversation; it does not delete server history. Existing threads remain listed and can be loaded after a browser refresh.

## Start

From repository root:

```bash
npm --prefix mock-harness install
npm run mock-harness:dev
```

Or directly:

```bash
cd mock-harness
npm run dev
```

Start live mode directly:

```bash
npm run mock-harness:dev:live
```

Default bind:

- Host: `0.0.0.0`
- Port: `8787`
- WS URL: `ws://localhost:8787`

## Canned mode behavior

### Fees navigation

- `take me to fees` / `go to fees` / `open fees` → text + internal `link` to `/fees`
- Common replies may also include a `suggestions` block (2-4 chips) for quick follow-up actions.

### Home navigation

- `take me home` / `go home` / `open home` → text + internal `link` to `/home`

### Collect fees

- `collect fees` / `collect fee` → text + internal `link` to `/fees/add`

### Institute info

Triggers include:

- `institute info`
- `institute information`
- `inst details`
- `about the institute`
- `about the organization`
- `about the org`
- `school info`
- `tell me about the school`
- `org info`

Behavior:

- If FE sends authenticated institute snapshot in `context.institute`, harness summarizes that real data + internal `link` to `/admin/inst`.
- If FE marks institute data unavailable, harness returns an honest unavailable message + internal `link` to `/admin/inst`.
- If no institute context is sent (legacy/dev fallback), canned mode falls back to demo summary text.

### Marks cards / Connect

Triggers include:

- `send marks cards`
- `send marks cards for FA1`
- `marks card email`
- `markscard`

Returns guidance text + internal `link` to `/connect/marksCardRecipients`.
No marks-card job/email API is called in this mock.

### Non-matching prompt

Returns text-only guidance listing supported canned examples.

### Unknown navigation destination

- For requests like `take me to the moon`, harness returns safe guidance text and only known internal destination links (Fees, Institute details, marks-card recipients, Home).
- Unknown-nav fallback may include `suggestions` chips for known destinations only.

## Live mode behavior

- On `user_message`, server calls `${baseUrl}/chat/completions` (URL joined safely; no duplicate `/v1` segment)
- Sends harness prompt + host context (`route`, `persona`, `moduleFlags`, `view`, `focus`, `flags`) + user text to the model
- Prefers structured JSON output (`response_format: { "type": "json_object" }`) and retries without it when provider rejects `response_format`
- Parses provider output JSON (also supports fenced JSON) into protocol payload: `messages` + optional `actions`
- Validates/filters model output using protocol allowlists:
  - message types: `text`, `markdown`, `suggestions`, `link`, `form`, `confirmation`
  - action types: `change_state`
  - routes must be in-app (`/` paths) and match known route allowlist
- Suggestion chips are validated:
  - `send_message` requires non-empty `payload.text`
  - `navigate` requires allowed in-app `payload.href` and `payload.target: "internal"`
- Repairs high-confidence intents when needed:
  - `take me home` / `go home` / `open home` → inject internal `link` to `/home`
  - `take me to fees` / open fees → inject internal `link` to `/fees` if missing
  - `collect fees` → route-aware guidance + internal `link` to `/fees/add`
  - institute info → prefer FE-provided authenticated institute snapshot for summary; if unavailable/missing, return clear unavailable text + internal `link` to `/admin/inst`
  - marks card / send marks cards → internal `link` to `/connect/marksCardRecipients`
  - unknown navigation destination → return safe fallback text and only known internal links (no invented routes)
- For Fees view Q&A, live mode is **LLM-over-snapshot**: the model answers from host-provided `context.view` when `view.module = "fees"` (no invented amounts/dates)
- For prompts like “what can you see?”, returns a natural-language summary of the current view snapshot (no raw protocol JSON)
- If API key/model is missing, returns protocol `error` with `code: "configuration_error"`
- If provider call fails, returns protocol `error` with `code: "internal_error"`
- Invalid model JSON never crashes the harness; it falls back to safe text response mapping
- Low-signal/garbage model text (for example `[1]`) is replaced with safe fallback guidance text

### FE-mediated institute flow (Phase 6a)

1. FE identifies institute-info intent on user message.
2. FE calls authenticated API (`CTApi.getInst(...)`) using current user session.
3. FE sends `user_message` with `context.institute` snapshot (or `status: unavailable` on failure).
4. Harness formats institute response text from `context.institute` and sends an internal `link` to `/admin/inst`.

The mock harness does **not** call C# institute APIs directly and does not handle FE auth tokens for backend API access.

### Generic view-context flow (Phase 6c)

1. FE includes global context (`route`, `moduleFlags`) on every turn/event.
2. FE asks registered view providers for a bounded `context.view` snapshot.
3. Fees is the first provider and supplies `view.module = "fees"` with screen, columns, rows, filters, row counts, and truncation metadata.
4. Harness/live prompt uses only `context.view` data for view-bound answers (fees paid/due/date, "what can you see?"), with model-first interpretation in live mode.
5. If rows are missing, student/date match is absent, or requested fields are not in `view.columns`, harness answers honestly and explains what is missing.
6. Fees rows are generic flat objects built from loaded transaction entities; scalar fields are retained, nested blobs are skipped, and long strings are truncated.

Current limitation:

- No separate FE-triggered name lookup call is wired in this phase. Fee answers use only the bounded rows already present in `context.view`.

### Live turn observability

For each live `user_message`, logs include:

- `conversationId`
- live path marker
- resolved endpoint (no API key)
- model
- HTTP status code
- latency in ms
- mapping result (`success` or `error`)
- when view Q&A is relevant: source (`llm`, `safety_fees`, or fallback) plus `rowCount`, `nameMatched`, and date-match flags

Example success (`info`):

```text
[mock-harness] live turn conversationId=conv_123 path=live endpoint=https://openrouter.ai/api/v1/chat/completions model=openai/gpt-4o-mini
[mock-harness] live turn conversationId=conv_123 path=live endpoint=https://openrouter.ai/api/v1/chat/completions model=openai/gpt-4o-mini status=200 latencyMs=842 mapping=success
```

Example failure (`error`):

```text
[mock-harness] live turn conversationId=conv_123 path=live endpoint=https://openrouter.ai/api/v1/chat/completions model=openai/gpt-4o-mini status=401 latencyMs=320 mapping=error message=Invalid API key
```

Debug-only details:

```text
[mock-harness] live turn debug conversationId=conv_123 responseBytes=1302 finishReason=stop
[mock-harness] live chat request endpoint=https://openrouter.ai/api/v1/chat/completions method=POST auth=sk-a...9zQ2 payloadBytes=912 payload={"model":"openai/gpt-4o-mini","temperature":0.2,"messages":[...]}
[mock-harness] live chat response endpoint=https://openrouter.ai/api/v1/chat/completions status=401 latencyMs=320 responseBytes=287
[mock-harness] live turn error-details conversationId=conv_123 details={"endpoint":"https://openrouter.ai/api/v1/chat/completions","statusCode":401,"safeMessage":"Invalid API key","requestPayload":"...","responsePreview":"...","providerError":{"message":"Invalid API key"}}
```

## Verify quickly

### Automated check for `/fees`

From repository root:

```bash
npm run mock-harness:verify
```

### Manual WS check (wscat)

```bash
npx wscat -c "ws://localhost:8787?access_token=dev-token"
```

Send:

```json
{"type":"user_message","conversationId":"conv_123","messageId":"msg_123","text":"take me to fees","context":{"route":"/home","persona":"admin","moduleFlags":{"underFees":false,"underConnect":false,"underStudent":false},"focus":null,"flags":{"underFees":false}}}
```

Expected canned response includes:

```json
{
  "type": "assistant_response",
  "conversationId": "conv_123",
  "correlationId": null,
  "hostProtocolVersion": "1.0",
  "messages": [
    { "type": "text", "text": "Opening the Fees page." },
    { "type": "link", "label": "Open Fees", "href": "/fees", "target": "internal" }
  ],
  "actions": []
}
```

### Manual live check for `/fees` navigation

Start in live mode with a valid key/model:

```bash
MOCK_HARNESS_MODE=live MOCK_HARNESS_LIVE_API_KEY=*** MOCK_HARNESS_LIVE_MODEL=openai/gpt-4o-mini npm run mock-harness:dev
```

Then send:

```json
{"type":"user_message","conversationId":"conv_live_123","messageId":"msg_live_123","text":"take me to fees","context":{"route":"/home","persona":"admin"}}
```

Expected live response includes:

```json
{
  "type": "assistant_response",
  "conversationId": "conv_live_123",
  "hostProtocolVersion": "1.0",
  "messages": [
    { "type": "text", "text": "Opening Fees." },
    { "type": "link", "label": "Open Fees", "href": "/fees", "target": "internal" }
  ],
  "actions": []
}
```

### Manual live check for API-backed institute info

From FE (logged-in session), send one of these while harness runs in `live` mode:

- `institute info`
- `inst details`
- `tell me about the organization`
- `tell me about the school`

Expected behavior:

- When FE API call succeeds, assistant text reflects returned institute fields (for example name, academic year, status) and includes a `link` block to `/admin/inst`.
- When FE API call fails or institute ID cannot be resolved, assistant returns a clear unavailable message and still includes a `link` block to `/admin/inst`.

### Manual live check for fees amount from context snapshot

1. Open `/fees/transactions` in the app and keep transaction rows visible.
2. Ask in chat: `what is the fees paid by <student name from the visible rows>?`
3. Expected behavior:
   - assistant returns paid/due values from `context.view.rows` for the matched student
   - no invented values if rows or match are missing

### Manual live check for date-filtered fees question

1. Stay on `/fees/transactions` with rows that include a date-like field (for example `txDate`).
2. Ask: `fees paid by <student> on <date>`
3. Expected behavior:
   - if the date field exists in `view.columns`, assistant filters rows by that date and answers from matching rows
   - if no date column exists, assistant clearly says date is unavailable in current view data

## FE URL

Point FE host config to:

- `AGENT_HARNESS_WS_URL: 'ws://localhost:8787'`
- `AGENT_HARNESS_API_URL: 'http://localhost:8787'`

SQLite file location (default):

- `mock-harness/data/conversations.sqlite3`

## Security note

Do not commit real API keys. Keep `apiKey` empty in committed config and provide secrets via environment variables.
