import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { readPublicArticle } from "./publicArticle";
import type { Source } from "./types";

const headers = { "User-Agent": "Margin/0.1 (local research and learning workspace)", Accept: "application/json" };
const plain = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const officialHosts = ["modelcontextprotocol.io", "docs.tide.org", "nist.gov", "w3.org", "ietf.org", "rfc-editor.org", "who.int", "ipcc.ch", "worldbank.org", "oecd.org", "stlouisfed.org"];
const known: Record<string, string[]> = {
  "model context protocol": ["https://modelcontextprotocol.io/docs/getting-started/intro", "https://modelcontextprotocol.io/docs/learn/architecture"],
  photosynthesis: ["https://www.energy.gov/cmei/fuels/full-text-glossary", "https://www.energy.gov/science/articles/photosynthesis-gathering-sunshine-worlds-smallest-antennas"],
  "why is the sky blue": ["https://spaceplace.nasa.gov/blue-sky/en/"],
  "opportunity cost": ["https://www.stlouisfed.org/education/economic-lowdown-podcast-series/episode-1-opportunity-cost"],
};
const cache = new Map<string, { until: number; value: { sources: Source[]; notices: string[] } }>();

export function searchTerm(text: string, context = ""): string {
  const clean = text.trim().replace(/\s+/g, " ").replace(/^(?:what (?:is|are)|explain)\s+/i, "").replace(/[?.!]+$/, "");
  if (/^(mcp|model context protocol)$/i.test(clean) && (!context || /\b(ai|model|assistant|protocol|llm|tools?)\b/i.test(context))) return "Model Context Protocol";
  if (/^rag$/i.test(clean) && /\b(ai|model|generation|retriev|llm)\b/i.test(context)) return "retrieval augmented generation";
  return clean.slice(0, 220);
}

// This is a discovery preference, not a guarantee that every page is correct.
// Check the hostname boundary: university.edu.evil.com is not an academic site.
export function preferredKind(input: string): Source["kind"] | null {
  try {
    const url = new URL(input); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const h = url.hostname.toLowerCase();
    if (/(?:^|\.)gov(?:\.[a-z]{2})?$/.test(h)) return "government";
    if (/(?:^|\.)(?:edu(?:\.[a-z]{2})?|ac\.(?:uk|jp|nz|kr|za))$/.test(h)) return "academic";
    if (h === "arxiv.org" || h.endsWith(".arxiv.org") || h === "biorxiv.org" || h.endsWith(".biorxiv.org") || h === "medrxiv.org" || h.endsWith(".medrxiv.org")) return "preprint";
    if (officialHosts.some(host => h === host || h.endsWith(`.${host}`))) return "official";
  } catch {}
  return null;
}
const tokens = (text: string) => plain(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter(t => !["the", "and", "for", "with", "what", "does", "that", "this", "from", "how", "are"].includes(t)) || [];
export function relevance(query: string, title: string): number {
  const terms = [...new Set(tokens(query))]; const target = tokens(title);
  if (!terms.length) return 0;
  return terms.filter(t => target.includes(t)).length / terms.length;
}

async function wikiDiscovery(query: string): Promise<Source[]> {
  const endpoint = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
  endpoint.search = new URLSearchParams({ q: query, limit: "3" }).toString();
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Reference discovery is unavailable.");
  const data = await response.json();
  const pages = (data.pages || []).filter((page: { title: string }) => relevance(query, page.title) >= 0.6);
  return pages.slice(0, 1).map((page: { title: string; key: string; excerpt?: string; description?: string }) => ({
    title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
    excerpt: plain(page.excerpt || page.description || ""), kind: "reference" as const, evidence: "excerpt" as const,
  }));
}
async function referenceLinks(page: Source, query: string): Promise<string[]> {
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "query", prop: "extlinks", titles: page.title, ellimit: "500", format: "json", formatversion: "2" }).toString();
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return [];
  const data = await response.json();
  const links: string[] = (data.query?.pages || []).flatMap((p: { extlinks?: { url: string }[] }) => (p.extlinks || []).map(l => l.url));
  const rank = (input: string) => {
    const url = new URL(input);
    return relevance(query, decodeURIComponent(url.pathname)) * 100 + (preferredKind(input) === "government" ? 30 : 20) - (/ui\.adsabs\./.test(url.hostname) ? 50 : 0);
  };
  return links.filter(url => preferredKind(url) && !/\.(pdf|zip|png|jpe?g)(?:[?#]|$)/i.test(url)).sort((a, b) => rank(b) - rank(a));
}
async function primaryPage(input: string, query: string): Promise<Source | null> {
  const { html, url } = await readPublicArticle(input);
  // Redirects must retain an eligible source class as well as pass SSRF checks.
  const kind = preferredKind(url.href); if (!kind) return null;
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const text = plain(article?.textContent || "").slice(0, 200_000);
  const title = plain(article?.title || document.title || url.hostname).slice(0, 500);
  if (text.length < 120 || relevance(query, `${title} ${text}`) < 0.6) return null;
  const extracted = parseHTML(`<html><body>${article?.content || ""}</body></html>`).document;
  const paragraphs = [...extracted.querySelectorAll("p, li")].map(node => plain(node.textContent || "")).filter(p => p.length >= 80);
  if (!paragraphs.length) paragraphs.push(text.slice(0, 1400));
  const ranked = paragraphs.map((p, i) => ({ p, i, score: relevance(query, p) + (p.toLowerCase().startsWith(query.toLowerCase()) ? 2 : 0) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const excerpt = ranked.slice(0, 3).sort((a, b) => a.i - b.i).map(item => item.p).join(" ").trim().slice(0, 1400);
  return { title, url: url.href, excerpt, kind, publisher: url.hostname, evidence: "excerpt" };
}
async function crossref(query: string): Promise<Source[]> {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.search = new URLSearchParams({ "query.title": query, rows: "8", filter: "has-abstract:true", select: "DOI,title,publisher,published,abstract,type", sort: "relevance" }).toString();
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("Scholarly search is unavailable.");
  const data = await response.json();
  type Work = { DOI?: string; title?: string[]; abstract?: string; publisher?: string; type?: string; published?: { "date-parts"?: number[][] } };
  return (data.message?.items || []).filter((item: Work) => item.DOI && ["journal-article", "proceedings-article", "book-chapter", "posted-content"].includes(item.type || "") && (item.type !== "posted-content" || /^10\.(?:48550|1101|26434|36227)\//.test(item.DOI)) && relevance(query, item.title?.[0] || "") >= 0.65 && !/^(retract|withdraw|correction|erratum)/i.test(item.title?.[0] || ""))
    .slice(0, 4).map((item: Work): Source => ({
      title: plain(item.title?.[0] || item.DOI || "Publication").slice(0, 500), url: `https://doi.org/${item.DOI}`,
      excerpt: item.abstract ? plain(item.abstract).slice(0, 1400) : "Bibliographic record only. The paper's findings and full text have not been retrieved.",
      year: item.published?.["date-parts"]?.[0]?.[0], publisher: item.publisher?.slice(0, 500),
      kind: item.type === "posted-content" ? "preprint" : "paper", evidence: item.abstract ? "abstract" : "metadata",
    }));
}
export async function searchSources(text: string, context = "", papers = false): Promise<{ sources: Source[]; notices: string[] }> {
  const query = searchTerm(text, context); const key = `${papers}:${query.toLowerCase()}`;
  const cached = cache.get(key); if (cached && cached.until > Date.now()) return cached.value;
  // Wikipedia can locate references, but its text is excluded when primary
  // excerpts or paper abstracts are available. At most one fallback is used.
  const knownUrls = known[query.toLowerCase()];
  const [scholarly, discovery] = await Promise.allSettled([crossref(query), knownUrls ? Promise.resolve([] as Source[]) : wikiDiscovery(query)]);
  const references = discovery.status === "fulfilled" ? discovery.value : [];
  let urls = knownUrls || [];
  if (!knownUrls && references[0]) {
    try { urls = await referenceLinks(references[0], query); } catch {}
  }
  const distinct = [...new Set(urls)].sort((a, b) => Number(preferredKind(a) === "preprint") - Number(preferredKind(b) === "preprint")).slice(0, papers ? 4 : 3);
  const fetched = await Promise.allSettled(distinct.map(url => primaryPage(url, query)));
  const primary = fetched.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []);
  const publications = scholarly.status === "fulfilled" ? scholarly.value : [];
  const substantive = [...primary, ...publications].some(s => s.evidence !== "metadata");
  const fallback = substantive ? [] : references.slice(0, 1);
  const ordered = [...primary, ...publications.filter(s => s.evidence === "abstract"), ...fallback, ...publications.filter(s => s.evidence === "metadata")];
  const sources = ordered.filter((s, i) => ordered.findIndex(other => other.url === s.url) === i).slice(0, 7);
  const notices: string[] = [];
  if (fallback.length) notices.push("Limited primary-source coverage. One Wikipedia reference is included for background.");
  if (!sources.some(s => s.evidence !== "metadata")) notices.push("No source text was retrieved for this topic. The explanation uses general model knowledge; publication links are for further reading.");
  if (scholarly.status === "rejected") notices.push("Scholarly search is temporarily unavailable; the available sources are shown below.");
  const value = { sources, notices };
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, until: Date.now() + 10 * 60_000 });
  return value;
}
