import { test, expect } from "@playwright/test";
test("2,000 explicitly synthetic map points cluster into a bounded visible marker set", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/explore/?perf=2000");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(
    page.getByText("2,000 synthetic markers · performance fixture", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".map-cluster").first()).toBeVisible({
    timeout: 20000,
  });
  expect(await page.locator(".map-price,.map-cluster").count()).toBeLessThan(
    200,
  );
  expect(await page.locator(".property-card").count()).toBe(30);
  expect(
    failures.filter((f) => /worker failed|source.*error/i.test(f)),
  ).toEqual([]);
});
test("Thai URLs render Thai content and language preference survives a return home", async ({
  page,
}) => {
  await page.goto("/explore/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.getByLabel("Language", { exact: true }).selectOption("th");
  // Dev server compiles /th/explore/ on first visit, which can pass the 5s default.
  await expect(page).toHaveURL(/\/th\//, { timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: "ค้นหาที่ที่ใช่ในประเทศไทย" }),
  ).toBeVisible();
  await page.goto("/th/privacy/");
  await expect(
    page.getByRole("heading", { name: "ความเป็นส่วนตัวของคุณสำคัญ" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/th\//);
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
});
