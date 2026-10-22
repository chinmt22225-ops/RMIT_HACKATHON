const $ = (id) => document.getElementById(id);
let selection = null, action = "explain", answer = "", sources = [], provider = "", controller, history = [];
const base = "http://localhost:3000";
async function request(path, data) {
  const response = await fetch(base + path, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {});
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not connect to Margin."); return result;
}
function error(message) { $("error").textContent = message; $("error").hidden = false; }
function renderAnswer() {
  $("answer").replaceChildren();
  for (const [i, segment] of answer.split(/(\*\*[^*]+\*\*)/g).entries()) {
    if (i % 2) { const node = document.createElement("strong"); node.textContent = segment.slice(2, -2); $("answer").append(node); }
    else $("answer").append(document.createTextNode(segment));
  }
}
function renderSources() {
  $("sources").replaceChildren(); if (!sources.length) return;
  const title = document.createElement("strong"); title.textContent = "SOURCES TO EXPLORE"; $("sources").append(title);
  sources.forEach((source, i) => {
    if (!/^https?:\/\//i.test(source.url)) return;
    const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noreferrer";
    link.append(document.createTextNode(`${i + 1}. ${source.title}`));
    const kind = document.createElement("small"); kind.textContent = source.kind === "paper" ? "Publication metadata · open to assess the full paper" : source.kind === "official" ? "Official documentation" : "Wikipedia reference";
    link.append(kind); $("sources").append(link);
  });
}
async function run(next, question = "") {
  if (!selection?.text) return;
  controller?.abort(); const current = new AbortController(); controller = current;
  if (question) history = [...history, { role: "assistant", content: answer }, { role: "user", content: question }].slice(-4); else history = [];
  action = next; answer = ""; sources = []; $("error").hidden = true; $("save-controls").hidden = true; $("followup").hidden = true;
  $("language-label").hidden = action !== "translate"; $("status").textContent = "Connecting the ideas…"; renderAnswer(); renderSources();
  document.querySelectorAll("[data-action]").forEach((button) => button.classList.toggle("active", button.dataset.action === action));
  try {
    const response = await fetch(base + "/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, signal: current.signal, body: JSON.stringify({ selection, action, language: $("language").value, question: question || undefined, history }) });
    if (!response.ok || !response.body) { const data = await response.json(); throw new Error(data.error || "Could not reach Margin."); }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try { while (true) {
      const part = await reader.read(); buffer += decoder.decode(part.value, { stream: !part.done }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
      if (part.done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.trim()) continue; const event = JSON.parse(line);
        if (event.type === "status") $("status").textContent = event.message;
        if (event.type === "sources") { sources = event.sources; provider = event.provider; renderSources(); }
        if (event.type === "delta") { answer += event.text; renderAnswer(); }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") { $("status").textContent = ""; $("save-controls").hidden = false; $("followup").hidden = false; $("save").disabled = false; $("save").textContent = "Save finding"; $("footer-status").textContent = `${provider} · Review important details.`; }
      }
      if (part.done) break;
    } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } catch (e) { if (!current.signal.aborted) { error(e.message === "Failed to fetch" ? "Start the Margin app on this computer, then try again." : e.message); $("status").textContent = ""; } }
}
function load(value) {
  if (!value?.text) { $("empty").hidden = false; $("workspace").hidden = true; return; }
  selection = { text: value.text, context: value.context || "", title: value.title || "From your browser", url: value.url || "" };
  $("empty").hidden = true; $("workspace").hidden = false; $("selection").textContent = selection.text;
  $("origin").textContent = selection.title; run(value.action || "explain");
}
$("actions").addEventListener("click", (event) => { const button = event.target.closest("[data-action]"); if (button) run(button.dataset.action); });
$("language").addEventListener("change", () => { chrome.storage.local.set({ marginLanguage: $("language").value }); if (action === "translate") run("translate"); });
$("save").addEventListener("click", async () => {
  $("save").disabled = true;
  try { await request("/api/library", { selection, action, answer, sources, provider, collectionId: $("collection").value || null, note: "" }); $("save").textContent = "✓ Saved"; }
  catch (e) { error(e.message); $("save").disabled = false; }
});
$("followup").addEventListener("submit", (event) => { event.preventDefault(); const question = $("question").value.trim(); if (question) { run("ask", question); $("question").value = ""; } });
$("open-app").addEventListener("click", () => chrome.tabs.create({ url: base }));
chrome.storage.onChanged.addListener((changes, area) => { if (area === "session" && changes.marginSelection) load(changes.marginSelection.newValue); });
(async () => {
  const [stored, prefs] = await Promise.all([chrome.storage.session.get("marginSelection"), chrome.storage.local.get("marginLanguage")]);
  if (prefs.marginLanguage) $("language").value = prefs.marginLanguage;
  try { const { collections } = await request("/api/collections"); for (const c of collections) { const option = document.createElement("option"); option.value = c.id; option.textContent = c.name; $("collection").append(option); } } catch {}
  load(stored.marginSelection);
})();
