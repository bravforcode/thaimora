import { expect, test, type Page } from "@playwright/test";

const brokerId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const config = { billingEnabled: false, monthlyPrice: { amountMinor: 2500, currency: "usd", interval: "month" }, approvalRequired: false, contactDeliveryEnabled: false, lineLinkEnabled: false, registrationEnabled: true, termsVersion: "test-fixture-only", lineFriendUrl: null };
const profile = { id: brokerId, displayName: "Fixture Broker", company: "Test fixtures", phone: null, approvalStatus: "approved", approvedAt: null, createdAt: "2026-10-04T00:00:00Z", accountKind: "broker" };
const account = { profile, subscription: { status: "active", currentPeriodEnd: "2099-01-01T00:00:00Z", cancelAtPeriodEnd: false }, entitlement: { active: true, reason: "active" }, billingEnabled: false };
const totals = { views: 0, inquiries: 1, contactClicks: 0, leads: 1, newLeads: 1, contactedLeads: 0, closedLeads: 0, respondedLeads: 0, medianResponseSeconds: null };

async function mockBroker(page: Page) {
  let lead = { id: leadId, propertyId: "33333333-3333-4333-8333-333333333333", name: "Fixture Lead", email: "lead@example.test", country: "Thailand", message: "Private synthetic lead message", status: "new", createdAt: "2026-10-26T10:00:00Z", firstResponseAt: null as string | null };
  const patches: unknown[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem("thaimora-broker-session", JSON.stringify({ accessToken: "synthetic-broker-session", expiresAt: Date.now() + 3600000 }));
    if (!localStorage.getItem("thaimora-consent")) localStorage.setItem("thaimora-consent", "rejected");
  });
  await page.route("**/mock-api/**", route => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/mock-api")[1];
    if (path === "/v1/broker/config") return route.fulfill({ json: config });
    if (path === "/v1/broker/me") return route.fulfill({ json: account });
    if (path === "/v1/contact/preferences") return route.fulfill({ json: { emailEnabled: false, lineEnabled: false, lineLinked: false, consentVersion: "contact-relay-v1" } });
    if (path === "/v1/broker/dashboard") return route.fulfill({ json: { stats: { listings: 0, publishedListings: 0, newLeads: 1 }, listings: [], leads: [lead] } });
    if (path === "/v1/broker/reports/summary") return route.fulfill({ json: { totals: { ...totals, respondedLeads: lead.firstResponseAt ? 1 : 0, medianResponseSeconds: lead.firstResponseAt ? 1800 : null }, daily: [], listings: [] } });
    if (path === "/v1/broker/reports/leads") return route.fulfill({ json: { items: [lead] } });
    if (path === `/v1/broker/leads/${leadId}` && route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      lead = { ...lead, status: "contacted", firstResponseAt: "2026-10-26T10:30:00Z" };
      return route.fulfill({ json: { item: lead } });
    }
    return route.fulfill({ json: {} });
  });
  return patches;
}

test("broker dashboard report saves a lead status and shows the reply time", async ({ page }) => {
  const patches = await mockBroker(page);
  await page.goto("/broker/dashboard/");
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByText("Fixture Lead")).toBeVisible();
  await page.getByLabel("Follow-up status").selectOption("contacted");
  await expect.poll(() => patches).toEqual([{ status: "contacted" }]);
  await expect(page.getByLabel("Follow-up status")).toHaveValue("contacted");
  await expect(page.getByRole("cell", { name: "30 min", exact: true })).toBeVisible();
});

test("broker report range switches to 7 days and requests a matching window", async ({ page }) => {
  await mockBroker(page);
  const windows: string[] = [];
  await page.route("**/mock-api/v1/broker/reports/summary**", route => {
    windows.push(new URL(route.request().url()).search);
    return route.fulfill({ json: { totals, daily: [], listings: [] } });
  });
  await page.goto("/broker/dashboard/");
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(page.getByRole("button", { name: "7 days", exact: true })).toHaveAttribute("aria-pressed", "true");
  const span = () => {
    const match = windows.at(-1)?.match(/^\?from=(\d{4}-\d{2}-\d{2})&to=(\d{4}-\d{2}-\d{2})$/);
    return match ? (Date.parse(match[2]) - Date.parse(match[1])) / 86_400_000 : null;
  };
  await expect.poll(span).toBe(6);
});
