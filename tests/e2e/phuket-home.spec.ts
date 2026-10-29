import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
});

test("choosing a zone lists its homes, and a listing shows owner or agent details", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Find your place in Phuket" }),
  ).toBeVisible();
  await page.locator(".zone-row", { hasText: "Patong" }).click();
  await expect(page.locator(".zone-head h2")).toHaveText("Patong");
  await page.locator(".listing-row").first().click();
  await expect(page.locator(".listing-detail")).toBeVisible();
  await expect(page.locator(".channel-box")).toBeVisible();
  await page.getByRole("button", { name: "Back to list", exact: true }).click();
  await expect(page.locator(".listing-row").first()).toBeVisible();
});

test("Thai home lists the same zones", async ({ page }) => {
  await page.goto("/th/");
  await expect(
    page.getByRole("heading", { name: "หาที่ใช่ในภูเก็ต" }),
  ).toBeVisible();
  await expect(page.locator(".zone-row")).toHaveCount(8);
});

test("home has no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.locator(".home-grid")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
});

test("owner sign-in saves a demo draft that is not published", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await page.getByRole("radio", { name: /Property owner/ }).click();
  await page.getByRole("button", { name: "Continue to dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Owner dashboard", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Listing title").fill("Synthetic sea-view condo");
  await page.getByLabel("Price (THB)").fill("5000000");
  await page.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Not published");
});

test("agent publishes a listing that shows on the home zone map", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await page.getByRole("radio", { name: /^Agent/ }).click();
  await page.getByRole("button", { name: "Continue to dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Start membership (demo)", exact: true }).click();
  await page.getByLabel("Listing title").fill("E2E sea-view villa");
  await page.getByRole("combobox", { name: "Area", exact: true }).selectOption("Patong");
  await page.getByLabel("Price (THB)").fill("9000000");
  await page.getByRole("button", { name: "Publish to map", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("now shows on the Phuket map");

  await page.goto("/");
  await page.locator(".zone-row", { hasText: "Patong" }).click();
  const row = page.locator(".listing-row", { hasText: "E2E sea-view villa" });
  await expect(row).toBeVisible();
  await expect(row.locator(".tag.agent")).toBeVisible();
});

test("owner passport demo accepts a JPG and rejects a text file", async ({
  page,
}) => {
  await page.goto("/dashboard/");
  await page.getByRole("radio", { name: /Property owner/ }).click();
  await page.getByRole("button", { name: "Continue to dashboard", exact: true }).click();
  const input = page.getByLabel("Passport or ID file");
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an identity document"),
  });
  await expect(page.getByText("Use a JPG, PNG or PDF file.")).toBeVisible();
  await input.setInputFiles({
    name: "passport.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("demo image bytes"),
  });
  await expect(page.getByText("Use a JPG, PNG or PDF file.")).toHaveCount(0);
  await expect(page.getByText("Demo upload received, not verified")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Demo upload received, not verified")).toBeVisible();
});
