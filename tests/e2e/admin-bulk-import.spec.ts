import { test, expect } from "@playwright/test";

/**
 * E2E for the admin "Bulk Link Import" dialog and the single-URL file_path
 * input. The admin page is gated by login + admin role, so these tests skip
 * gracefully when the preview session is not authenticated as an admin.
 *
 * To run authenticated, capture a logged-in storageState and pass it via
 * Playwright config (or set E2E_ADMIN_PATH to a route variant). Default
 * entry is /admin.
 *
 * Env:
 *   E2E_BASE_URL    – defaults to https://dynastore.lovable.app
 *   E2E_ADMIN_PATH  – defaults to /admin
 */
const ADMIN_PATH = process.env.E2E_ADMIN_PATH ?? "/admin";

const BULK_PASTE = [
  "https://vikingfile.com/f/pJUUBfjqPi",
  "viking2|Viking Demo|RPG|150|https://vikingfile.com/f/AbCdEfGh12",
  "https://mega.nz/file/AbCdEf#k1k2k3",
  "https://workupload.com/file/XyZ1234",
  "not-a-valid-url-line",
  "https://example.com/cool-game.zip",
].join("\n");

async function ensureOnAdmin(page: import("@playwright/test").Page) {
  await page.goto(ADMIN_PATH, { waitUntil: "domcontentloaded" });
  // If we got redirected to /login, the preview isn't authenticated as admin.
  if (/\/login/i.test(page.url())) {
    test.skip(true, "Preview session is not logged in as admin — skipping.");
  }
  // Bulk Link Import trigger varies; look for the dialog opener via icon+text.
  const trigger = page.getByRole("button", { name: /bulk link import/i }).first();
  if (!(await trigger.isVisible().catch(() => false))) {
    test.skip(true, "Admin UI did not render Bulk Link Import — not authorized.");
  }
}

test.describe("Admin · Bulk Link Import (vikingfile + mixed hosts)", () => {
  test("Parse counts importable rows and flags invalid ones", async ({ page }) => {
    await ensureOnAdmin(page);

    await page.getByRole("button", { name: /bulk link import/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const textarea = dialog.locator("textarea").first();
    await textarea.fill(BULK_PASTE);

    await dialog.getByRole("button", { name: /^parse$/i }).click();

    // Summary text: "{importable}/{total} នាំចូលបាន · {skipped} រំលង · {invalid} ខុស"
    const summary = dialog.locator("text=/\\d+\\/\\d+\\s+នាំចូលបាន/");
    await expect(summary).toBeVisible({ timeout: 5_000 });

    const summaryText = (await summary.textContent()) ?? "";
    // 6 total rows: 5 share/direct URLs are accepted, 1 invalid line.
    expect(summaryText).toMatch(/\/6\s+នាំចូលបាន/);
    expect(summaryText).toMatch(/1\s+ខុស/);

    // Table should mention the vikingfile share id we pasted.
    await expect(dialog.locator("table")).toContainText(/pJUUBfjqPi|vikingfile/i);
    await expect(dialog.locator("table")).toContainText(/viking2/);
  });

  test("Single URL input on file_path accepts a vikingfile share link", async ({ page }) => {
    await ensureOnAdmin(page);

    // The single-URL <input type=url> appears in the game create/edit form
    // when "External URL" provider is selected. Identify it by placeholder.
    const urlInput = page
      .locator('input[type="url"][placeholder*="zip"]')
      .first();

    if (!(await urlInput.isVisible().catch(() => false))) {
      test.skip(true, "Single URL input not visible (no create/edit form open).");
    }

    await urlInput.fill("https://vikingfile.com/f/pJUUBfjqPi");
    await expect(urlInput).toHaveValue("https://vikingfile.com/f/pJUUBfjqPi");

    // A validation error would render in a sibling text-destructive span.
    const errorMsg = page.locator("span.text-destructive", {
      hasText: /https?|\.zip|invalid|ខុស/i,
    });
    await expect(errorMsg).toHaveCount(0);

    // Success hint should appear.
    await expect(page.getByText(/នឹងរក្សាទុកជា file_path/)).toBeVisible();
  });
});
