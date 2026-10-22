import { Fragment } from "react";
export function safeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : ""; }
function inline(text: string, prefix: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^\[\d+\]$/.test(part)) return <a key={i} className="citation" href={`#${prefix}-${part.slice(1, -1)}`}>{part}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export default function Markdown({ text, citationPrefix = "source", lang }: { text: string; citationPrefix?: string; lang?: string }) {
  return <div className="markdown" lang={lang} dir="auto">{text.split(/\n\n+/).map((block, index) => {
    if (/^#{1,4} /.test(block)) return <h3 key={index}>{inline(block.replace(/^#{1,4} /, ""), citationPrefix)}</h3>;
    if (block.split("\n").every((line) => /^(?:[-*]|\d+[.)]) /.test(line))) return <ul key={index}>{block.split("\n").map((line, i) => <li key={i}>{inline(line.replace(/^(?:[-*]|\d+[.)]) /, ""), citationPrefix)}</li>)}</ul>;
    return <p key={index}>{inline(block, citationPrefix)}</p>;
  })}</div>;
}
