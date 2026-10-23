import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("thaimora-consent"))
      localStorage.setItem("thaimora-consent", "rejected");
  });
});
test("broker dashboard runs as a labeled demo without an account", async ({
  page,
}) => {
  await page.goto("/broker/dashboard/");
  await expect(page.getByRole("note")).toContainText("Demo preview");
  await expect(
    page.getByRole("heading", { name: "Sample properties", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".broker-listings article")).toHaveCount(6);
  await expect(
    page.getByText("Account services are not connected yet."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveCount(0);
});
test("preview inquiry from this device appears on the demo dashboard", async ({
  page,
}) => {
  await page.goto("/broker/dashboard/");
  await page.evaluate(() =>
    localStorage.setItem(
      "thaimora-inquiries",
      JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Demo Visitor",
          email: "visitor@example.test",
          country: "Thailand",
          message: "Is this villa still available for a viewing?",
          propertyId: "10000000-0000-4000-8000-000000000001",
          consent: true,
          createdAt: "2026-10-23T10:00:00.000Z",
          deliveryStatus: "local_preview",
        },
      ]),
    ),
  );
  await page.reload();
  await expect(page.locator(".broker-leads article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Demo Visitor", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Inquiries on this device")).toBeVisible();
});
