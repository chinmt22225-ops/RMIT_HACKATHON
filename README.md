[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak)

# Margin

## Project overview

Margin helps people understand anything they encounter while reading: select unfamiliar text,
explain it in context, investigate sources, translate it, and save the discovery to a personal library.

### 1. Vision & originality

Curiosity rarely follows a syllabus. Someone reading an AI paper may stumble on “MCP”; someone else
may wonder about a phrase, an economic idea, or a biological process. Margin connects that small
moment of uncertainty to an explanation, related sources, and a lasting personal note. The web app
is the main workspace; its extension brings the same tools to the page already being read.

### 2. Trust constraint insight

Reading material and personal questions can reveal private interests or unfinished work. A useful
assistant needs access to a passage without making every saved finding accessible to other users.
Margin lets guests read, explain, research, and translate without an account. Saving findings or
using a personal library requires Tide sign-in. It runs inference on a locally configured model,
separates each user's saved data, and uses
TideCloak for authentication and protected requests. Source searches send the selected search text to
Crossref and, when needed, Wikipedia for reference discovery; eligible public source pages are fetched directly. The surrounding document is supplied to the local model.

### 3. Value & impact

Readers can follow an unfamiliar idea without repeatedly switching tabs and retyping context. For
example: select “MCP” in a paper → get a contextual explanation → inspect official documentation
and related sources → save the finding with the original passage → add a personal note later.
This supports everyday learning, research, and a reusable knowledge library.

### 4. Why TideCloak matters

The app uses the TideCloak SDK for sign-in and `secureFetch`. Private library APIs verify the Tide JWT
against the exported adapter's embedded public key, check issuer/client/audience and roles, and
verify the DPoP proof. Replay claims persist in SQLite. Library and collection queries use the
verified subject as the owner. The extension asks the signed-in web app to make these requests;
it does not receive the user's token, DPoP private key, or operator credentials.

Signed-in tool requests use `assistant:use`; private library roles are `library:read` and `library:write`. The bootstrap enables Tide
licensing and Tide-mode governance before enrollment and exports the real adapter afterward.
A fresh setup must complete browser enrollment to enable sign-in; no fake adapter is provided.
Sign-in uses TideCloak's default blue design. There is no simulated account or authentication mode.
Before showing a personal workspace, Margin verifies the returned session on `/api/session` using
the real Tide JWT signature and a fresh DPoP proof. An incomplete callback shows a retry option.
Guest tools continue working before sign-in is configured. Live sign-in and authenticated library,
collection, and profile requests have been verified on the development installation; each new
installation needs its own realm setup.

### 5. Prototype & storytelling

The prototype contains a reader for pasted text, public articles, and PDFs with selectable text;
Explain, Research, Translate, Simplify, Examples, and follow-up questions; source links; a personal
library with notes and collections; an optional display name; Markdown export; and a browser
extension using the same backend. Chrome and Firefox development packages are included; public
store releases are pending. Scanned PDFs need OCR and are not supported yet.

## Setup

Requires Node.js 24+, npm, Docker, Bash, `curl`, `jq`, and [Ollama](https://ollama.com).
Docker Desktop can provide Docker on other systems. Extension packaging uses the included
`web-ext` development dependency.

```sh
npm ci
cp .env.example .env
# Edit .env: choose a strong KC_BOOTSTRAP_ADMIN_PASSWORD, supply your licence email,
# and set TIDE_TERMS_ACCEPTED=yes only if you personally agree to https://tide.org/legal.
# Keep .env private; never commit it.
npm run init
# Open the enrollment link it prints and complete your Tide account setup.
# Leave the bootstrap running until data/tidecloak.json is exported.
```

Start Ollama in another terminal if it is not already running, and install the model if needed:

```sh
ollama serve
ollama pull qwen3-vl:2b-instruct
npm run extension:build
npm run dev
```

Open **http://localhost:3000** and try the sample as a guest. Sign in with Tide to save findings. Use `localhost` consistently:
the OIDC redirect and DPoP URL must match the registered origin. The app and TideCloak ports bind to
loopback. Customize the model with `OLLAMA_URL` and `OLLAMA_MODEL` in an ignored environment file.
The assistant never downloads models automatically.

Keep `BRAND_SKIP=1` to retain TideCloak's own sign-in design. Margin's sage theme applies to the
reading workspace. New readers can optionally add a display name after signing in, skip it, or
change it in Settings. No extra email is requested.

The bootstrap owns only the `margin-auth` container and persistent `margin-auth-data` volume. It
preserves existing data and refuses to overwrite a partially configured realm. An interrupted
first enrollment should be recovered in TideCloak rather than solved by deleting the database.

Tide network availability affects enrollment and sign-in. The app reports authentication errors
without granting access to a private library. The realm template registers
`http://localhost:3000/auth/redirect` for login and `http://localhost:3000` for logout. The SDK keeps
its normal login callback and uses the already-registered app origin when signing out. Changes to
a governed realm require its owner's Tide approval.

**Secure Session Verification** is Tide's browser-key verification step. It can appear without
asking for credentials again when Tide already remembers your account. A completed login shows
**Signed in with Tide** in Margin and enables your personal library. If the browser requests local
network access for Tide's sign-in host, it needs that permission to reach this local installation;
see [Tide's local browser guidance](https://docs.tide.org/FAQ/chromium-error) and
[DPoP verification](https://docs.tide.org/Core-Concepts/dpop).

## Browser extension

Run the local app, then open a browser with the extension loaded in its own development profile:

```sh
npm run extension:open -- chrome
# Or:
npm run extension:open -- firefox
```

The Chrome launcher needs Chromium or Chrome for Testing; set `CHROMIUM_PATH` if necessary.
The Firefox launcher supports Firefox or LibreWolf; set `FIREFOX_PATH` if necessary. Firefox's
temporary add-on lasts for that browser session. These commands preserve your normal browser
profile and rebuild the extension automatically.

For manual development installation, run `npm run extension:build`. Load
`artifacts/extension-chrome/` with **Load unpacked** in `chrome://extensions`, or load
`artifacts/extension-firefox/manifest.json` using **Load Temporary Add-on** in
`about:debugging#/runtime/this-firefox`.

The build also creates `artifacts/margin-chrome.zip` and `artifacts/margin-firefox.unsigned.xpi`
for developer submission. The Firefox package is unsigned. Public store listings are not yet
published; the app shows local setup instructions and only enables store install links when real
listing URLs are configured. See [release details](docs/EXTENSION_STORE.md) and [privacy](docs/PRIVACY.md).
Guest tools work while the local app is running. To save, keep a Margin web app tab open and signed
in on the same computer.

Select text → right-click → Explore with Margin. The toolbar action and Ctrl+Shift+M also capture
selection. Results open in a side panel; saving sends the finding to the signed-in user's library.
The web app streams answers. The extension shows the completed response after inference and keeps the current finding when its panel is reopened. Signed-in requests pass through the first-party app bridge.

## Development and validation

See [the API contract](docs/API.md) for integration details.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run doctor -- --check
```

Browser tests require a running app and system Chromium (`CHROMIUM_PATH` can override the binary).
Authenticated cases use a local Playwright storage-state file supplied with `MARGIN_BROWSER_STATE`;
keep that file in an ignored directory. `MARGIN_LIVE_AI=1` also enables real model/source checks.
Guest selection, text/PDF import, and signed-out API rejection checks do not need credentials.
The browser suite also checks hydration when another extension inserts known content-scanner
attributes before React starts. Translation uses bundled Noto fonts with Vietnamese glyph support,
and translated findings keep their language when saved. Chrome's selection-to-answer flow has
been exercised locally; Firefox packaging and linting are checked, with its full reading flow
still pending verification.

Source retrieval prioritizes official documentation, government and university pages, and research abstracts from [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/). Wikipedia can help discover external references; at most one Wikipedia background source is included when primary excerpts and abstracts are unavailable. Familiar sample topics also have curated primary-source starting points.

Answers show numbered citations, **Sources cited**, and **Explore further**. Labels distinguish excerpts, abstracts, metadata, and preprints. Metadata-only records are never given to the model as evidence. Domain names and DOIs do not guarantee correctness or peer review; open the sources to assess important claims.

Findings and collections live in `.data/margin.sqlite`. The last reading is namespaced by user in
browser storage. Existing pre-auth development records are preserved under `legacy-local` and are
not automatically assigned to a new account. Export saved findings as Markdown from the app.

## Deployment scope

This configuration is for local development. Internet deployment additionally needs a stable HTTPS
origin registered before realm bootstrap, production database/backup operations, and validation of
the intended extension origin and hosting environment. Saved findings and the optional display name are stored in the local database, separated by the verified Tide subject. The prototype does not claim end-to-end encryption of saved text. Raziel, Tide's guidance MCP server, is separate from the Ollama inference
backend and does not act as the app's language model.
