import { test, expect } from "@playwright/test";

test("reader selection opens the shared tools, and mobile layout stays within the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every great idea");
  await page.locator("article p").first().evaluate((node) => { const range = document.createRange(); range.selectNodeContents(node); const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range); });
  await page.locator("article").dispatchEvent("mouseup");
  await expect(page.locator(".selection-toolbar")).toBeVisible();
  await expect(page.locator(".selection-toolbar button")).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".runtime/mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("a guest can import text and keep reading after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add something to read" }).click();
  await page.getByPlaceholder("Give this reading a name").fill("A biology curiosity");
  await page.getByPlaceholder("Paste the passage or document here…").fill("Photosynthesis converts light energy into chemical energy.\n\nThis is a document about biology, rather than AI.");
  await page.getByRole("button", { name: "Open in reader" }).click();
  await expect(page.locator("article h2")).toHaveText("A biology curiosity");
  await page.reload();
  await expect(page.locator("article h2")).toHaveText("A biology curiosity");

});

test("a signed-in reader can manage their collections", async ({ page }) => {
  test.skip(!process.env.MARGIN_BROWSER_STATE, "Requires a real Tide login");
  const name = `Browser test ${Date.now()}`;
  await page.goto("/");
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page.locator("main").getByRole("button", { name: "New collection", exact: true }).click();
  await page.getByPlaceholder("e.g. Things I want to understand").fill(name);
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByTitle(`Delete collection ${name}`).click();
});

test("a real local model explains MCP and a finding survives reload", async ({ page, request }) => {
  test.skip(process.env.MARGIN_LIVE_AI !== "1", "Opt in for real model and source retrieval");
  test.skip(!process.env.MARGIN_BROWSER_STATE, "Provide MARGIN_BROWSER_STATE after a real Tide login");
  await page.goto("/");
  await page.getByRole("button", { name: "Try it with “MCP”" }).click();
  await expect(page.getByRole("button", { name: "Save finding", exact: true })).toBeEnabled({ timeout: 110_000 });
  await expect(page.locator(".insight-content .markdown")).toContainText(/Model Context Protocol/i);
  await expect(page.locator(".source-card").first()).toHaveAttribute("href", /modelcontextprotocol\.io/);
  const savedResponse = page.waitForResponse((response) => response.url().endsWith("/api/library") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save finding", exact: true }).click();
  const savedId = (await (await savedResponse).json()).insight.id;
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /My library/ }).click();
  const finding = page.locator(".finding-card").filter({ has: page.getByRole("heading", { name: "MCP", exact: true }) }).first();
  await expect(finding).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /My library/ }).click();
  await expect(page.locator(".finding-card").first()).toBeVisible();
  await page.screenshot({ path: ".runtime/library.png", fullPage: true });
  await page.evaluate(async (id) => { await window.marginBridge!.request({ path: "/api/library", method: "DELETE", data: { id } }); }, savedId);
});


test("a PDF with selectable text opens in the reader", async ({ page, context }) => {
  const fixture = await context.newPage();
  await fixture.setContent('<h1>A short science reading</h1><p>Photosynthesis converts light energy into chemical energy.</p>');
  const buffer = await fixture.pdf();
  await fixture.close();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add something to read' }).click();
  await page.getByRole('button', { name: 'Upload file', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'science-reading.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.locator('article h2')).toHaveText('science-reading', { timeout: 60000 });
  await expect(page.locator('article')).toContainText('Photosynthesis converts light energy');
});


test("private API routes reject anonymous requests", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:3000', extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  for (const path of ['/api/library', '/api/collections', '/api/profile']) expect((await anonymous.get(path)).status()).toBe(401);
  expect((await anonymous.post('/api/library', {data:{}})).status()).toBe(401);
  expect((await anonymous.post('/api/collections', {data:{}})).status()).toBe(401);
  await anonymous.dispose();
});
