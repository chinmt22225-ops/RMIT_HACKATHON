import { test, expect } from "@playwright/test";

test("content-scanner attributes injected before hydration do not break the workspace", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    const mark = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (!seen.has(node)) { seen.add(node); node.setAttribute("bis_skin_checked", "1"); node.setAttribute("__processed_7db22a4d-d720-4512-8bcf-18d221928455__", "true"); }
      node.querySelectorAll("*").forEach(child => { if (!seen.has(child)) { seen.add(child); child.setAttribute("bis_skin_checked", "1"); } });
    };
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(mark)));
    observer.observe(document, { subtree: true, childList: true });
    document.addEventListener("DOMContentLoaded", () => observer.disconnect(), { once: true });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every great idea");
  await page.getByRole("button", { name: "Add something to read" }).click();
  await expect(page.getByPlaceholder("Give this reading a name")).toBeVisible();
  expect(errors.filter(error => /hydrat|server rendered|server-rendered/i.test(error))).toEqual([]);
});
