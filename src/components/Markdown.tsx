import { Fragment } from "react";
export function safeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : ""; }
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^\[\d+\]$/.test(part)) return <a key={i} className="citation" href={`#source-${part.slice(1, -1)}`}>{part}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export default function Markdown({ text }: { text: string }) {
  return <div className="markdown">{text.split(/\n\n+/).map((block, index) => {
    if (/^#{1,4} /.test(block)) return <h3 key={index}>{inline(block.replace(/^#{1,4} /, ""))}</h3>;
    if (block.split("\n").every((line) => /^(?:[-*]|\d+[.)]) /.test(line))) return <ul key={index}>{block.split("\n").map((line, i) => <li key={i}>{inline(line.replace(/^(?:[-*]|\d+[.)]) /, ""))}</li>)}</ul>;
    return <p key={index}>{inline(block)}</p>;
  })}</div>;
}
