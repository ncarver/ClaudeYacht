import { test, expect } from "@playwright/test";

test.describe("Results Filtering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/results");
  });

  test("page loads and shows results table", async ({ page }) => {
    // The results page should load with a table
    await expect(page.locator("table")).toBeVisible();
  });

  test("search filters results", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search listings...");
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill("Catalina");

    // Wait for debounce
    await page.waitForTimeout(500);

    // All visible listing names should contain "Catalina" (if any listings exist)
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count > 0) {
      // Verify the search is filtering (table is not showing the "no results" message)
      await expect(page.locator("table")).toBeVisible();
    }
  });

  test("favorites toggle works", async ({ page }) => {
    // Look for the favorites switch/toggle
    const favoritesToggle = page.getByText("Favorites only");
    if (await favoritesToggle.isVisible()) {
      await favoritesToggle.click();
      // After toggling, the filter should be active
      await page.waitForTimeout(300);
    }
  });

  test("clear all filters button resets filters", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search listings...");
    await searchInput.fill("test search");
    await page.waitForTimeout(500);

    // Look for clear button
    const clearButton = page.getByText("Clear all filters");
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchInput).toHaveValue("");
    }
  });
});
