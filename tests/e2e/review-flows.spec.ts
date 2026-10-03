import { test, expect } from "@playwright/test";
test("filter URLs restore controls and comparisons survive reload", async ({
  page,
}, info) => {
  await page.goto("/?type=villa&sort=price_desc&beds=2");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Property type", exact: true }),
  ).toHaveValue("villa");
  await expect(
    page.getByRole("combobox", { name: "Sort properties" }),
  ).toHaveValue("price_desc");
  await page
    .locator(".property-card")
    .first()
    .getByRole("button", { name: "Compare property" })
    .click();
  await page.reload();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Compare", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Property type", exact: true }),
  ).toHaveValue("villa");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("combobox", {name:"Zone", exact:true}).selectOption({ index: 1 });
  await expect(page).toHaveURL(/zone=/);
  const amenity = page.locator(".amenity-filters input").first();
  await amenity.check();
  await expect(page).toHaveURL(/amenities=/);
});
test("polygon keyboard alternative rejects crossing edges and applies a valid area", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Draw search area", exact: true })
    .click();
  await page
    .getByText("Enter area coordinates with the keyboard", { exact: true })
    .click();
  const input = page.locator(".polygon-editor textarea");
  await input.fill("98,7\n99,8\n98,8\n99,7");
  await page.getByRole("button", { name: "Apply area", exact: true }).click();
  await expect(page.locator(".polygon-editor").getByRole("alert")).toContainText("must not cross");
  await input.fill("98,7\n99,7\n99,9\n98,9");
  await page.getByRole("button", { name: "Apply area", exact: true }).click();
  await expect(page).toHaveURL(/polygon=/);
  await expect(page.locator(".polygon-editor")).toHaveCount(0);
});
