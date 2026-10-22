import { expect, test } from "@playwright/test";

test("an unavailable Tide adapter reports an error without blocking guest reading", async ({ page }) => {
  await page.route("**/api/config", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Unavailable" }) }));
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Tide sign-in is temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Tide", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add something to read" }).click();
  await page.getByPlaceholder("Give this reading a name").fill("Reading while Tide is unavailable");
  await page.getByPlaceholder("Paste the passage or document here…").fill("Photosynthesis converts light energy into chemical energy.");
  await page.getByRole("button", { name: "Open in reader" }).click();
  await expect(page.locator("article h2")).toHaveText("Reading while Tide is unavailable");
});

test("a stale logout marker cannot turn a failed login callback into a successful return", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("margin-signing-out", "yes"));
  await page.goto("/auth/redirect#error=access_denied&state=invalid-callback-state");
  await expect(page.getByRole("heading", { name: "Sign-in wasn’t completed." })).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/\/auth\/redirect/);
  await expect(page.getByRole("link", { name: "Continue as a guest" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("margin-sign-in-confirmed"))).toBeNull();
});
