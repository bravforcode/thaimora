import { test, expect } from "@playwright/test";
import snapshot from "../fixtures/live-snapshot.json";
import { propertyToImportRow, exportCSV } from "../../src/lib/import";
import type { PublicProperty } from "../../src/lib/property";
const property = {
  ...snapshot[0],
  sourceUrl: "https://source.test/listing",
  sourceId: "licensed:1",
  license: "Authorized",
  fetchedAt: "2026-10-03T00:00:00Z",
  sourceUpdatedAt: "2026-10-02T00:00:00Z",
};
const place = {
  id: "poi",
  name: { en: "Sourced beach", th: "หาดมีแหล่งที่มา" },
  category: "Beach",
  location: { lat: 7.94, lng: 98.33 },
  distance_meters: 425,
  source_url: "https://source.test/place",
  license: "ODbL 1.0",
  fetchedAt: "2026-10-03T00:00:00Z",
  sourceUpdatedAt: "2026-10-02T00:00:00Z",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/mock-api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/v1/properties"))
      await route.fulfill({ json: { items: [property], nextCursor: null } });
    else if (path.includes("/nearby"))
      await route.fulfill({ json: { items: [place] } });
    else if (path.includes("/v1/properties/"))
      await route.fulfill({ json: property });
    else if (path.endsWith("/v1/content"))
      await route.fulfill({ json: { pois: [place], events: [] } });
    else if (path.endsWith("/v1/fx"))
      await route.fulfill({ json: { date: "2026-10-03", rates: { THB: 1 } } });
    else await route.fulfill({ json: { items: [] } });
  });
});
for (const corrupt of [null, { unexpected: true }, [{}, null, 5, "invalid"]])
  test(`corrupt favorites ${JSON.stringify(corrupt)} cannot crash discovery`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (value) =>
        localStorage.setItem("thaimora-favorites", JSON.stringify(value)),
      corrupt,
    );
    await page.goto("/explore/");
    await page
      .getByRole("button", { name: "Reject optional", exact: true })
      .click();
    await expect(page.locator(".property-card")).toHaveCount(1);
    await page
      .locator(".property-card")
      .getByRole("button", { name: "Save property", exact: true })
      .click();
    await expect(
      page.locator(".property-card .favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
test("autocomplete distinguishes loading, empty, error and retry and discards stale responses", async ({
  page,
}) => {
  let retries = 0,
    slowStarted = false,
    releaseSlow: () => void = () => {};
  const slowGate = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  let slowFinished: () => void = () => {};
  const slowDone = new Promise<void>((resolve) => {
    slowFinished = resolve;
  });
  await page.route("**/mock-api/v1/places/autocomplete?**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "Slow") {
      slowStarted = true;
      await slowGate;
      try {
        await route.fulfill({
          json: {
            items: [
              {
                id: "old",
                name: "Old place",
                location: { lat: 7.94, lng: 98.33 },
              },
            ],
          },
        });
      } catch {}
      slowFinished();
      return;
    }
    if (q === "Retry" && retries++ === 0) {
      await route.fulfill({
        status: 503,
        json: { error: { message: "Provider temporarily unavailable" } },
      });
      return;
    }
    await route.fulfill({
      json: {
        items:
          q === "None"
            ? []
            : [
                {
                  id: "new",
                  name: "New place",
                  location: { lat: 7.94, lng: 98.33 },
                },
              ],
      },
    });
  });
  await page.goto("/explore/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  const input = page.getByRole("combobox", {
    name: "Search location or property",
  });
  await input.fill("None");
  await expect(page.locator(".autocomplete")).toContainText("No places found");
  await input.fill("Retry");
  await expect(page.locator(".autocomplete")).toContainText(
    "Place search is unavailable",
  );
  await page.getByRole("button", { name: "Retry place search" }).click();
  await expect(page.getByRole("option", { name: "New place" })).toBeVisible();
  await input.fill("Slow");
  await expect(page.locator(".autocomplete")).toContainText("Searching places");
  await expect.poll(() => slowStarted).toBe(true);
  await input.fill("Newest");
  await expect(page.getByRole("option", { name: "New place" })).toBeVisible();
  releaseSlow();
  await slowDone;
  await expect(page.getByRole("option", { name: "Old place" })).toHaveCount(0);
});
test("consumed inquiry token is refreshed for retry while the idempotency key and form stay unchanged", async ({
  page,
}) => {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: "window.turnstile={render:function(el,o){window.widgetOptions=o;setTimeout(function(){o.callback('token-one')},0);return 'mock-widget'},reset:function(){window.widgetOptions.callback('token-two')},remove:function(){}}",
      }),
  );
  const submissions: { key: string; body: Record<string, unknown> }[] = [];
  await page.route("**/mock-api/v1/inquiries", async (route) => {
    submissions.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    await route.fulfill(
      submissions.length === 1
        ? {
            status: 422,
            json: { error: { message: "Security token was consumed" } },
          }
        : {
            json: {
              id: "40000000-0000-4000-8000-000000000001",
              emailStatus: "sent",
            },
          },
    );
  });
  await page.goto("/property/contract-fixture-1/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.getByRole("button", { name: "Inquire about this home" }).click();
  await page.getByLabel("Full name").fill("Retry Test");
  await page.getByLabel("Email", { exact: true }).fill("retry@example.test");
  await page.getByLabel("Country of residence").fill("UK");
  await page.locator('input[name="consent"]').check();
  await page.locator('input[name="consentToShare"]').check();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as unknown as { widgetOptions?: unknown }).widgetOptions,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.locator(".inquiry-dialog").getByRole("alert"),
  ).toContainText("Security token was consumed");
  await expect(page.getByLabel("Full name")).toHaveValue("Retry Test");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.locator(".inquiry-dialog").getByRole("status"),
  ).toContainText("sent");
  expect(submissions).toHaveLength(2);
  expect(submissions[0].key).toBe(submissions[1].key);
  expect(submissions.map((v) => v.body.turnstileToken)).toEqual([
    "token-one",
    "token-two",
  ]);
  expect(submissions[0].body.message).toBe(submissions[1].body.message);
});
test("partial imports submit valid rows despite local errors and map server errors to original rows", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("thaimora-staff-token", "mock-staff"),
  );
  let payload: Record<string, unknown> = {};
  await page.route("**/mock-api/v1/admin/imports", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        job: { rows_written: 1 },
        errors: [{ row_number: 3, message: "Duplicate source row" }],
        skipped: 1,
      },
    });
  });
  await page.goto("/admin/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import & export", exact: true })
    .click();
  const row = {
    ...propertyToImportRow(property as PublicProperty),
    id: "",
    source_url: "https://source.test/listing",
    license: "Authorized",
    rights_evidence: "",
    rights_evidence_url: "https://source.test/rights",
    ownership_evidence_url: "https://source.test/owner",
    image_url: "https://source.test/image.jpg",
    image_source_url: "https://source.test/image",
    image_license: "Authorized",
    image_rights_evidence_url: "https://source.test/image-rights",
  };
  await page
    .locator('input[accept=".csv,.xlsx"]')
    .setInputFiles({
      name: "partial.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        exportCSV([
          row,
          { ...row, title_en: "" },
          { ...row, slug: "duplicate" },
          { ...row, slug: "existing-skipped" },
        ]),
      ),
    });
  const policy = page.getByRole("combobox", { name: "Duplicate policy" });
  await expect(policy).toHaveValue("skip");
  await policy.selectOption("update");
  await policy.selectOption("skip");
  await expect(page.locator(".import-panel").getByRole("alert")).toContainText(
    "Row 3:",
  );
  const commit = page.locator(".import-panel button").last();
  await expect(commit).toBeEnabled();
  await commit.click();
  await expect(page.locator(".notice.success[role='status']")).toContainText(
    "1 rows imported as drafts. 2 rows failed. 1 duplicates skipped",
  );
  await expect(
    page.locator(".import-panel").getByRole("alert").last(),
  ).toContainText("Row 4: Duplicate source row");
  expect(payload.duplicatePolicy).toBe("skip");
  expect(String(payload.csv)).toContain("rights_evidence_url");
  await expect(commit).toBeDisabled();
});
test("nearby detail and guide display actual distances and source freshness metadata", async ({
  page,
}) => {
  await page.goto("/property/contract-fixture-1/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(page.locator(".property-detail")).toContainText("425 m");
  await expect(page.locator(".property-detail")).toContainText("ODbL 1.0");
  await expect(page.locator(".property-detail")).toContainText(
    "Source updated",
  );
  await expect(page.locator(".property-detail")).toContainText("Fetched");
  await page.goto("/guide/");
  await expect(page.locator(".guide-places")).toContainText("ODbL 1.0");
  await expect(page.locator(".guide-places")).toContainText("Source updated");
  await page.goto("/explore/");
  await page.locator(".property-card .source-details summary").click();
  await expect(page.locator(".property-card")).toContainText("licensed:1");
  await expect(page.locator(".property-card")).toContainText("Fetched");
});
test("failed source edits keep the current publication state and form values", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("thaimora-staff-token", "mock-staff"),
  );
  await page.route("**/mock-api/v1/admin/properties", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...property,
            publication: {
              published: true,
              demo: false,
              rightsStatus: "approved",
              ownershipEvidence: "Approved authority",
              sourceUrl: property.sourceUrl,
              sourceId: property.sourceId,
              rightsEvidence: "Approved license",
            },
            privateLocation: {
              lat: 7.94,
              lng: 98.33,
              exact_publication_consent: false,
              consent_evidence: "",
            },
            gallery: [],
          },
        ],
      },
    }),
  );
  await page.route(`**/mock-api/v1/admin/properties/${property.id}`, (route) =>
    route.fulfill({
      status: 422,
      json: { error: { message: "Replacement source lacks rights approval" } },
    }),
  );
  await page.goto("/admin/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Edit ${property.title.en}`, exact: true })
    .click();
  const published = page.getByRole("checkbox", {
    name: "Publish to public catalog",
  });
  await expect(published).toBeChecked();
  const source = page.getByLabel("Listing source URL");
  await source.fill("https://source.test/replacement");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(page.locator(".editor-dialog").getByRole("alert")).toContainText(
    "Replacement source lacks rights approval",
  );
  await expect(published).toBeChecked();
  await expect(source).toHaveValue("https://source.test/replacement");
  await expect(page.locator(".editor-dialog")).toBeVisible();
});
