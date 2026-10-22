export type ExtensionStores = { chrome: string | null; firefox: string | null };

export function extensionStoreUrl(browser: keyof ExtensionStores, value = ""): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (browser === "chrome" && url.hostname === "chromewebstore.google.com" && /^\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname)) return url.href;
    if (browser === "firefox" && url.hostname === "addons.mozilla.org" && /^\/(?:[a-z]{2,3}(?:-[A-Za-z]{2,4})?\/)?firefox\/addon\/[a-z0-9_-]+\/?$/.test(url.pathname)) return url.href;
  } catch {}
  return null;
}
