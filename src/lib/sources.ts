import type { Source } from "./types";

const headers = { "User-Agent": "Margin/0.1 (local research and learning workspace)", Accept: "application/json" };
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const known: Record<string, Source> = {
  mcp: { title: "What is the Model Context Protocol?", url: "https://modelcontextprotocol.io/docs/getting-started/intro", kind: "official", excerpt: "MCP is an open standard that lets AI applications connect to external data, tools, and workflows through compatible clients and servers." },
};
export function searchTerm(text: string, context = ""): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (/^(mcp|model context protocol)$/i.test(clean) && (!context || /\b(ai|model|assistant|protocol|llm|tools?)\b/i.test(context))) return "Model Context Protocol";
  if (/^rag$/i.test(clean) && /\b(ai|model|generation|retriev|llm)\b/i.test(context)) return "retrieval augmented generation";
  return clean.slice(0, 220);
}
async function wiki(query: string): Promise<Source[]> {
  const endpoint = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
  endpoint.search = new URLSearchParams({ q: query, limit: "4" }).toString();
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Wikipedia search is unavailable");
  const data = await response.json();
  return (data.pages || []).map((page: { title: string; key: string; excerpt?: string; description?: string }) => ({
    title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
    excerpt: plain(page.excerpt || page.description || ""), kind: "reference" as const,
  }));
}
async function crossref(query: string): Promise<Source[]> {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.search = new URLSearchParams({ query, rows: "4", select: "DOI,title,publisher,published,abstract" }).toString();
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Paper search is unavailable");
  const data = await response.json();
  return (data.message?.items || []).filter((item: { DOI?: string }) => item.DOI).map((item: { DOI: string; title?: string[]; abstract?: string; publisher?: string; published?: { "date-parts"?: number[][] } }) => ({
    title: plain(item.title?.[0] || item.DOI), url: `https://doi.org/${item.DOI}`,
    excerpt: plain(item.abstract || `Publication metadata from ${item.publisher || "Crossref"}. Full text has not been retrieved.`).slice(0, 1000),
    year: item.published?.["date-parts"]?.[0]?.[0], kind: "paper" as const,
  }));
}
export async function searchSources(text: string, context = "", papers = false): Promise<{ sources: Source[]; notices: string[] }> {
  const query = searchTerm(text, context);
  const results = await Promise.allSettled([wiki(query), ...(papers ? [crossref(query)] : [])]);
  const sources = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const notices = results.flatMap((result) => result.status === "rejected" ? [result.reason.message as string] : []);
  if (query === "Model Context Protocol") sources.unshift(known.mcp);
  const unique = sources.filter((source, i) => sources.findIndex((s) => s.url === source.url) === i);
  return { sources: unique, notices };
}
