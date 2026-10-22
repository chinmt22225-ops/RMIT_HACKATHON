import type { Source } from "./types";

export function citedSourceNumbers(answer: string, sources: Source[]) {
  return new Set([...answer.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1])).filter(n => n > 0 && n <= sources.length && sources[n - 1].evidence !== "metadata"));
}
export function sourceLabel(source: Source) {
  const kind = { official: "Official documentation", academic: "University / academic website", government: "Government website", paper: "Research publication", preprint: "Preprint · peer review not verified", reference: "Wikipedia · background" }[source.kind];
  const material = source.evidence === "metadata" ? "metadata only" : source.evidence === "abstract" ? "abstract retrieved" : source.evidence === "excerpt" ? "excerpt retrieved" : "";
  return [kind, material, source.year].filter(Boolean).join(" · ");
}
