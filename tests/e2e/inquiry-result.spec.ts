import { test, expect } from "@playwright/test";
test("preview inquiry confirmation keeps Done on one line at 1024px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("thaimora-consent"))
      localStorage.setItem("thaimora-consent", "rejected");
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/property/villa-bang-tao-1/");
  await page.getByRole("button", { name: "Inquire about this home" }).click();
  await page.getByLabel("Full name").fill("Jane Preview");
  await page.getByLabel("Email", { exact: true }).fill("jane@example.com");
  await page.getByLabel("Country of residence").fill("United Kingdom");
  await page.locator('input[name="consent"]').check();
  await page
    .getByRole("button", { name: "Save preview inquiry", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("No email was sent");
  const done = page.getByRole("button", { name: "Done", exact: true });
  await expect(done).toBeVisible();
  const box = await done.boundingBox();
  expect(box?.height ?? Infinity).toBeLessThan(50);
});
