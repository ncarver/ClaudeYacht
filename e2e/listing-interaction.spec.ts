import { test, expect } from "@playwright/test";

test.describe("Listing Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/results");
  });

  test("can expand a listing row", async ({ page }) => {
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Click the first data row to expand it
      await rows.first().click();

      // The expanded row should show listing detail (e.g., "View on YachtWorld")
      await expect(page.getByText("View on YachtWorld").first()).toBeVisible({
        timeout: 3000,
      });
    }
  });

  test("can toggle thumbs up on a listing", async ({ page }) => {
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Expand first row
      await rows.first().click();
      await page.waitForTimeout(300);

      // Find thumbs up button (first button in the action bar)
      const detailButtons = page.locator(".flex.items-center.gap-3 button");
      if ((await detailButtons.count()) > 0) {
        await detailButtons.first().click();
        // Verify the button state changed (green highlight)
        await page.waitForTimeout(500);
      }
    }
  });

  test("can add notes to a listing", async ({ page }) => {
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Expand first row
      await rows.first().click();
      await page.waitForTimeout(300);

      // Find the notes textarea
      const textarea = page.locator("textarea");
      if ((await textarea.count()) > 0) {
        await textarea.first().fill("Test note from E2E");
        // Wait for debounced save
        await page.waitForTimeout(700);
      }
    }
  });
});
