# Web app and extension API — v0.1

Development base URL: `http://localhost:3000`. The app uses TideCloak. Private library routes require
`Authorization: DPoP <access-token>` and a valid `DPoP` proof for the method, origin, and path.
Use the Tide SDK's `secureFetch` with absolute URLs. Reading tools are intentionally public; private library routes never accept anonymous access.

Guests can use assistant/reader endpoints subject to local guest rate limits. A presented invalid token is rejected rather than downgraded. Required roles for signed-in requests: `assistant:use` for assistant/reader; `library:read` for reading the library and
collections; `library:write` for mutations. Ownership comes from the verified JWT subject, never
from a submitted owner field. Missing/invalid proof returns 401, missing role 403, and requests
from another web origin are rejected.

The extension calls `runtime.sendMessage({kind:"margin-api",path,method,data})` through the browser's
extension API (`chrome` or `browser`). For authenticated actions, its background script invokes the allowlisted `window.marginBridge.request` inside the signed-in first-party app tab. That bridge uses `secureFetch` and returns status/body/content type, without
exposing tokens or private keys. Guest tool requests can run without an app tab; saving requires the signed-in app bridge. Extension callers receive the full completed response; the web
app consumes it as a live stream. Keep a signed-in app tab open. Do not replace this bridge with a
bare unauthenticated Fetch request.

## Assistant

`POST /api/assist`, JSON:

```json
{
  "selection": {
    "text": "MCP",
    "context": "The AI assistant connects to a search tool using MCP.",
    "title": "The article being read",
    "url": "https://example.org/article"
  },
  "action": "explain",
  "language": "Vietnamese"
}
```

Actions: `explain`, `research`, `translate`, `simplify`, `examples`, `ask`.
Language controls translation; it defaults to Vietnamese. Other actions normally answer in English
or the user's question language. A follow-up adds `question` and optionally up to six
`history: [{"role":"user"|"assistant", "content":"..."}]` entries.

The response is **newline-delimited JSON**, not a single JSON document. A network chunk may contain
part of a line or multiple lines; buffer until newlines before parsing.

```jsonl
{"type":"status","message":"Finding context and sources…"}
{"type":"sources","sources":[],"notices":[],"provider":"Ollama · qwen3-vl:2b-instruct"}
{"type":"delta","text":"MCP stands for "}
{"type":"delta","text":"Model Context Protocol."}
{"type":"done"}
```

Stream failures use `{"type":"error","message":"..."}`; do not treat a partial answer as complete.
Cancel by aborting the Fetch request. Normal validation errors use JSON `{ "error": "..." }` and a
non-2xx status before the stream starts.

`Source` fields: `title`, `url`, `excerpt`, `kind` (`official`, `academic`, `government`, `paper`,
`preprint`, or `reference`), optional `year`, optional `publisher`, and optional `evidence`
(`excerpt`, `abstract`, or `metadata`). Research prioritizes primary sources and scholarly
abstracts; metadata-only records are further-reading links, not evidence supplied to the model.
Citation numbers correspond to array order. The model must not manufacture source URLs.

## Library

- `GET /api/library` (current user only) → `{insights: Insight[]}`.
- `POST /api/library` with `{selection, action, language?, answer, sources, collectionId: null|string, note, provider}`
  → `201 {insight}`. The server creates `id` and `createdAt`.
- `PATCH /api/library` with `{id, note, collectionId}` → `{insight}` or 404.
- `DELETE /api/library` with `{id}` → `{deleted: boolean}`.

## Collections

- `GET /api/collections` (current user only) → `{collections: [{id,name,color,createdAt}]}`.
- `POST /api/collections` with `{name}` → `201 {collection}`.
- `DELETE /api/collections` with `{id}` → `{deleted: boolean}`. Findings are preserved and moved to
  the unfiled library.

## Optional display name

- `GET /api/profile` → `{displayName: string}` for the signed-in subject.
- `POST /api/profile` with `{displayName}` → the saved profile. Maximum 60 characters; empty clears it.
- Both require the `appUser` role and a valid Tide token plus DPoP proof. This is app profile data in SQLite, not a change to Tide identity or administrator-managed claims.

## Session confirmation

- `GET /api/session` → `{subject: string}` after server verification of the real Tide JWT and DPoP
  proof. Returns 401 for missing or invalid authentication. The browser confirms this response
  before showing a signed-in workspace; arriving at `/auth/redirect` alone does not sign anyone in.

## Reader and status

- `POST /api/reader` with `{url}` → `{reading: {title, subtitle, text, url, kind}}`.
  Reads public HTML pages without executing their scripts. Pages that need JavaScript can be
  captured with the extension or pasted. PDF extraction happens in the browser.
- `GET /api/status` → `{available, model, engine}`.

Types live in `src/lib/types.ts`; validation lives in `src/lib/http.ts` and the route handlers.
