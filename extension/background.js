/* The extension captures on an explicit action. It does not continuously read pages. */
const actions = [["explain", "Explain"], ["research", "Research"], ["translate", "Translate"], ["simplify", "Simplify"], ["examples", "Show examples"]];
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "margin", title: "Explore with Margin", contexts: ["selection"] });
    for (const [id, label] of actions) chrome.contextMenus.create({ id, parentId: "margin", title: label, contexts: ["selection"] });
  });
});

async function capture(tab, action, selectedText, frameId) {
  if (!tab?.id) return;
  let selection = { text: selectedText || "", context: "", title: tab.title || "From your browser", url: tab.url || "" };
  try {
    const results = await chrome.scripting.executeScript({
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
  await chrome.storage.session.set({ marginSelection: { ...selection, action, timestamp: Date.now() } });
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!actions.some(([id]) => id === info.menuItemId) || !tab) return;
  // Open before the first await, while Chrome still recognizes the user gesture.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  capture(tab, info.menuItemId, info.selectionText, info.frameId).catch(console.error);
});
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  capture(tab, "explain").catch(console.error);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "explore-selection") return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  capture(tab, "explain").catch(console.error);
});
