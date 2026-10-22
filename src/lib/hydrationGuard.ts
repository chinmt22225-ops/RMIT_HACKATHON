// Some content-scanning extensions mark every server-rendered element before
// React starts. Remove only the observed bookkeeping attributes during hydration;
// never suppress React warnings or change the user's extension configuration.
export const hydrationGuard = String.raw`(() => {
  const marker = /^(?:bis_skin_checked|bis_register|__processed_[0-9a-f-]{36}__)$/i;
  const clean = (node) => {
    if (!(node instanceof Element)) return;
    for (const attr of [...node.attributes]) if (marker.test(attr.name)) node.removeAttribute(attr.name);
  };
  const tree = (node) => { clean(node); if (node.querySelectorAll) node.querySelectorAll('*').forEach(clean); };
  tree(document.documentElement);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') { if (marker.test(record.attributeName || '')) clean(record.target); }
      else record.addedNodes.forEach(tree);
    }
  });
  observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true});
  const stop = () => { observer.disconnect(); document.removeEventListener('margin-hydrated', stop); };
  document.addEventListener('margin-hydrated', stop, {once:true});
  setTimeout(stop, 15000);
})();`;
