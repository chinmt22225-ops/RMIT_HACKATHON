import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { body, failure } from "@/lib/http";
export const runtime = "nodejs";

function privateAddress(address: string): boolean {
  if (isIP(address) === 6) return /^(::|fc|fd|fe[89ab])/i.test(address) || address.includes(".") || address.startsWith("::ffff:");
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224 || a === 100 && b >= 64 && b <= 127;
}
export async function POST(request: Request) {
  try {
    const input = await body(request, z.object({ url: z.url().max(3000) }));
    let url = new URL(input.url);
    let response: Response | undefined;
    for (let i = 0; i < 4; i++) {
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port && !["80", "443"].includes(url.port)) throw new Error("Use a public HTTP or HTTPS article URL.");
      const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
      if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error("Only public article URLs can be imported.");
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Margin/0.1 article-reader", Accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Article redirected without a destination.");
        url = new URL(location, url);
        response = undefined;
        continue;
      }
      break;
    }
    if (!response?.ok) throw new Error("This page could not be imported. Try pasting its text instead.");
    if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Use an article URL, or upload a PDF or text file.");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let html = ""; let bytes = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 3_000_000) { await reader.cancel(); throw new Error("Page is too large. Paste the relevant passage instead."); }
        html += decoder.decode(part.value, { stream: true });
      }
    } finally { reader.releaseLock(); }
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const extracted = article?.content ? parseHTML(`<html><body>${article.content}</body></html>`).document : null;
    const paragraphs = extracted ? Array.from(extracted.querySelectorAll("p, h1, h2, h3, li, pre")).map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean) : [];
    const text = (paragraphs.length ? paragraphs.join("\n\n") : article?.textContent)?.trim();
    if (!text || text.length < 50) throw new Error("This page needs a browser to display its text. Use the extension or paste the passage.");
    return Response.json({ reading: { title: article?.title || document.title || url.hostname, subtitle: url.hostname, text: text.slice(0, 180_000), url: url.toString(), kind: "Web article" } });
  } catch (error) { return failure(error); }
}
