"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { ExtensionStores } from "@/lib/extensionStores";

export default function ExtensionInstall({ stores }: { stores: ExtensionStores }) {
  const [preferred, setPreferred] = useState<keyof ExtensionStores>("chrome");
  const [copied, setCopied] = useState("");
  useEffect(() => { if (/Firefox\//i.test(navigator.userAgent)) setPreferred("firefox"); }, []);
  const browsers: (keyof ExtensionStores)[] = preferred === "firefox" ? ["firefox", "chrome"] : ["chrome", "firefox"];
  return <div className="extension-install">
    <div className="extension-store-options">{browsers.map(browser => {
      const name = browser === "chrome" ? "Chrome" : "Firefox", url = stores[browser];
      return <div className="extension-store-option" key={browser}>
        {url ? <a className={`button ${browser === preferred ? "button-primary" : "button-light"}`} href={url} target="_blank" rel="noreferrer">Add to {name}<ArrowUpRight size={17} /></a>
          : <button className="button button-light" disabled>Add to {name}</button>}
        <p className="source-note">{url ? `${name} will ask you to confirm installation.` : `${name} release awaiting store publication.`}</p>
      </div>;
    })}</div>
    {(stores.chrome || stores.firefox) && <p className="source-note">Install directly through your browser’s official add-on store. No ZIP download or extraction.</p>}
    <div className="extension-local">
      <h3>Use it locally today</h3>
      <p>From the Margin project folder, run the command for your browser. It opens a separate demo browser with the extension loaded. Keep Margin running while you use it.</p>
      {browsers.map(browser => <div className="extension-local-command" key={browser}><code>npm run extension:open -- {browser}</code><button className="button button-light" onClick={async () => { try { await navigator.clipboard.writeText(`npm run extension:open -- ${browser}`); setCopied(browser); } catch { setCopied("unavailable"); } }}>{copied === browser ? "Copied" : "Copy"}</button></div>)}
      <p className="source-note">The Chrome demo uses Chromium or Chrome for Testing. The Firefox demo loads a temporary add-on. Your everyday browser profile stays separate.</p>
      {copied === "unavailable" && <p role="status">Select the command above to copy it.</p>}
      <details><summary>Load into your own browser for development</summary><p>Chrome: open <code>chrome://extensions</code>, enable Developer mode, choose Load unpacked, and select <code>artifacts/extension-chrome</code> in the Margin folder.</p><p>Firefox: open <code>about:debugging#/runtime/this-firefox</code>, choose Load Temporary Add-on, and select <code>artifacts/extension-firefox/manifest.json</code>. Repeat after restarting Firefox.</p><p>Run <code>npm run extension:build</code> first if these folders don’t exist yet.</p></details>
    </div>
    <p className="source-note"><CheckCircle2 size={14} /> Keep the Margin app running on this computer. To save a finding, sign in to a Margin tab in the same browser.</p>
  </div>;
}
