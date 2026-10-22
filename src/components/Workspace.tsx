"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Copy, Download, FileText, Folder, Highlighter, Languages, Library, Link, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Search, Settings, Sparkles, Trash2, Upload, WandSparkles, X, Zap } from "lucide-react";
import type { Action, Collection, Insight, Reading, Selection, Source } from "@/lib/types";
import { sample } from "@/lib/sample";
import Markdown, { safeUrl } from "./Markdown";

const actions: { key: Action; label: string; icon: typeof Sparkles }[] = [
  { key: "explain", label: "Explain", icon: Sparkles }, { key: "research", label: "Research", icon: Search },
  { key: "translate", label: "Translate", icon: Languages }, { key: "simplify", label: "Simplify", icon: WandSparkles },
  { key: "examples", label: "Examples", icon: Zap },
];
type View = "explore" | "library" | "collections" | "extension" | "settings";
type Message = { role: "user" | "assistant"; content: string };
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const value = await response.json(); if (!response.ok) throw new Error(value.error || "Something went wrong."); return value;
}
const post = (value: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

export default function Workspace() {
  const [view, setView] = useState<View>("explore");
  const [reading, setReading] = useState<Reading>(sample);
  const [mode, setMode] = useState<"reader" | "ask">("reader");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [floating, setFloating] = useState<{ x: number; y: number } | null>(null);
  const [answer, setAnswer] = useState(""); const [sources, setSources] = useState<Source[]>([]);
  const [action, setAction] = useState<Action>("explain"); const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false); const [stage, setStage] = useState("");
  const [provider, setProvider] = useState(""); const [error, setError] = useState("");
  const [notices, setNotices] = useState<string[]>([]); const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState(""); const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("Vietnamese");
  const [insights, setInsights] = useState<Insight[]>([]); const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState(""); const [filterCollection, setFilterCollection] = useState("");
  const [filter, setFilter] = useState(""); const [saved, setSaved] = useState(false); const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(""); const [modal, setModal] = useState<"import" | "collection" | null>(null);
  const [importKind, setImportKind] = useState("text"); const [importTitle, setImportTitle] = useState("");
  const [importText, setImportText] = useState(""); const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false); const [importError, setImportError] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [detail, setDetail] = useState<Insight | null>(null);
  const [status, setStatus] = useState<{ available: boolean; model: string } | null>(null);
  const doc = useRef<HTMLElement>(null); const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    try { const [a, b] = await Promise.all([json<{ insights: Insight[] }>("/api/library"), json<{ collections: Collection[] }>("/api/collections")]); setInsights(a.insights); setCollections(b.collections); }
    catch (e) { setToast((e as Error).message); }
  }
  useEffect(() => {
    refresh(); json<{ available: boolean; model: string }>("/api/status").then(setStatus).catch(() => {});
    try { const stored = localStorage.getItem("margin-reading"); if (stored) { const r = JSON.parse(stored); if (typeof r.text === "string" && typeof r.title === "string") setReading(r); } const lang = localStorage.getItem("margin-language"); if (lang) setLanguage(lang); } catch {}
    const params = new URLSearchParams(location.search);
    if (params.has("text")) { const text = params.get("text")!.slice(0, 12000); setMode("ask"); setTopic(text); setSelection({ text, context: params.get("context") || "", url: params.get("url") || "", title: params.get("title") || "From your browser" }); }
    return () => abort.current?.abort();
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4000); return () => clearTimeout(id); }, [toast]);

  function openReading(next: Reading) {
    abort.current?.abort(); setBusy(false); setReading(next); setView("explore"); setMode("reader"); setSelection(null); setAnswer(""); setSources([]); setComplete(false); setFloating(null); setModal(null);
    try { localStorage.setItem("margin-reading", JSON.stringify(next)); } catch { setToast("This document is too large to keep between visits."); }
  }
  function capture() {
    const current = window.getSelection(); if (!current?.rangeCount || !doc.current?.contains(current.anchorNode) || !doc.current.contains(current.focusNode)) return;
    const text = current.toString().trim(); if (!text) { setFloating(null); return; } if (text.length > 12000) { setToast("Select a shorter passage (up to 12,000 characters)."); return; }
    const range = current.getRangeAt(0).getBoundingClientRect();
    const parent = current.anchorNode?.parentElement?.closest("p")?.textContent || reading.text.slice(0, 6000);
    if (text !== selection?.text || parent !== selection?.context) {
      abort.current?.abort(); setBusy(false); setAnswer(""); setSources([]); setComplete(false); setSaved(false); setError(""); setHistory([]);
    }
    setSelection({ text, context: parent, title: reading.title, url: reading.url });
    setFloating({ x: Math.max(180, Math.min(innerWidth - 200, range.left + range.width / 2)), y: Math.max(90, range.top - 54) });
  }
  async function run(nextAction: Action, chosen = selection, followup = "") {
    if (!chosen?.text.trim()) { setToast("Select a passage or enter something you’re curious about."); return; }
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const previous = answer; const oldHistory = history;
    setSelection(chosen); setFloating(null); setAction(nextAction); setAnswer(""); setSources([]); setError(""); setNotices([]); setSaved(false); setComplete(false); setBusy(true); setStage("Getting ready…");
    const nextHistory = followup ? [...oldHistory, { role: "assistant" as const, content: previous }, { role: "user" as const, content: followup }].slice(-4) : [];
    setHistory(nextHistory);
    try {
      const response = await fetch("/api/assist", { ...post({ selection: chosen, action: nextAction, language, question: followup || undefined, history: nextHistory }), signal: controller.signal });
      if (!response.ok || !response.body) { const data = await response.json(); throw new Error(data.error || "Could not reach the assistant."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      try {
        while (true) {
          const part = await reader.read(); buffer += decoder.decode(part.value, { stream: !part.done });
          const lines = buffer.split("\n"); buffer = lines.pop() || "";
          if (part.done && buffer.trim()) lines.push(buffer);
          for (const line of lines) { if (!line.trim()) continue; const event = JSON.parse(line);
            if (event.type === "delta") setAnswer((text) => text + event.text);
            if (event.type === "sources") { setSources(event.sources); setNotices(event.notices); setProvider(event.provider); }
            if (event.type === "status") setStage(event.message);
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "done") setComplete(true);
          }
          if (part.done) break;
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (abort.current === controller) setBusy(false); }
  }
  async function save() {
    if (!selection || !complete) return;
    setSaving(true);
    try { await json("/api/library", post({ selection, action, answer, sources, collectionId: collectionId || null, note: "", provider })); setSaved(true); setToast("Finding saved to your library."); await refresh(); }
    catch (e) { setToast((e as Error).message); } finally { setSaving(false); }
  }
  async function importFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { setImportError("Choose a file smaller than 20 MB."); return; }
    setImporting(true); setImportError("");
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const pdf = await task.promise;
        try { for (let i = 1; i <= Math.min(pdf.numPages, 150); i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("") + "\n\n"; if (text.length > 180000) break; } }
        finally { await task.destroy(); }
      } else text = await file.text();
      if (!text.trim()) throw new Error("No selectable text found. Scanned documents need OCR, which is not available yet.");
      openReading({ title: file.name.replace(/\.[^.]+$/, ""), subtitle: file.name, text: text.slice(0, 180000), url: "", kind: file.name.endsWith(".pdf") ? "PDF document" : "Text document" });
    } catch (e) { setImportError((e as Error).message); } finally { setImporting(false); }
  }
  async function submitImport(e: FormEvent) {
    e.preventDefault(); setImportError("");
    if (importKind === "text") { if (!importText.trim()) return; openReading({ title: importTitle.trim() || "Untitled reading", subtitle: "Your own material", text: importText.slice(0, 180000), url: "", kind: "Pasted text" }); return; }
    setImporting(true); try { const result = await json<{ reading: Reading }>("/api/reader", post({ url: importUrl })); openReading(result.reading); } catch (e) { setImportError((e as Error).message); } finally { setImporting(false); }
  }
  function exportLibrary() {
    const text = insights.map((item) => `# ${item.selection.text}\n\n${item.answer}\n\n${item.note ? `## My notes\n${item.note}\n\n` : ""}## Sources\n${item.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n")}\n\nCaptured from: ${item.selection.title}${item.selection.url ? ` (${item.selection.url})` : ""}\n`).join("\n---\n\n");
    const url = URL.createObjectURL(new Blob([text || "Your Margin library is empty."], { type: "text/markdown;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "margin-library.md"; a.click(); URL.revokeObjectURL(url);
  }
  const filtered = insights.filter((item) => (!filterCollection || item.collectionId === filterCollection) && `${item.selection.text} ${item.answer} ${item.note}`.toLowerCase().includes(filter.toLowerCase()));
  const activeCollection = collections.find((c) => c.id === filterCollection);

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("explore")} aria-label="Margin home"><span className="brand-mark"><BookOpen size={23} strokeWidth={1.5} /></span><span>margin<span className="brand-dot">.</span></span></button>
      <div className="workspace-label"><span className="avatar">Y</span><span>Your workspace<small>A little more curious, every day</small></span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{([{ id: "explore", label: "Explore", icon: Compass }, { id: "library", label: "My library", icon: Library }, { id: "collections", label: "Collections", icon: Folder }] as const).map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => { setView(id); setFilterCollection(""); }}><Icon size={18} /><span>{label}</span>{id === "library" && <small>{insights.length}</small>}</button>)}</nav>
      <div className="nav-label collection-heading">COLLECTIONS<button title="New collection" onClick={() => setModal("collection")}><Plus size={15} /></button></div>
      <div className="collection-nav">{collections.length ? collections.map((collection) => <button key={collection.id} className={`collection-item ${filterCollection === collection.id && view === "library" ? "selected" : ""}`} onClick={() => { setFilterCollection(collection.id); setView("library"); }}><span className="color-dot" style={{ background: collection.color }} />{collection.name}<small>{insights.filter((i) => i.collectionId === collection.id).length}</small></button>) : <button className="subtle create-first" onClick={() => setModal("collection")}><Plus size={14} /> Create your first collection</button>}</div>
      <div className="sidebar-bottom"><button className="extension-teaser" onClick={() => setView("extension")}><span className="extension-icon"><Highlighter size={20} /></span><strong>Curiosity, everywhere.</strong><span>Take Margin along as you browse.</span><span className="teaser-link">Get the extension <ArrowUpRight size={14} /></span></button><button className="nav-item" onClick={() => setView("settings")}><Settings size={17} />Settings<span className={`status-dot ${status?.available ? "online" : ""}`} /></button><div className="sidebar-foot">A space for your next discovery.</div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb">Your workspace<ChevronRight size={14} /><strong>{view === "explore" ? "Explore" : view === "library" ? "My library" : view.charAt(0).toUpperCase() + view.slice(1)}</strong></div><div className="topbar-actions"><span className="local-badge"><span className="status-dot online" />Personal workspace</span><button className="icon-button" title="Help and extension setup" onClick={() => setView("extension")}><CircleHelp size={18} /></button><span className="avatar avatar-small">Y</span></div></header>
      {view === "explore" && <>
        <section className="page-heading"><div><div className="eyebrow">FOLLOW YOUR CURIOSITY</div><h1>Every great idea starts with a question<span>.</span></h1><p>Read, wonder, understand. Keep the discoveries that matter.</p></div><button className="button button-light" onClick={() => { setImportError(""); setModal("import"); }}><Plus size={17} />Add something to read</button></section>
        <div className="workbench">
          <section className="reader-panel"><div className="panel-toolbar"><div className="tabs"><button className={mode === "reader" ? "active" : ""} onClick={() => setMode("reader")}><BookOpen size={16} />Reader</button><button className={mode === "ask" ? "active" : ""} onClick={() => setMode("ask")}><Sparkles size={15} />Ask anything</button></div><button className="icon-button" title="Open a document" onClick={() => setModal("import")}><Upload size={16} /></button></div>
          {mode === "reader" ? <><div className="reading-hint"><Highlighter size={14} /><span>Select a word, a sentence, or a whole idea to explore it.</span></div><article ref={doc} className="reading" onMouseUp={capture} onKeyUp={capture}><div className="document-meta"><span>{reading.kind}</span><span>·</span><span>{Math.max(1, Math.ceil(reading.text.split(/\s+/).length / 200))} min read</span></div><h2>{reading.title}</h2><div className="document-subtitle">{reading.subtitle}{reading.url && <a href={safeUrl(reading.url)} target="_blank" rel="noreferrer" title="Open original"><ArrowUpRight size={14} /></a>}</div><div className="document-divider" />{reading.text.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph.split(/(\bMCP\b|\bRAG\b)/g).map((part, j) => /^(MCP|RAG)$/.test(part) ? <button key={j} className="term" onClick={() => run("explain", { text: part, context: paragraph, title: reading.title, url: reading.url })} title={`Explain ${part}`}>{part}</button> : part)}</p>)}</article><div className="reader-footer"><FileText size={14} />Your reading, with room to wonder.<button onClick={() => openReading(sample)}>Try the sample</button></div></> : <div className="ask-canvas"><div className="ask-symbol"><Sparkles size={29} strokeWidth={1.5} /></div><h2>What caught your attention?</h2><p>A strange word, a big question, or a passage you want to understand. Start anywhere.</p><form onSubmit={(e) => { e.preventDefault(); run("explain", { text: topic.trim(), context: "", title: "A question of curiosity", url: "" }); }}><textarea aria-label="What are you curious about?" placeholder="What is MCP? Why do leaves change color? Paste a passage…" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={12000} required /><div><span>No question is too small.</span><button className="button button-primary" disabled={busy || !topic.trim()}><Sparkles size={16} />Explore this</button></div></form><div className="topic-chips">{["What is MCP?", "Why is the sky blue?", "Explain opportunity cost"].map((item) => <button key={item} onClick={() => { setTopic(item); run("explain", { text: item, context: "", title: "A question of curiosity", url: "" }); }}>{item}<ArrowUpRight size={12} /></button>)}</div></div>}</section>
          <section className="assistant-panel"><div className="assistant-title"><span className="assistant-icon"><Sparkles size={17} /></span><strong>Your thinking companion</strong><span className="tiny-pill">MARGIN</span></div><div className="action-tabs">{actions.map(({ key, label, icon: Icon }) => <button key={key} className={action === key ? "active" : ""} disabled={busy} onClick={() => selection ? run(key) : setAction(key)}><Icon size={14} />{label}</button>)}</div>
          {selection ? <div className="insight-content"><div className="selection-label"><Highlighter size={13} />YOU’RE EXPLORING</div><blockquote>{selection.text.length > 450 ? selection.text.slice(0, 450) + "…" : selection.text}</blockquote>{action === "translate" && <label className="language-control">Translate to<select aria-label="Translation language" value={language} onChange={(e) => { setLanguage(e.target.value); localStorage.setItem("margin-language", e.target.value); }}>{["Vietnamese", "English", "Spanish", "Korean", "Japanese", "French", "German", "Chinese"].map((lang) => <option key={lang}>{lang}</option>)}</select><button disabled={busy} onClick={() => run("translate")}>Apply</button></label>}
          {busy && <div className="thinking"><LoaderCircle size={15} className="spin" />{stage}<button onClick={() => { abort.current?.abort(); setBusy(false); }}>Stop</button></div>}{error && <div role="alert" className="error-box">{error}<button onClick={() => run(action)}>Try again</button></div>}{answer && <Markdown text={answer} />}{!busy && !answer && !error && <button className="button button-primary" onClick={() => run(action)}><Sparkles size={15} />Explore selection</button>}
          {sources.length > 0 && <div className="sources"><div className="section-caption">SOURCES TO EXPLORE <span>{sources.length}</span></div>{sources.map((source, i) => <a id={`source-${i + 1}`} key={source.url} className="source-card" href={safeUrl(source.url)} target="_blank" rel="noreferrer"><span className="source-number">{i + 1}</span><div><strong>{source.title}</strong><span>{source.kind === "official" ? "Official documentation" : source.kind === "paper" ? "Scholarly metadata" : "Wikipedia reference"}{source.year ? ` · ${source.year}` : ""}</span></div><ArrowUpRight size={14} /></a>)}<p className="source-note">Search excerpts and publication metadata help you find material. Open the source to assess the full evidence.</p></div>}{notices.map((notice) => <p className="muted small" key={notice}>{notice}</p>)}
          {complete && <><div className="save-row"><select aria-label="Save to collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}><option value="">My library</option>{collections.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select><button className={`button ${saved ? "button-light" : "button-primary"}`} disabled={saved || saving} onClick={save}>{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? "Saved" : saving ? "Saving…" : "Save finding"}</button><button className="icon-button" title="Copy answer" onClick={() => navigator.clipboard.writeText(answer).then(() => setToast("Copied to clipboard.")).catch(() => setToast("Could not access the clipboard."))}><Copy size={16} /></button></div><div className="provider-note"><span className="status-dot online" />{provider} · Review important details.</div><form className="followup" onSubmit={(e) => { e.preventDefault(); if (question.trim()) { run("ask", selection, question.trim()); setQuestion(""); } }}><input aria-label="Ask a follow-up" placeholder="Keep wondering. Ask a follow-up…" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} /><button title="Ask follow-up" disabled={!question.trim() || busy}><ArrowRight size={17} /></button></form></>}
          </div> : <div className="assistant-empty"><div className="orbit-art"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-center"><Sparkles size={27} strokeWidth={1.4} /></span><span className="orbit-dot" /></div><span className="eyebrow">A SMALL MOMENT OF WONDER</span><h2>There’s more<br />between the lines.</h2><p>Highlight something you don’t quite understand. We’ll make sense of it together.</p><button className="sample-action" onClick={() => run("explain", { text: "MCP", context: sample.text, title: sample.title, url: "" })}><span>Try it with <strong>“MCP”</strong></span><ArrowRight size={16} /></button><div className="empty-capabilities"><span><Languages size={15} />Cross a language barrier</span><span><Search size={15} />Find where an idea comes from</span><span><Bookmark size={15} />Keep a little understanding</span></div></div>}</section>
        </div><footer className="workspace-footer"><span>Made for the rabbit holes worth following.</span><span><Sparkles size={12} />Understand a little more.</span></footer>
      </>}
      {view === "library" && <div className="secondary-page"><div className="page-heading compact"><div><div className="eyebrow">KNOWLEDGE YOU CAN COME BACK TO</div><h1>{activeCollection?.name || "Your curiosity, collected"}<span>.</span></h1><p>Useful explanations, original context, and the sources behind them.</p></div><button className="button button-light" onClick={exportLibrary}><Download size={16} />Export library</button></div><div className="library-tools"><label className="search-input"><Search size={17} /><input aria-label="Search library" placeholder="Search your findings…" value={filter} onChange={(e) => setFilter(e.target.value)} /></label><select aria-label="Filter collection" value={filterCollection} onChange={(e) => setFilterCollection(e.target.value)}><option value="">All collections</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><span>{filtered.length} findings</span></div>{filtered.length ? <div className="finding-grid">{filtered.map((item) => <button className="finding-card" key={item.id} onClick={() => setDetail(item)}><span className="finding-meta"><Sparkles size={13} />{item.action}<span>{date(item.createdAt)}</span></span><h3>{item.selection.text}</h3><p>{item.answer.replace(/[#*`]/g, "").slice(0, 190)}…</p><div><span><FileText size={13} />{item.selection.title}</span><ArrowUpRight size={15} /></div></button>)}</div> : <div className="page-empty"><Library size={37} strokeWidth={1} /><h2>{filter ? "No findings match your search." : "Your next discovery belongs here."}</h2><p>Save a useful explanation from Explore, and it will be waiting for you here.</p><button className="button button-primary" onClick={() => setView("explore")}>Start exploring<ArrowRight size={16} /></button></div>}</div>}
      {view === "collections" && <div className="secondary-page"><div className="page-heading compact"><div><div className="eyebrow">MAKE CONNECTIONS</div><h1>A home for every interest<span>.</span></h1><p>Group discoveries around anything you’re curious about.</p></div><button className="button button-primary" onClick={() => setModal("collection")}><Plus size={16} />New collection</button></div>{collections.length ? <div className="collection-grid">{collections.map((c) => <div className="collection-card" key={c.id}><button onClick={() => { setFilterCollection(c.id); setView("library"); }}><span className="folder-tile" style={{ color: c.color, background: c.color + "15" }}><Folder size={27} strokeWidth={1.5} /></span><h3>{c.name}</h3><p>{insights.filter((i) => i.collectionId === c.id).length} saved findings</p><ArrowUpRight size={18} /></button><button className="delete-collection" title={`Delete collection ${c.name}`} onClick={async () => { if (confirm(`Delete “${c.name}”? Your findings will stay in the library.`)) { await json("/api/collections", post({ id: c.id }, "DELETE")); await refresh(); } }}><Trash2 size={14} /></button></div>)}</div> : <div className="page-empty"><Folder size={38} strokeWidth={1} /><h2>Interests don’t need a syllabus.</h2><p>Make a collection for a project, a question, or something you keep coming back to.</p><button className="button button-primary" onClick={() => setModal("collection")}><Plus size={16} />Create a collection</button></div>}</div>}
      {view === "extension" && <div className="secondary-page extension-page"><div className="eyebrow">A TOOL FROM YOUR WORKSPACE</div><h1>Take curiosity<br />along for the read<span>.</span></h1><p className="lead">The Margin extension brings the same explanations, translations, and research tools to the page you’re already reading.</p><div className="extension-demo"><span>…This is where <mark>MCP</mark> enters the picture…</span><div><Sparkles size={15} />Explain<Search size={15} />Research<Languages size={15} />Translate</div></div><div className="extension-steps"><div><span>1</span><h3>Select something</h3><p>Highlight a term or passage on a webpage.</p></div><div><span>2</span><h3>Open Margin</h3><p>Right-click → Margin, or use Ctrl+Shift+M.</p></div><div><span>3</span><h3>Follow the idea</h3><p>Explore in the side panel and save to this library.</p></div></div><a className="button button-primary" href="/margin-extension.zip" download><Download size={17} />Download Chrome extension</a><details className="install-details"><summary>How to install locally<ChevronDown size={15} /></summary><p>Unzip the download. Open <code>chrome://extensions</code>, turn on Developer mode, choose Load unpacked, and select the unzipped folder. Keep the Margin app running on this computer.</p></details></div>}
      {view === "settings" && <div className="secondary-page settings-page"><div className="eyebrow">MAKE YOURSELF AT HOME</div><h1>Your preferences<span>.</span></h1><section className="settings-card"><div><Languages size={22} /><h3>Translation language</h3><p>Choose the language you usually want to translate into.</p></div><select aria-label="Default translation language" value={language} onChange={(e) => { setLanguage(e.target.value); localStorage.setItem("margin-language", e.target.value); }}>{["Vietnamese", "English", "Spanish", "Korean", "Japanese", "French", "German", "Chinese"].map((lang) => <option key={lang}>{lang}</option>)}</select></section><section className="settings-card"><div><Sparkles size={22} /><h3>Your local assistant</h3><p>{status?.available ? `${status.model} is ready on this computer.` : "The local assistant is offline. Start Ollama to generate explanations and translations."}</p></div><span className={`connection-badge ${status?.available ? "connected" : ""}`}>{status?.available ? "Connected" : "Offline"}</span></section><section className="settings-card"><div><Library size={22} /><h3>Your knowledge, to keep</h3><p>Download your saved explanations, notes, and source links as Markdown.</p></div><button className="button button-light" onClick={exportLibrary}><ArrowDownToLine size={16} />Export</button></section></div>}
    </main>
    {floating && <div className="selection-toolbar" style={{ left: floating.x, top: floating.y }} onMouseDown={(e) => e.preventDefault()}>{actions.slice(0, 3).map(({ key, label, icon: Icon }) => <button key={key} onClick={() => run(key)}><Icon size={14} />{label}</button>)}<button title="Close selection tools" onClick={() => setFloating(null)}><X size={13} /></button></div>}
    {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal"><button className="modal-close icon-button" title="Close dialog" onClick={() => setModal(null)}><X size={19} /></button>{modal === "collection" ? <form onSubmit={async (e) => { e.preventDefault(); try { await json("/api/collections", post({ name: collectionName })); setCollectionName(""); setModal(null); await refresh(); setToast("Collection created."); } catch (error) { setToast((error as Error).message); } }}><span className="modal-icon"><Folder size={24} /></span><h2 id="modal-title">Make room for an interest.</h2><p>A topic, a project, or an idea you want to keep following.</p><label>Collection name<input autoFocus placeholder="e.g. Things I want to understand" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} maxLength={80} required /></label><button className="button button-primary" type="submit">Create collection<Plus size={16} /></button></form> : <><span className="modal-icon"><BookOpen size={24} /></span><h2 id="modal-title">Bring something interesting.</h2><p>A paper, an article, or just a few lines you want to understand.</p><div className="import-tabs"><button className={importKind === "text" ? "active" : ""} onClick={() => setImportKind("text")}><FileText size={15} />Paste text</button><button className={importKind === "url" ? "active" : ""} onClick={() => setImportKind("url")}><Link size={15} />Web link</button><button className={importKind === "file" ? "active" : ""} onClick={() => setImportKind("file")}><Upload size={15} />Upload file</button></div>{importKind === "file" ? <div className="file-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) importFile(file); }}><Upload size={28} strokeWidth={1.3} /><strong>Drop a PDF, text, or Markdown file</strong><span>Up to 20 MB · PDFs need selectable text</span><button className="button button-light" disabled={importing} onClick={() => fileInput.current?.click()}>Choose a file</button><input type="file" ref={fileInput} hidden accept=".pdf,.txt,.md,.markdown" onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} /></div> : <form onSubmit={submitImport}>{importKind === "text" ? <><label>Title<input placeholder="Give this reading a name" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} maxLength={200} /></label><label>Your text<textarea placeholder="Paste the passage or document here…" value={importText} onChange={(e) => setImportText(e.target.value)} rows={7} required maxLength={180000} /></label></> : <label>Article URL<input type="url" placeholder="https://…" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} required /></label>}<button className="button button-primary" disabled={importing}>{importing ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}{importing ? "Opening your reading…" : "Open in reader"}</button></form>}{importing && importKind === "file" && <p className="thinking"><LoaderCircle size={15} className="spin" />Extracting your document…</p>}{importError && <div className="error-box" role="alert">{importError}</div>}</>}</section></div>}
    {detail && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="finding-title" className="modal detail-modal"><button className="modal-close icon-button" title="Close finding" onClick={() => setDetail(null)}><X size={19} /></button><div className="eyebrow">SAVED FINDING · {date(detail.createdAt)}</div><h2 id="finding-title">{detail.selection.text}</h2><div className="context-preview"><strong>Original context</strong><p>{detail.selection.context || detail.selection.title}</p>{safeUrl(detail.selection.url) && <a href={safeUrl(detail.selection.url)} target="_blank" rel="noreferrer">{detail.selection.title}<ArrowUpRight size={13} /></a>}</div><Markdown text={detail.answer} />{detail.sources.length > 0 && <div className="sources"><div className="section-caption">SOURCES</div>{detail.sources.map((s, i) => <a key={s.url} href={safeUrl(s.url)} target="_blank" rel="noreferrer" className="source-card"><span>{i + 1}</span><strong>{s.title}</strong><ArrowUpRight size={14} /></a>)}</div>}<label>Your notes<textarea rows={3} placeholder="Add your own thoughts or connections…" value={detail.note} onChange={(e) => setDetail({ ...detail, note: e.target.value })} maxLength={10000} /></label><label>Collection<select value={detail.collectionId || ""} onChange={(e) => setDetail({ ...detail, collectionId: e.target.value || null })}><option value="">My library</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="detail-actions"><button className="button button-danger" onClick={async () => { await json("/api/library", post({ id: detail.id }, "DELETE")); setDetail(null); await refresh(); setToast("Finding deleted."); }}><Trash2 size={15} />Delete</button><button className="button button-primary" onClick={async () => { await json("/api/library", post({ id: detail.id, note: detail.note, collectionId: detail.collectionId }, "PATCH")); setDetail(null); await refresh(); setToast("Changes saved."); }}><Check size={15} />Save changes</button></div></section></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </div>;
}
