# Margin

A workspace for understanding anything you encounter. Read a document, select a term or passage,
get an explanation or translation, investigate related sources, and keep useful findings with their
original context. The browser extension uses the same assistant and library as the web app.

## Run locally

Requires Node.js 24+, npm, and [Ollama](https://ollama.com). On Linux, `zip` packages the extension.

```sh
npm ci
ollama serve
# In another terminal, if this model is not already installed:
ollama pull qwen3-vl:2b-instruct
npm run extension:build
npm run dev
```

Open http://localhost:3000. The server binds to loopback. Model and assistant configuration lives in
`.env.local`; copy `.env.example` to customize it. Do not commit actual environment files.
The assistant does not download a model automatically.

Try the sample document: click **MCP**, use **Explain**, **Research**, **Translate**, **Simplify**, or
**Examples**, then save a finding. Add your own text, import a public article URL, or upload a text PDF.
Scanned PDFs require OCR and are not supported yet.

## Browser extension

Run `npm run extension:build`, unzip `public/margin-extension.zip`, then open `chrome://extensions`,
enable Developer mode, select Load unpacked, and choose the extension directory. You can also load
the tracked `extension/` directory directly. Keep the web app running on the same computer.

Select text → right-click → Explore with Margin. The toolbar action and Ctrl+Shift+M also capture the
current selection. Results open in Chrome's side panel. Saved findings appear in the web app's library.

## Development

See [the API contract](docs/API.md) for web app and extension integration.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e           # local app must be running; uses system Chromium
MARGIN_LIVE_AI=1 npm run test:e2e  # also exercises real Ollama inference
```

Source retrieval uses Wikipedia's public search API and Crossref's scholarly metadata API. Crossref
results are labeled as metadata; the app does not claim to have read the full paper. AI explanations
are model-generated and can be inaccurate. Follow citation links to check the underlying material.

SQLite findings and collections are stored in `.data/margin.sqlite`; the last reading and language
preference stay in the browser. Export the library as Markdown from the app.

## Current deployment boundary

This first product version is a **local, single-user development workspace**. Authentication,
multi-user data ownership, TideCloak, deployment controls, and the full security review are the next
integration phase. Do not expose this version as a shared internet service. It does not claim E2EE,
production-ready authorization, or an active Tide realm. Raziel, Tide's guidance MCP server, is already
available in the coding environment; it is separate from the app's inference backend.
