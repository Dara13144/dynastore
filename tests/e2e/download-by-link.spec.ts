import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies the "Download By Link" button on a game detail page:
 *   1. button is visible
 *   2. clicking it opens a new tab
 *   3. the new tab URL is http(s) and points at the external host
 *
 * Set E2E_GAME_PATH to a known game route (e.g. /games/<id>).
 * Defaults to /library which lists at least one game.
 */
const ENTRY = process.env.E2E_GAME_PATH ?? "/library";

async function findDownloadByLink(page: Page) {
  return page.getByRole("button", { name: /download by link/i }).first();
}

test("Download By Link opens external URL in a new tab", async ({ page, context }) => {
  await page.goto(ENTRY);

  const btn = await findDownloadByLink(page);
  await expect(btn).toBeVisible({ timeout: 15_000 });

  const [popup] = await Promise.all([context.waitForEvent("page"), btn.click()]);

  await popup.waitForLoadState("domcontentloaded").catch(() => {});
  const url = popup.url();
  expect(url).toMatch(/^https?:\/\//);
  expect(url).not.toContain(new URL(page.url()).host);
});
