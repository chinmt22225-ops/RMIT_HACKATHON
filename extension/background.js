const api = globalThis.browser || globalThis.chrome;
/* The extension captures on an explicit action. It does not continuously read pages. */
const actions = [["explain", "Explain"], ["research", "Research"], ["translate", "Translate"], ["simplify", "Simplify"], ["examples", "Show examples"]];
api.runtime.onInstalled.addListener(() => {
  api.contextMenus.removeAll().then(() => {
    api.contextMenus.create({ id: "margin", title: "Explore with Margin", contexts: ["selection"] });
    for (const [id, label] of actions) api.contextMenus.create({ id, parentId: "margin", title: label, contexts: ["selection"] });
  }).catch(console.error);
});

function openPanel(tab) {
  const opening = api.sidebarAction ? api.sidebarAction.open() : api.sidePanel.open({ windowId: tab?.windowId });
  opening.catch(console.error);
}

async function capture(tab, action, selectedText, frameId) {
  if (!tab?.id) return;
  let selection = { text: selectedText || "", context: "", title: tab.title || "From your browser", url: tab.url || "" };
  try {
    const results = await api.scripting.executeScript({
      target: { tabId: tab.id, ...(typeof frameId === "number" ? { frameIds: [frameId] } : {}) },
      func: () => {
        const current = window.getSelection();
        const parent = current?.anchorNode?.parentElement;
        const context = parent?.closest("p, article, section, main")?.textContent || parent?.textContent || "";
        return { text: current?.toString().trim() || "", context: context.slice(0, 12000), title: document.title, url: location.href };
      },
    });
    if (results[0]?.result) selection = { ...results[0].result, text: selectedText || results[0].result.text };
  } catch { /* Some pages permit context-menu selection but prohibit content scripts. */ }
  selection.text = selection.text.slice(0, 12000);
  await api.storage.session.set({ marginSelection: { ...selection, action, timestamp: Date.now() } });
}
api.contextMenus.onClicked.addListener((info, tab) => {
  if (!actions.some(([id]) => id === info.menuItemId) || !tab) return;
  // Open before the first await, while Chrome still recognizes the user gesture.
  openPanel(tab);
  capture(tab, info.menuItemId, info.selectionText, info.frameId).catch(console.error);
});
api.action.onClicked.addListener((tab) => {
  openPanel(tab);
  capture(tab, "explain").catch(console.error);
});
api.commands.onCommand.addListener((command, tab) => {
  if (command !== "explore-selection") return;
  openPanel(tab);
  capture(tab, "explain").catch(console.error);
});

// Requests are signed inside the first-party web app. Tokens and DPoP keys never leave it.
api.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.kind !== 'margin-api') return;
  if (sender.id !== api.runtime.id || sender.url !== api.runtime.getURL('panel.html')) {
    reply({ error: 'Unrecognized extension caller.' }); return;
  }
  (async () => {
    if (!['/api/assist','/api/library','/api/collections','/api/status'].includes(message.path)) throw new Error('Unsupported action.');
    const tabs = await api.tabs.query({ url: 'http://localhost:3000/*' });

    for (const tab of tabs) {
      try {
      const results = await api.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN',
        func: async (input) => {
          if (!window.marginBridge || (input.requireAuth && !window.marginBridge.authenticated)) return null;
          return window.marginBridge.request(input);
        },
        args: [{ path: message.path, method: message.method || 'GET', data: message.data, requireAuth: ['/api/library', '/api/collections'].includes(message.path) }],
      });
      if (results[0]?.result) return results[0].result;
      } catch { /* A closed or still-loading tab must not hide another signed-in tab. */ }
    }
    if (message.path === '/api/assist' || message.path === '/api/status') {
      const response = await fetch('http://localhost:3000' + message.path, { method: message.method || 'GET', ...(message.data ? { headers: {'Content-Type':'application/json'}, body:JSON.stringify(message.data) } : {}) });
      return {status:response.status,body:await response.text(),contentType:response.headers.get('content-type') || 'application/json'};
    }
    throw new Error('Sign in with Tide in your Margin tab to save or open your personal library.');
  })().then(reply).catch((error) => reply({ error: error.message }));
  return true;
});
