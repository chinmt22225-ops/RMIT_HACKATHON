# Web app and extension API — v0.1

Development base URL: `http://localhost:3000`. The initial version has no user accounts and is for
one local workspace. The auth phase will add a shared identity contract without embedding operator
credentials in the extension.

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

`Source` fields: `title`, `url`, `excerpt`, `kind` (`official`, `reference`, `paper`), optional `year`.
Research retrieves references and scholarly metadata. Citation numbers correspond to array order.
The model must not manufacture source URLs.

## Library

- `GET /api/library` → `{insights: Insight[]}`.
- `POST /api/library` with `{selection, action, answer, sources, collectionId: null|string, note, provider}`
  → `201 {insight}`. The server creates `id` and `createdAt`.
- `PATCH /api/library` with `{id, note, collectionId}` → `{insight}` or 404.
- `DELETE /api/library` with `{id}` → `{deleted: boolean}`.

## Collections

- `GET /api/collections` → `{collections: [{id,name,color,createdAt}]}`.
- `POST /api/collections` with `{name}` → `201 {collection}`.
- `DELETE /api/collections` with `{id}` → `{deleted: boolean}`. Findings are preserved and moved to
  the unfiled library.

## Reader and status

- `POST /api/reader` with `{url}` → `{reading: {title, subtitle, text, url, kind}}`.
  Reads public HTML pages without executing their scripts. Pages that need JavaScript can be
  captured with the extension or pasted. PDF extraction happens in the browser.
- `GET /api/status` → `{available, model, engine}`.

Types live in `src/lib/types.ts`; validation lives in `src/lib/http.ts` and the route handlers.
