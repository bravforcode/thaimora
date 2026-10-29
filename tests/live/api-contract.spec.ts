import { test, expect } from "@playwright/test";
import snapshot from "../fixtures/live-snapshot.json";
const base = snapshot[0];
const properties = Array.from({ length: 61 }, (_, i) => ({
  ...base,
  id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  slug: `contract-fixture-${i + 1}`,
  title: {
    en: `Contract API property ${i + 1}`,
    th: `รายการ API ทดสอบ ${i + 1}`,
  },
}));
test.beforeEach(async ({ page }) => {
  await page.route("**/mock-api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/v1/properties")) {
      await route.fulfill({
        json: {
          items: url.searchParams.has("cursor")
            ? properties.slice(50)
            : properties.slice(0, 50),
          total: 61,
          nextCursor: url.searchParams.has("cursor") ? null : "page-2",
        },
      });
    } else if (url.pathname.includes("/nearby"))
      await route.fulfill({ json: { items: [] } });
    else if (url.pathname.includes("/v1/properties/"))
      await route.fulfill({
        json: {
          ...properties[0],
          location: {
            lat: 7.94023,
            lng: 98.33045,
            accuracy: "exact",
            radiusMeters: 0,
          },
        },
      });
    else if (url.pathname.endsWith("/v1/fx"))
      await route.fulfill({
        json: { base: "THB", date: "2026-10-02", rates: { USD: 0.03 } },
      });
    else if (url.pathname.endsWith("/v1/content"))
      await route.fulfill({ json: { pois: [], events: [] } });
    else
      await route.fulfill({
        status: 404,
        json: { error: { message: "Unhandled test route" } },
      });
  });
});
test("live discovery follows every cursor and commits geometry without map-search loops", async ({
  page,
}) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.endsWith("/v1/properties"))
      urls.push(r.url());
  });
  await page.goto("/explore/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(page.locator(".property-card")).toHaveCount(61);
  expect(
    urls.some(
      (value) => new URL(value).searchParams.get("cursor") === "page-2",
    ),
  ).toBe(true);
  expect(new URL(urls[0]).searchParams.get("sort")).toBe("relevance");
  await expect(page.getByText("30 synthetic listings · preview")).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Sort properties" })
    .selectOption("distance");
  await expect
    .poll(() =>
      urls.some(
        (value) => new URL(value).searchParams.get("sort") === "distance",
      ),
    )
    .toBe(true);
  await expect(page.locator(".property-card")).toHaveCount(61);
});
test("live detail hydrates consented exact location while initial snapshot stays approximate", async ({
  page,
}) => {
  await page.goto("/property/contract-fixture-1/");
  await expect(
    page.getByRole("heading", { name: "Contract API property 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Location shared with the owner’s permission."),
  ).toBeVisible();
  const response = await page.request.get("/property/contract-fixture-1/");
  const html = await response.text();
  expect(html).not.toContain("7.94023");
  expect(html).not.toContain("98.33045");
});
test("live inquiry sends idempotency key and mocked widget token, and labels delivery retry honestly", async ({
  page,
}) => {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: "window.turnstile={render:function(el,options){window.contractAction=options.action;setTimeout(function(){options.callback('contract-widget-token')},0);return 'test-widget'},remove:function(){}}",
      }),
  );
  let submission: Record<string, unknown> | null = null,
    key: string | null = null;
  await page.route("**/mock-api/v1/inquiries", async (route) => {
    submission = route.request().postDataJSON();
    key = route.request().headers()["idempotency-key"];
    await route.fulfill({
      json: {
        id: "40000000-0000-4000-8000-000000000001",
        emailStatus: "pending",
      },
    });
  });
  await page.goto("/property/contract-fixture-1/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.getByRole("button", { name: "Inquire about this home" }).click();
  await page.getByLabel("Full name").fill("Contract Test");
  await page.getByLabel("Email", { exact: true }).fill("contract@example.com");
  await page.getByLabel("Country of residence").fill("UK");
  await page.locator('input[name="consent"]').check();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { turnstile?: unknown }).turnstile),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Email delivery is pending",
  );
  expect(submission).toMatchObject({
    propertyId: base.id,
    turnstileToken: "contract-widget-token",
  });
  expect(key).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    await page.evaluate(
      () => (window as unknown as { contractAction: string }).contractAction,
    ),
  ).toBe("inquiry");
});
test("actual geocoder fields create usable bilingual location suggestions", async ({
  page,
}) => {
  await page.route("**/mock-api/v1/places/autocomplete?**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "bang-tao",
            name: "Bang Tao, Phuket",
            location: { lat: 7.98, lng: 98.3 },
          },
        ],
      },
    }),
  );
  await page.goto("/explore/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Search location or property" })
    .fill("Bang");
  await page.getByRole("option", { name: "Bang Tao, Phuket" }).click();
  await expect(
    page.getByRole("combobox", { name: "Search location or property" }),
  ).toHaveValue("Bang Tao");
  await expect(page).toHaveURL(/q=Bang\+Tao/);
});
test("measurement requests require stored opt-in and stop after withdrawal", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  await page.route("**/mock-api/v1/analytics/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ json: { accepted: true } });
  });
  await page.goto("/property/contract-fixture-1/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Contract API property 1" }),
  ).toBeVisible();
  expect(events).toEqual([]);
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await page.locator(".cookie-banner .button").last().click();
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({
    propertyId: base.id,
    kind: "view",
    consented: true,
  });
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.getByRole("button", { name: "Inquire about this home" }).click();
  expect(events).toHaveLength(1);
});
