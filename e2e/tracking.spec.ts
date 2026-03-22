import { test, expect } from "@playwright/test";

/**
 * E2E tests for Public Tracking Page
 * Route: /track, /track/:trackingId
 */

test.describe("Public Tracking Page", () => {
  test("tracking search page loads", async ({ page }) => {
    await page.goto("/track");
    await expect(
      page.getByText("Track Your Order")
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Track Order/i })).toBeVisible();
  });

  test("shows not found for invalid tracking ID", async ({ page }) => {
    await page.goto("/track/INVALID-ID-XYZ");
    await expect(
      page.getByRole("heading", { name: "Order Not Found" })
    ).toBeVisible({ timeout: 20000 });
  });
});
