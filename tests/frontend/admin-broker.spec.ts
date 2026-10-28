import { expect, test } from "@playwright/test";

const brokers = {
  items: [
    { id: "11111111-1111-4111-8111-111111111111", displayName: "Fixture Broker", company: "Test fixtures", phone: null, approvalStatus: "approved", approvedAt: null, createdAt: "2026-10-04T00:00:00Z", accountKind: "broker", subscription: { status: "active", currentPeriodEnd: null } },
    { id: "44444444-4444-4444-8444-444444444444", displayName: "Fixture Owner", company: null, phone: null, approvalStatus: "pending", approvedAt: null, createdAt: "2026-10-05T00:00:00Z", accountKind: "owner", subscription: { status: "none", currentPeriodEnd: null } },
  ],
};

test("admin brokers desk shows account type, filters owners, and flags truncated lists", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("thaimora-staff-token", "synthetic-admin-token"));
  await page.route("**/mock-api/v1/admin/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/brokers")) return route.fulfill({ json: brokers });
    if (path.endsWith("/properties")) return route.fulfill({ json: { items: [], truncated: true } });
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/admin/");
  await expect(page.getByRole("status").filter({ hasText: "Showing the first 1,000 records." })).toBeVisible();
  await page.getByRole("button", { name: "Brokers & contacts", exact: true }).click();
  const table = page.locator(".broker-desk .admin-table");
  const owner = table.getByRole("row", { name: /Fixture Owner/ });
  await expect(owner.getByRole("cell").nth(1)).toHaveText("Owner");
  await expect(table.getByRole("row", { name: /Fixture Broker/ }).getByRole("cell").nth(1)).toHaveText("Broker");
  await page.getByLabel("Account type").selectOption("owner");
  await expect(table.getByRole("row", { name: /Fixture Broker/ })).toHaveCount(0);
  await expect(owner).toBeVisible();
});
