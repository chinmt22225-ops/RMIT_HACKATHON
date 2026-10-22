# Team handoff

## Product

Margin combines reading, research, everyday learning, and a personal knowledge library. It is not
limited to school subjects or AI. The extension is an entry point into the same app, not a separate
product.

First complete flow: select unfamiliar text → explain or investigate → inspect linked sources → save
the finding with its original passage → organize it and add your own notes.

## Suggested ownership

| Area | Initial owner | Files |
|---|---|---|
| Web app, assistant, persistence | Codex working with k1nt4r0u | `src/`, root package/config files |
| Browser extension improvements | Teammate | `extension/` |
| Shared request/response types | Coordinate before editing | `src/lib/types.ts`, `docs/API.md` |
| TideCloak and security integration after the core flow | Codex, reviewed by the team | Dedicated future branch |

This split is a proposal; agree on it together. There is already a minimal extension so everyone can
test the complete workflow. The teammate can extend it without rewriting the web app.

## Branch workflow

Use one branch per change and open a pull request. Do not push over each other's feature branches.
If working in the same checkout, use separate Git worktrees; otherwise normal separate clones work.

```sh
git clone https://github.com/chinmt22225-ops/RMIT_HACKATHON.git
cd RMIT_HACKATHON
git switch main
git pull --ff-only
git switch -c feat/extension-improvements
npm ci
```

Before a pull request, run type checking, unit tests, the build, and any browser tests relevant to the
change. CI checks the portable core without needing a model, credentials, or a GPU.

## Model setup

Each developer runs Ollama locally or changes `OLLAMA_URL` and `OLLAMA_MODEL` in an ignored
environment file to a team-approved endpoint/model. The initial machine already had
`qwen3-vl:2b-instruct`; it was chosen after testing actual explanations and Vietnamese output.
No team data, environment secrets, or model weights belong in Git.

## Next work

- Test terminology and translations across different topics and languages.
- Improve retrieval, citation quality, and context selection for ambiguous acronyms.
- Extend the reader and extension UX, keyboard navigation, and accessible contrast.
- Add user accounts and server-side ownership checks with TideCloak.
- Validate extension authentication, CORS/origins, request limits, prompt handling, and deployment
  settings before adding a public multi-user deployment.

The unrelated local `tide-tasks` draft was paused during ideation. It is not part of this repository.
