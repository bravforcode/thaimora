import { test, expect } from "@playwright/test";
import snapshot from "../fixtures/live-snapshot.json";
import { propertyToImportRow, exportCSV } from "../../src/lib/import";
import type { PublicProperty } from "../../src/lib/property";
const base = snapshot[0] as PublicProperty;
const serverId = "40000000-0000-4000-8000-000000000001";
test("staff uses daily DTOs, actual inquiry fields, and server-generated IDs for later mutations", async ({
  page,
}) => {
  let staff: Record<string, unknown>[] = [];
  const mutations: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  }[] = [];
  await page.addInitScript(() =>
    sessionStorage.setItem("thaimora-staff-token", "mock-staff-token"),
  );
  await page.route("**/mock-api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/admin/stats")) {
      await route.fulfill({
        json: {
          items: [
            {
              day: "2026-10-03",
              property_id: null,
              views: 7,
              inquiries: 2,
              contact_clicks: 3,
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith("/admin/inquiries")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "inq1",
              property_id: base.id,
              name: "Live Inquiry",
              email: "test@example.test",
              country: "UK",
              message: "Please share details",
              created_at: "2026-10-03T00:00:00Z",
              status: "new",
              email_status: "sent",
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.includes("/admin/properties")) {
      if (req.method() === "GET") {
        await route.fulfill({ json: { items: staff } });
        return;
      }
      const body = req.method() === "DELETE" ? undefined : req.postDataJSON();
      mutations.push({ method: req.method(), path: url.pathname, body });
      if (req.method() === "DELETE") {
        staff = [];
        await route.fulfill({ json: { deleted: true } });
        return;
      }
      const images = [
        {
          url: "/images/phuket-coast.jpg",
          alt: { en: "Coast", th: "ชายฝั่ง" },
        },
        {
          url: "/images/phuket-building.jpg",
          alt: { en: "Building", th: "อาคาร" },
        },
      ];
      staff = [
        {
          ...base,
          id: serverId,
          title: body.title,
          description: body.description,
          slug: body.slug,
          images,
          publication: {
            published: false,
            demo: false,
            rightsStatus: "pending",
            ownershipEvidence: "",
            sourceUrl: "",
            rightsEvidence: "",
          },
          privateLocation: body.privateLocation,
          gallery: images.map((image, i) => ({
            ...image,
            id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
            position: i,
            rights_status: "approved",
            rights_evidence: "mock permission",
            license: "Mock license",
          })),
        },
      ];
      // Real writes return a raw row; the client must refresh its canonical DTO.
      await route.fulfill({
        json: { item: { id: serverId, price_thb: body.price_thb } },
      });
      return;
    }
    await route.fulfill({ json: { items: [] } });
  });
  await page.goto("/admin/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await expect(page.locator(".stats-panel")).toContainText("Opted-in views: 7");
  await page.getByRole("button", { name: "Inquiries", exact: true }).click();
  await expect(page.locator(".admin-table").last()).toContainText(base.id);
  await expect(page.locator(".admin-table").last()).toContainText("sent");
  await page.getByRole("button", { name: "Listings", exact: true }).click();
  await page.getByRole("button", { name: "Add listing", exact: true }).click();
  await page.getByLabel("Title (EN)").fill("Server ID listing");
  await page.getByLabel("Title (TH)").fill("รายการทดสอบ");
  await page.getByLabel("Description (EN)").fill("Contract test staff draft.");
  await page.getByLabel("Description (TH)").fill("รายการทดสอบฉบับร่าง");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Server ID listing", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Server ID listing", exact: true })
    .click();
  const longitude = page.getByLabel("Protected exact longitude");
  const initialLongitude = await longitude.inputValue();
  const pin = page.locator(".admin-map-canvas .maplibregl-marker");
  await pin.scrollIntoViewIfNeeded();
  const bounds = await pin.boundingBox();
  if (!bounds) throw new Error("Staff location pin is unavailable.");
  const x = bounds.x+bounds.width/2, y = bounds.y+bounds.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+50,y-15,{steps:6});await page.mouse.up();
  await expect.poll(()=>longitude.inputValue()).not.toBe(initialLongitude);
  await page
    .getByRole("button", { name: "Move image later", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect
    .poll(() => mutations.filter((v) => v.method === "PATCH").length)
    .toBe(1);
  expect(
    mutations
      .find((v) => v.method === "PATCH")
      ?.path.endsWith(`/properties/${serverId}`),
  ).toBe(true);
  const images = mutations.find((v) => v.method === "PATCH")?.body?.images as {
    id: string;
    position: number;
    rights_evidence: string;
  }[];
  expect(images.map((image) => image.id)).toEqual([
    "50000000-0000-4000-8000-000000000002",
    "50000000-0000-4000-8000-000000000001",
  ]);
  expect(images.map((image) => image.position)).toEqual([0, 1]);
  expect(images[0].rights_evidence).toBe("mock permission");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Server ID listing", exact: true })
    .click();
  await expect
    .poll(() => mutations.filter((v) => v.method === "DELETE").length)
    .toBe(1);
  expect(
    mutations
      .find((v) => v.method === "DELETE")
      ?.path.endsWith(`/properties/${serverId}`),
  ).toBe(true);
});
test("live import preserves evidence and reports partial row errors", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("thaimora-staff-token", "mock-staff-token"),
  );
  let csv = "";
  await page.route("**/mock-api/**", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().url().endsWith("/admin/imports")
    ) {
      csv = route.request().postDataJSON().csv;
      await route.fulfill({
        json: {
          job: { rows_written: 1 },
          errors: [
            { row_number: 3, field: "slug", message: "Duplicate source slug" },
          ],
          rows: [
            { row_number: 2, status: "imported", property_id: serverId },
            {
              row_number: 3,
              status: "error",
              message: "Duplicate source slug",
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: { items: [] } });
  });
  await page.goto("/admin/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.getByRole("button",{name:"Import & export",exact:true}).click();
  const row = {
    ...propertyToImportRow(base),
    id: "",
    source_url: "https://source.test/property",
    license: "Authorized",
    rights_evidence: "permission",
    ownership_evidence_url: "https://source.test/ownership",
    image_url: "https://source.test/photo.jpg",
    image_source_url: "https://source.test/image",
    image_license: "Authorized",
    image_rights_evidence_url: "https://source.test/rights",
  };
  await page
    .locator('input[type="file"][accept=".csv,.xlsx"]')
    .setInputFiles({
      name: "contract.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(exportCSV([row, { ...row, slug: "duplicate-slug" }])),
    });
  await page
    .locator(".import-panel > button,.import-panel button")
    .last()
    .click();
  await expect(page.locator(".notice.success[role='status']")).toContainText(
    "1 rows imported as drafts. 1 rows failed.",
  );
  await expect(page.locator(".import-panel").getByRole("alert")).toContainText(
    "Row 3: slug: Duplicate source slug",
  );
  expect(csv).toContain("price_thb");
  expect(csv).toContain("ownership_evidence_url");
  expect(csv).toContain("https://source.test/rights");
  await expect(page.locator(".import-panel button").last()).toBeDisabled();
});
