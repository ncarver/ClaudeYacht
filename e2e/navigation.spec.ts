import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ClaudeYacht|Yacht/i);
  });

  test("results page is accessible", async ({ page }) => {
    await page.goto("/results");
    // Should see the results table or search input
    await expect(
      page.getByPlaceholder("Search listings...").or(page.locator("table"))
    ).toBeVisible();
  });

  test("scrape page is accessible", async ({ page }) => {
    await page.goto("/scrape");
    // Should see the scrape form
    await expect(page.locator("form").or(page.getByText("Scrape"))).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");

    // Look for nav links
    const resultsLink = page.getByRole("link", { name: /results/i });
    if (await resultsLink.isVisible()) {
      await resultsLink.click();
      await expect(page).toHaveURL(/\/results/);
    }
  });
});
