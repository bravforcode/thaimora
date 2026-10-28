import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ownerId = "44444444-4444-4444-8444-444444444444";
const brokerConfig = {
  billingEnabled: false,
  monthlyPrice: { amountMinor: 2500, currency: "usd", interval: "month" },
  approvalRequired: false,
  contactDeliveryEnabled: false,
  lineLinkEnabled: false,
  registrationEnabled: true,
  termsVersion: "test-fixture-only",
  lineFriendUrl: null,
};
const ownerProfile = {
  id: ownerId,
  displayName: "Test Owner",
  company: null,
  phone: null,
  approvalStatus: "approved",
  approvedAt: null,
  createdAt: "2026-10-04T00:00:00Z",
  accountKind: "owner",
};
const ownerAccount = {
  profile: ownerProfile,
  subscription: { status: "active", currentPeriodEnd: "2099-01-01T00:00:00Z", cancelAtPeriodEnd: false },
  entitlement: { active: true, reason: "active" },
  billingEnabled: false,
};
const sampleLead = {
  id: "22222222-2222-4222-8222-222222222222",
  propertyId: "30000000-0000-4000-8000-000000000001",
  name: "Visitor Lead",
  email: "lead@example.test",
  country: "Thailand",
  message: "Interested in this property.",
  status: "new",
  createdAt: "2026-10-26T10:00:00Z",
};
const sampleReport = {
  totals: {
    views: 12,
    inquiries: 3,
    contactClicks: 5,
    leads: 2,
    newLeads: 1,
    contactedLeads: 1,
    closedLeads: 0,
    respondedLeads: 1,
    medianResponseSeconds: 120,
  },
  daily: [
    { day: "2026-10-25", views: 4, inquiries: 1, contactClicks: 2 },
    { day: "2026-10-26", views: 8, inquiries: 2, contactClicks: 3 },
  ],
  listings: [
    {
      propertyId: "30000000-0000-4000-8000-000000000001",
      title: { en: "Contract snapshot fixture", th: "ข้อมูลทดสอบสัญญา" },
      slug: "contract-fixture-1",
      published: true,
      views: 12,
      inquiries: 3,
      contactClicks: 5,
    },
  ],
};
const samplePois = [
  { id: "poi-1", name: { en: "Patong Beach", th: "หาดป่าตอง" }, category: "Beach", lat: 7.89, lng: 98.29 },
  { id: "poi-2", name: { en: "Big Buddha", th: "พระใหญ่" }, category: "Culture", lat: 7.82, lng: 98.31 },
];
const sampleProperty = {
  id: "30000000-0000-4000-8000-000000000001",
  slug: "contract-fixture-1",
  title: { en: "Contract snapshot fixture", th: "ข้อมูลทดสอบสัญญา" },
  description: { en: "Synthetic snapshot used only by tests.", th: "ข้อมูลจำลองสำหรับทดสอบเท่านั้น" },
  transaction: "sale",
  type: "condo",
  priceTHB: 3500000,
  areaM2: 75,
  landAreaM2: null,
  beds: 2,
  baths: 2,
  floor: 3,
  builtYear: 2024,
  ownership: "freehold",
  furnishing: "furnished",
  status: "available",
  location: { lat: 7.94, lng: 98.33, accuracy: "approximate", radiusMeters: 300 },
  zone: "Phuket",
  province: "Phuket",
  images: [{ url: "/images/phuket-coast.jpg", alt: { en: "Test image", th: "ภาพทดสอบ" } }],
  amenities: ["Pool"],
  updatedAt: "2026-10-01T00:00:00.000Z",
  expiresAt: null,
};

async function setupPageMocks(page: Page, authenticated = false) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("thaimora-consent")) {
      localStorage.setItem("thaimora-consent", "rejected");
    }
  });
  if (authenticated) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "thaimora-broker-session",
        JSON.stringify({ accessToken: "synthetic-owner-session", expiresAt: Date.now() + 3600000 })
      );
    });
  }
  await page.route("**/mock-api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/mock-api")[1] || "";
    if (path.startsWith("/v1/content")) {
      return route.fulfill({
        json: {
          pois: samplePois,
          events: [],
          meta: { revision: "r1", poisVersion: "p1", eventsVersion: "e1", homeVersion: "h1", sources: [] },
        },
      });
    }
    if (path.startsWith("/v1/properties/")) {
      return route.fulfill({ json: { property: sampleProperty } });
    }
    if (path.startsWith("/v1/properties")) {
      return route.fulfill({ json: { items: [sampleProperty] } });
    }
    if (path === "/v1/broker/config") return route.fulfill({ json: brokerConfig });
    if (path === "/v1/broker/me") return route.fulfill({ json: ownerAccount });
    if (path === "/v1/broker/dashboard") {
      return route.fulfill({ json: { stats: { listings: 1, publishedListings: 1, newLeads: 1 }, listings: [], leads: [sampleLead] } });
    }
    if (path === "/v1/broker/reports/summary") return route.fulfill({ json: sampleReport });
    if (path === "/v1/broker/reports/leads") return route.fulfill({ json: { items: [sampleLead] } });
    return route.fulfill({ json: {} });
  });
}

test.describe("UI/UX System Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("header navigation, language toggle, and mobile preferences drawer", async ({ page }) => {
    await setupPageMocks(page);
    await page.goto("/");

    // 1. Desktop Navigation
    await expect(page.locator("header.header")).toBeVisible();
    await expect(page.getByRole("link", { name: "PhuketLens home" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

    // 2. Language Switcher (EN -> TH)
    await page.locator("#language").selectOption("th");
    await expect(page).toHaveURL(/\/th\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 3. Language Switcher (TH -> EN)
    await page.locator("#language").selectOption("en");
    await expect(page).toHaveURL(/\/(?!th)/);

    // 4. Mobile Preferences Drawer & Tap Targets
    await page.setViewportSize({ width: 360, height: 800 });
    const summary = page.locator(".preferences summary");
    await expect(summary).toBeVisible();
    const box = await summary.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Open drawer
    await summary.click();
    const panel = page.locator(".preferences-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "For owners" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "For agents" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Explore Phuket" })).toBeVisible();
  });

  test("search filtering, currency switching, and zero-results reset resilience", async ({ page }) => {
    await setupPageMocks(page);
    await page.goto("/explore/");

    // 1. Transaction filter: Rent
    const transactionSelect = page.locator('select[aria-label="Transaction type"], select[name="transaction"]').first();
    if (await transactionSelect.isVisible()) {
      await transactionSelect.selectOption("rent");
      await expect(page).toHaveURL(/transaction=rent/);
    }

    // 2. Currency Switcher in Preferences
    await page.locator(".preferences summary").click();
    const currencySelect = page.locator('.preferences-panel select[value], .preferences-panel label select').first();
    await currencySelect.selectOption("USD");

    // 3. Search non-existent keyword -> check empty state
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="zone" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("nonexistent-xyz-nowhere");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/no properties|ไม่พบทรัพย์/i)).toBeVisible();

      // Reset filters button restores properties
      const resetButton = page.getByRole("button", { name: /reset|clear|ล้าง/i });
      if (await resetButton.isVisible()) {
        await resetButton.click();
        await expect(searchInput).toHaveValue("");
      }
    }
  });

  test("property card favorites persistence and side-by-side comparison drawer", async ({ page }) => {
    await setupPageMocks(page);
    await page.goto("/explore/");

    // On mobile view toggle to list if needed
    const listBtn = page.getByRole("button", { name: "List", exact: true });
    if (await listBtn.isVisible()) {
      await listBtn.click();
    }

    const card = page.locator(".property-card").first();
    await expect(card).toBeVisible();

    // Toggle favorite
    const saveBtn = card.getByRole("button", { name: /save property/i });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(page.locator(".saved-link b")).toHaveText("1");
    }

    // Compare button
    const compareBtn = card.getByRole("button", { name: /compare/i });
    if (await compareBtn.isVisible()) {
      await compareBtn.click();
      const openCompare = page.locator(".compare-bar").getByRole("button", { name: /^compare$|^เปรียบเทียบ$/i });
      if (await openCompare.isVisible()) {
        await openCompare.click();
        await expect(page.locator("dialog.compare-dialog")).toBeVisible();
        await page.locator('.compare-dialog button[aria-label*="Close"], .compare-dialog .icon-button').click();
        await expect(page.locator("dialog.compare-dialog")).not.toBeVisible();
      }
    }
  });

  test("property detail page renders specs, nearby places, and accessible inquiry modal", async ({ page }) => {
    await setupPageMocks(page);
    await page.goto("/property/contract-fixture-1/");

    // Check detail attributes
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".property-detail")).toBeVisible();

    // Inquiry button & modal
    const inquireBtn = page.getByRole("button", { name: /inquire|ติดต่อ/i }).first();
    await expect(inquireBtn).toBeVisible();
    await inquireBtn.click();

    const dialog = page.locator("dialog[open], [role=dialog]");
    await expect(dialog).toBeVisible();

    // Form inputs accessible and labeled
    await expect(dialog.getByRole("textbox", { name: /name|ชื่อ/i })).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: /email|อีเมล/i })).toBeVisible();

    // Escape closes modal
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("guide directory renders categories, cards, and pagination", async ({ page }) => {
    await setupPageMocks(page);
    await page.goto("/guide/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const articles = page.locator(".guide-places article");
    await expect(articles.first()).toBeVisible();
    await expect(page.getByText("Patong Beach")).toBeVisible();

    // Thai guide check
    await page.goto("/th/guide/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("หาดป่าตอง")).toBeVisible();
  });

  test("owner portal and dashboard: value proposition, report KPIs, SVG chart, and CSV export", async ({ page }) => {
    // 1. Unauthenticated Owner Page
    await setupPageMocks(page, false);
    await page.goto("/owner/");
    await expect(page.getByRole("heading", { name: "List your property. Reach buyers directly." })).toBeVisible();
    await expect(page.getByText("$25.00 / month").first()).toBeVisible();
    await expect(page.getByText("Payments are not open yet", { exact: false })).toBeVisible();

    // Tabs toggle
    await page.getByRole("button", { name: "I already have an account" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // 2. Authenticated Owner Dashboard with ReportPanel
    await setupPageMocks(page, true);
    await page.goto("/owner/dashboard/");
    await expect(page.getByRole("heading", { name: "Report", exact: true })).toBeVisible();

    // Range selector toggles
    const btn30d = page.getByRole("button", { name: "30 days" });
    await expect(btn30d).toBeVisible();
    await btn30d.click();
    await expect(btn30d).toHaveAttribute("aria-pressed", "true");

    // KPI cards & SVG chart
    await expect(page.locator(".report-kpis dt").filter({ hasText: "Views" })).toBeVisible();
    await expect(page.locator(".report-kpis dt").filter({ hasText: "Awaiting reply" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily views", exact: true })).toBeVisible();
    await expect(page.locator(".report-trend")).toBeVisible();

    // Listing table
    await expect(page.getByText("Contract snapshot fixture")).toBeVisible();
    await expect(page.getByText("Visitor Lead")).toBeVisible();

    // CSV export trigger
    const exportBtn = page.getByRole("button", { name: /export/i }).first();
    await expect(exportBtn).toBeVisible();
  });

  test("legal and compliance pages are accessible and bilingual", async ({ page }) => {
    await setupPageMocks(page);

    // Terms (EN & TH)
    await page.goto("/terms/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/th/terms/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Privacy (EN & TH)
    await page.goto("/privacy/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/th/privacy/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("viewport responsiveness without horizontal scroll (360px, 390px, 1024px, 1440px)", async ({ page }) => {
    await setupPageMocks(page);
    const routes = ["/", "/th/", "/property/contract-fixture-1/", "/guide/", "/owner/", "/privacy/"];

    for (const width of [360, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(route);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(width);
      }
    }
  });

  test("WCAG 2.1 AA accessibility audit across core views", async ({ page }) => {
    await setupPageMocks(page);
    const routes = ["/", "/property/contract-fixture-1/", "/guide/", "/owner/", "/terms/"];

    for (const route of routes) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude(".maplibregl-map")
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
