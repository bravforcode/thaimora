import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/explore/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
});
test("search, filtering, saved properties and comparison share the same data", async ({
  page,
}, info) => {
  await expect(
    page.getByRole("heading", { name: "Find your place in Thailand." }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "List", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Property type", exact: true })
    .selectOption("villa");
  await expect(page.locator(".property-card")).toHaveCount(6);
  await page
    .locator(".property-card")
    .first()
    .getByRole("button", { name: "Save property", exact: true })
    .click();
  await page
    .locator(".property-card")
    .first()
    .getByRole("button", { name: "Compare property" })
    .click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Side by side." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close comparison" }).click();
  await page.getByRole("link", { name: /Saved/ }).click();
  await expect(page.locator(".property-card")).toHaveCount(1);
});
test("property deep link and preview inquiry are honest and persist locally", async ({
  page,
}) => {
  await page.goto("/property/villa-mai-khao-1/");
  await page.getByRole("button", { name: "Inquire about this home" }).click();
  await page.getByLabel("Full name").fill("Jane Preview");
  await page.getByLabel("Email", { exact: true }).fill("jane@example.com");
  await page.getByLabel("Country of residence").fill("United Kingdom");
  await page.locator('input[name="consent"]').check();
  await page
    .getByRole("button", { name: "Save preview inquiry", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("No email was sent");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Inquiries", exact: true }).click();
  await expect(page.getByText("Jane Preview", { exact: true })).toBeVisible();
});
test("staff preview CRUD validates bilingual fields and persists", async ({
  page,
}) => {
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Add listing", exact: true }).click();
  await page.getByLabel("Title (EN)").fill("Test preview home");
  await page.getByLabel("Title (TH)").fill("บ้านทดสอบ");
  await page.getByLabel("Expires on").fill("2000-01-01");
  await page
    .getByLabel("Description (EN)")
    .fill("Synthetic test home for a local preview only.");
  await page
    .getByLabel("Description (TH)")
    .fill("บ้านจำลองสำหรับการทดสอบในอุปกรณ์เท่านั้น");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(
    page.getByText("Preview listing saved on this device."),
  ).toBeVisible();
  await expect(page.getByText(/^Expiry reminder:/)).toContainText("Test preview home");
  await page.reload();
  await expect(
    page.getByText("Test preview home", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Test preview home" }).click();
  await expect(
    page.getByText("Test preview home", { exact: true }),
  ).toHaveCount(0);
});
test("core screen passes accessibility checks and optional analytics stays off", async ({
  page,
}, info) => {
  const analytics: string[] = [];
  page.on("request", (r) => {
    if (/google-analytics|googletagmanager/.test(r.url()))
      analytics.push(r.url());
  });
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".maplibregl-map")
    .analyze();
  expect(results.violations).toEqual([]);
  expect(analytics).toEqual([]);
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  expect(analytics).toEqual([]);
});
