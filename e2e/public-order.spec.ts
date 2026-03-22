import { test, expect } from "@playwright/test";

/**
 * E2E tests for Public Ordering Page
 * Route: /order/:shopSlug
 *
 * Run: npm run test:e2e
 * Requires: App running (npm run dev) or CI will start preview server
 *
 * For full-flow tests with a real shop, set E2E_PUBLIC_SHOP_SLUG in .env
 * (e.g. your test shop's public slug)
 */

test.describe("Public Order Page", () => {
  test("shows 'Online Ordering Not Available' for invalid slug", async ({
    page,
  }) => {
    await page.goto("/order/invalid-shop-slug-xyz");
    await expect(
      page.getByText("Online Ordering Not Available")
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/This shop hasn't enabled online ordering|invalid|Invalid/i)
    ).toBeVisible();
  });

  test("page loads without crash for any slug", async ({ page }) => {
    const response = await page.goto("/order/any-slug");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Public Order Page - With Valid Shop", () => {
  const shopSlug = process.env.E2E_PUBLIC_SHOP_SLUG;

  test.skip(!shopSlug, "E2E_PUBLIC_SHOP_SLUG not set - skipping full flow tests");

  test("loads public order page and shows area selector", async ({ page }) => {
    await page.goto(`/order/${shopSlug}`);
    await expect(page.getByTestId("public-order-page")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Select Your Area")).toBeVisible();
  });

  test("shows mode selector after area selection", async ({ page }) => {
    await page.goto(`/order/${shopSlug}`);
    await expect(page.getByTestId("public-order-page")).toBeVisible({
      timeout: 15000,
    });
    const areaSelect = page.getByRole("combobox", { name: /area|choose/i });
    if (await areaSelect.isVisible()) {
      await areaSelect.click();
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
        await expect(
          page.getByText("Quick Order").or(page.getByText("Select Items"))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("Quick Order: Proceed to Checkout button visible", async ({ page }) => {
    await page.goto(`/order/${shopSlug}`);
    await expect(page.getByTestId("public-order-page")).toBeVisible({
      timeout: 15000,
    });
    const areaSelect = page.getByRole("combobox");
    if (await areaSelect.isVisible()) {
      await areaSelect.click();
      const opt = page.getByRole("option").first();
      if (await opt.isVisible()) {
        await opt.click();
      }
    }
    await expect(
      page.getByRole("button", { name: /Proceed to Checkout/i })
    ).toBeVisible({ timeout: 5000 });
  });
});
