import { ArrowUpRight } from "lucide-react";
import type { Source } from "@/lib/types";
import { citedSourceNumbers, sourceLabel } from "@/lib/sourcePresentation";
import { safeUrl } from "./Markdown";

export default function Sources({ sources, answer, prefix = "source" }: { sources: Source[]; answer: string; prefix?: string }) {
  if (!sources.length) return null;
  const cited = citedSourceNumbers(answer, sources);
  const numbered = sources.map((source, i) => ({ source, number: i + 1 }));
  const groups = [
    { title: "SOURCES CITED", items: numbered.filter(item => cited.has(item.number)) },
    { title: "EXPLORE FURTHER", items: numbered.filter(item => !cited.has(item.number)) },
  ];
  return <div className="sources">{groups.filter(group => group.items.length).map(group => <div key={group.title} className="source-group">
    <div className="section-caption">{group.title}<span>{group.items.length}</span></div>
    {group.items.map(({ source, number }) => <a id={`${prefix}-${number}`} key={source.url} className="source-card" href={safeUrl(source.url)} target="_blank" rel="noreferrer">
      <span className="source-number">{number}</span><div><strong>{source.title}</strong><span>{sourceLabel(source)}</span>{source.publisher && <span>{source.publisher}</span>}</div><ArrowUpRight size={14} />
    </a>)}
  </div>)}<p className="source-note">Cited links are referenced in the answer; further reading offers more to explore. Excerpts and abstracts are partial. Open each source to review its context.</p></div>;
}
