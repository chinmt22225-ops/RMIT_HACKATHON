# Margin privacy

Margin is a local reading and research prototype. The browser extension connects to the Margin app on the same computer at `http://localhost:3000`.

## What is processed

When you explicitly use the extension's toolbar, keyboard shortcut, or selection menu, it captures the selected text, nearby paragraph, page title, and page URL. It does not continuously read pages or collect browsing history. The current selection and answer are kept in the extension's session storage so reopening the panel preserves your work.

The app sends the selected search term to Crossref and, when needed, Wikipedia to discover relevant references. It retrieves eligible public source pages directly. The surrounding passage and follow-up conversation are sent to the configured model server. The default is Ollama running locally; an operator who changes that server is responsible for explaining the new destination to their users.

TideCloak handles sign-in. The extension does not receive access tokens, DPoP private keys, passwords, or operator credentials. Saving requires a signed-in Margin tab, which makes the protected request for the extension.

## Saved information

Saved findings contain the selection, context, answer, source links, personal notes, and collection choice. The local SQLite database associates them with the verified Tide account ID. An optional display name is stored there too. This prototype separates users' libraries through server authorization; it does not encrypt saved text end to end.

The web app keeps the current reading in browser storage, separately for each account and for guests. A pending finding can be held in session storage while signing in.

## Controls

You can use the reading and assistant tools without signing in. You choose when to save, can delete saved findings and collections, and can export your library as Markdown. You can skip or clear the optional display name in Settings. Clearing Margin's browser storage removes local reading drafts; uninstalling the extension removes its local state.

Margin contains no advertising, analytics SDK, sale of reading data, or model training pipeline. External research services and Tide operate under their own policies. Review those services when deciding what text to research.
