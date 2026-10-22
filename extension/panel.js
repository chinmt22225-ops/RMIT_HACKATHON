const api = globalThis.browser || globalThis.chrome;
const $ = (id) => document.getElementById(id);
let answerLanguage, selection = null, action = "explain", answer = "", sources = [], provider = "", controller, history = [], canSave = false, selectionTimestamp = 0;
const base = "http://localhost:3000";
async function bridge(path, data) {
  const result = await api.runtime.sendMessage({ kind: "margin-api", path, method: data ? "POST" : "GET", data });
  if (result?.error) throw new Error(result.error);
  if (!result || typeof result.status !== "number") throw new Error("The Margin connection was interrupted. Try again.");
  return new Response(result.body, { status: result.status, headers: { "Content-Type": result.contentType } });
}
async function request(path, data) {
  const response = await bridge(path, data);
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not connect to Margin."); return result;
}
function error(message) { $("error").textContent = message; $("error").hidden = false; }
function renderAnswer() {
  $("answer").lang = ({Vietnamese:"vi",English:"en",Spanish:"es",Korean:"ko",Japanese:"ja",French:"fr",German:"de",Chinese:"zh"})[answerLanguage] || "";
  $("answer").dir = "auto";
  $("answer").replaceChildren();
  for (const [i, segment] of answer.split(/(\*\*[^*]+\*\*)/g).entries()) {
    if (i % 2) { const node = document.createElement("strong"); node.textContent = segment.slice(2, -2); $("answer").append(node); }
    else $("answer").append(document.createTextNode(segment));
  }
}
function renderSources() {
  $("sources").replaceChildren(); if (!sources.length) return;
  const cited = new Set([...answer.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])).filter(n => sources[n - 1]?.evidence !== 'metadata'));
  for (const group of [{title:'SOURCES CITED', used:true}, {title:'EXPLORE FURTHER', used:false}]) {
  const items = sources.map((source,i) => ({source,i})).filter(({i}) => cited.has(i+1) === group.used);
  if (!items.length) continue;
  const title = document.createElement("strong"); title.textContent = group.title; $("sources").append(title);
  items.forEach(({source, i}) => {
    if (!/^https?:\/\//i.test(source.url)) return;
    const link = document.createElement("a"); link.id = `source-${i+1}`; link.href = source.url; link.target = "_blank"; link.rel = "noreferrer";
    link.append(document.createTextNode(`${i + 1}. ${source.title}`));
    const kind = document.createElement("small");
    const labels = {paper:'Research publication',preprint:'Preprint · peer review not verified',academic:'University / academic website',government:'Government website',official:'Official documentation',reference:'Wikipedia · background'};
    const material = source.evidence === 'metadata' ? 'metadata only' : source.evidence === 'abstract' ? 'abstract retrieved' : source.evidence === 'excerpt' ? 'excerpt retrieved' : '';
    kind.textContent = [labels[source.kind], material, source.year].filter(Boolean).join(' · ');
    link.append(kind); $("sources").append(link);
  });
  }
}
async function run(next, question = "") {
  if (!selection?.text) return;
  controller?.abort(); const current = new AbortController(); controller = current;
  if (question) history = [...history, { role: "assistant", content: answer }, { role: "user", content: question }].slice(-4); else history = [];
  action = next; answerLanguage = next === "translate" ? $("language").value : undefined; answer = ""; sources = []; $("error").hidden = true; $("save-controls").hidden = true; $("followup").hidden = true;
  $("language-label").hidden = action !== "translate"; $("status").textContent = "Connecting the ideas…"; renderAnswer(); renderSources();
  document.querySelectorAll("[data-action]").forEach((button) => button.classList.toggle("active", button.dataset.action === action));
  try {
    const response = await bridge("/api/assist", { selection, action, language: $("language").value, question: question || undefined, history });
    if (!response.ok || !response.body) { const data = await response.json(); throw new Error(data.error || "Could not reach Margin."); }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try { while (true) {
      const part = await reader.read(); buffer += decoder.decode(part.value, { stream: !part.done }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
      if (part.done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.trim()) continue; const event = JSON.parse(line); if (current.signal.aborted) return;
        if (event.type === "status") $("status").textContent = event.message;
        if (event.type === "sources") { sources = event.sources; provider = event.provider; renderSources(); }
        if (event.type === "delta") { answer += event.text; renderAnswer(); }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") { renderSources(); $("status").textContent = ""; $("save-controls").hidden = false; $("followup").hidden = false; $("save").disabled = false; $("save").textContent = canSave ? "Save finding" : "Sign in to save"; $("footer-status").textContent = `${provider} · Review important details.`; api.storage.session.set({ marginDraft: { selection, selectionTimestamp, action, answer, answerLanguage, sources, provider, history } }); }
      }
      if (part.done) break;
    } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } catch (e) { if (!current.signal.aborted) { error(e.message === "Failed to fetch" ? "Start the Margin app on this computer, then try again." : e.message); $("status").textContent = ""; } }
}
function load(value, draft) {
  if (!value?.text) { $("empty").hidden = false; $("workspace").hidden = true; return; }
  selection = { text: value.text, context: value.context || "", title: value.title || "From your browser", url: value.url || "" };
  $("empty").hidden = true; $("workspace").hidden = false; $("selection").textContent = selection.text;
  selectionTimestamp = value.timestamp;
  $("origin").textContent = selection.title;
  if (draft && draft.selectionTimestamp === selectionTimestamp && draft.selection.text === selection.text) {
    ({ action, answer, answerLanguage, sources, provider, history } = draft);
    renderAnswer(); renderSources(); $("save-controls").hidden = false; $("followup").hidden = false;
    $("save").disabled = false; $("save").textContent = canSave ? "Save finding" : "Sign in to save";
    $("language-label").hidden = action !== "translate";
    document.querySelectorAll("[data-action]").forEach(button => button.classList.toggle("active", button.dataset.action === action));
  } else run(value.action || "explain");
}
$("actions").addEventListener("click", (event) => { const button = event.target.closest("[data-action]"); if (button) run(button.dataset.action); });
$("language").addEventListener("change", () => { api.storage.local.set({ marginLanguage: $("language").value }); if (action === "translate") run("translate"); });
$("save").addEventListener("click", async () => {
  if (!canSave) { $("footer-status").textContent = "Sign in in Margin, then return here to save this finding."; api.tabs.create({url:base}); return; }
  $("save").disabled = true;
  try { await request("/api/library", { selection, action, answer, language: answerLanguage, sources, provider, collectionId: $("collection").value || null, note: "" }); $("save").textContent = "✓ Saved"; }
  catch (e) { error(e.message); $("save").disabled = false; }
});
$("followup").addEventListener("submit", (event) => { event.preventDefault(); const question = $("question").value.trim(); if (question) { run("ask", question); $("question").value = ""; } });
$("open-app").addEventListener("click", () => api.tabs.create({ url: base }));
api.storage.onChanged.addListener((changes, area) => { if (area === "session" && changes.marginSelection) load(changes.marginSelection.newValue); });
(async () => {
  const [stored, prefs] = await Promise.all([api.storage.session.get(["marginSelection", "marginDraft"]), api.storage.local.get("marginLanguage")]);
  if (prefs.marginLanguage) $("language").value = prefs.marginLanguage;
  try { const { collections } = await request("/api/collections"); canSave = true; for (const c of collections) { const option = document.createElement("option"); option.value = c.id; option.textContent = c.name; $("collection").append(option); } } catch {}
  load(stored.marginSelection, stored.marginDraft);
})();

window.addEventListener("focus", async () => {
  try { const { collections } = await request("/api/collections"); canSave = true;
    const selected = $("collection").value; $("collection").replaceChildren(new Option("My library", ""));
    for (const c of collections) $("collection").append(new Option(c.name, c.id));
    $("collection").value = selected;
  } catch { canSave = false; }
  if (!$("save").disabled) $("save").textContent = canSave ? "Save finding" : "Sign in to save";
});
