# Browser extension setup and release

Margin includes Chrome and Firefox extension packages. Its local setup commands load the extension
into a separate development browser profile. Public install buttons link to a configured Chrome
Web Store or Mozilla Add-ons listing; the browser then asks the user to confirm installation.

Neither listing has been published. Store publication requires the corresponding developer account,
package submission, privacy disclosures, and review/signing. Until then, the app shows local setup
instructions. An unsigned Firefox package is not a permanent public installation.

## Local use

With the app and Ollama running:

```sh
npm run extension:open -- chrome
# Or:
npm run extension:open -- firefox
```

Use Chromium or Chrome for Testing for the Chrome launcher (`CHROMIUM_PATH` overrides the binary).
Use Firefox or LibreWolf for Firefox (`FIREFOX_PATH` overrides the binary). The launcher creates
its own profile under `.runtime/`; your regular profile is preserved. Firefox loads a temporary
add-on that must be loaded again in a later browser session.

For manual loading, `npm run extension:build` prepares `artifacts/extension-chrome/` for
**Load unpacked** in `chrome://extensions`, and `artifacts/extension-firefox/manifest.json` for
**Load Temporary Add-on** in `about:debugging#/runtime/this-firefox`. Firefox requires version 142
or newer. This workflow does not require a store account.

## Prepared listing copy

**Name:** Margin — follow your curiosity

**Summary:** Explain, research, translate, and save selected text to your Margin workspace.

**Description:**

Follow an unfamiliar idea without leaving the page you are reading. Select a term or passage and open Margin's side panel to explain it in context, find research and official sources, translate it, simplify it, or explore examples. Ask a follow-up and keep the useful discoveries in your personal library.

Margin prioritizes official documentation, university and government material, and research publications. It separates cited sources from further reading and labels excerpts, abstracts, and preprints. Wikipedia is a limited background fallback.

The extension requires the Margin app and local model running on the same computer at localhost:3000. Guest research works without an account. To save, keep a Margin tab open and sign in using TideCloak. This version is a local companion, not a hosted cloud service.

**Category:** Education

**Privacy:** [Margin privacy](PRIVACY.md). Use a public URL for this document in the developer dashboard.

## Permission explanations

- `activeTab` and `scripting`: capture a selection after an explicit action; call the first-party Margin tab to make signed requests.
- `contextMenus`: show the selection actions on right-click.
- Chrome `sidePanel` / Firefox `sidebar_action`: display the explanation alongside the original page.
- `storage`: preserve the current selection and completed response for the browser session.
- localhost host access: connect to the locally running Margin app. There is no blanket access to every website.

Disclose selected website content, its URL/title, the user's questions, and saved content in the dashboard's privacy questionnaire. Describe transmission to the local app and selected-query transmission to research providers. Do not claim that a DOI guarantees peer review or that all processing remains on the device.

## Package and connect store listings

1. Run `npm run extension:build`. Developer upload packages are `artifacts/margin-chrome.zip` and
   `artifacts/margin-firefox.unsigned.xpi`; both include their browser's manifest, scripts, panel,
   fonts and licence, and PNG icons.
2. Upload the appropriate package to the Chrome Web Store or Mozilla Add-ons developer dashboard.
   Supply screenshots of the actual panel and a public privacy URL. Complete the dashboard's
   disclosures, including Firefox's selected website content/activity disclosure, and review the
   final listing before submitting it.
3. Once published, set `MARGIN_CHROME_STORE_URL` to the real
   `https://chromewebstore.google.com/detail/...` listing and/or `MARGIN_FIREFOX_STORE_URL` to the
   real `https://addons.mozilla.org/.../firefox/addon/.../` listing. Rebuild/restart the app.
   Margin validates the store domain before exposing the matching install button.

Chrome's local selection-to-answer flow has been checked. Firefox packaging and linting have been
checked; its complete reading-and-saving flow still needs verification before publication.
