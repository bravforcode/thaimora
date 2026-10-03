import { test, expect } from "@playwright/test";
for (const locale of ["en", "th"]) test(`conditional refresh and exclusive expiry in ${locale}`, async ({ page }) => {
  const initial = new Date("2026-10-04T03:00:00Z");
  await page.clock.install({ time: initial });
  const meta = { revision: "r1", poisVersion: "p1", eventsVersion: "e1", homeVersion: "h1", sources: [] };
  const poi = { id: "test-place", name: { en: "Synthetic test place", th: "สถานที่สำหรับทดสอบ" }, category: "Beach", location: { lat: 7.9, lng: 98.3 } };
  const event = { id: "test-event", name: { en: "Synthetic test event", th: "กิจกรรมสำหรับทดสอบ" }, startsAt: initial.toISOString(), endsAt: new Date(initial.getTime() + 90_000).toISOString() };
  let calls = 0; let conditional = false;
  await page.route("**/mock-api/v1/content**", async route => {
    calls += 1;
    const scoped = new URL(route.request().url()).searchParams.get("scope") === "events";
    if (!scoped) await route.fulfill({ json: { pois: [poi], events: [], meta }, headers: { etag: '"full-1"' } });
    else if (calls === 2) await route.fulfill({ json: { events: [event], meta: { ...meta, eventsVersion: "e2" } }, headers: { etag: '"events-2"' } });
    else { conditional = route.request().headers()["if-none-match"] === '"events-2"'; await route.fulfill({ status: 304, body: "" }); }
  });
  await page.goto(locale === "th" ? "/th/guide/" : "/guide/");
  await expect(page.getByRole("heading", { name: poi.name[locale] })).toBeVisible();
  await expect(page.getByText(locale === "th" ? "ยังไม่ได้เชื่อมแหล่งกิจกรรมอัตโนมัติ แสดงเฉพาะกิจกรรมที่ยืนยันและเผยแพร่แล้ว" : "No automatic event source is connected. Only confirmed published events are shown.")).toBeVisible();
  await page.clock.runFor(60_001);
  await expect(page.getByText(event.name[locale], { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: poi.name[locale] })).toBeVisible();
  await page.clock.runFor(30_001);
  await expect(page.getByText(event.name[locale], { exact: false })).toHaveCount(0);
  await page.clock.runFor(30_001);
  await expect.poll(() => conditional).toBe(true);
  expect(calls).toBe(3);
});
test("guide bounds rendered cards and makes later records accessible", async ({ page }) => {
  const pois = Array.from({ length: 100 }, (_, index) => ({ id: `test-place-${index + 1}`, name: { en: `Synthetic place ${index + 1}`, th: `สถานที่ทดสอบ ${index + 1}` }, category: "Beach", location: { lat: 7.9, lng: 98.3 } }));
  await page.route("**/mock-api/v1/content**", route => route.fulfill({ json: { pois, events: [] } }));
  await page.goto("/guide/");
  await expect(page.locator(".guide-places > article")).toHaveCount(48);
  const navigation = page.getByRole("navigation", { name: "Place directory pages" });
  await expect(navigation.getByRole("status")).toHaveText("1–48 of 100 places");
  await expect(navigation.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await navigation.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic place 49", exact: true })).toBeVisible();
  await navigation.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".guide-places > article")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Synthetic place 100", exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Next page" })).toBeDisabled();
});
test("staff releases only an explicitly selected protected source record", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("thaimora-staff-token", "synthetic-admin-token"));
  const row = { id: "11111111-1111-4111-8111-111111111111", name: { en: "Protected synthetic place", th: "สถานที่ทดสอบที่ป้องกันไว้" }, source: "OSM", admin_override: true };
  let released = false; let protectedQuery = false;
  await page.route("**/mock-api/v1/admin/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/automation")) {
      expect(route.request().method()).toBe("POST"); expect(route.request().postDataJSON()).toEqual({ enabled: true });
      expect(route.request().headers().authorization).toBe("Bearer synthetic-admin-token");
      released = true; await route.fulfill({ json: { ok: true } });
    } else if (url.pathname.endsWith("/pois")) {
      protectedQuery = url.searchParams.get("protected") === "true";
      await route.fulfill({ json: { items: released ? [] : [row] } });
    } else await route.fulfill({ json: { items: [] } });
  });
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Content updates", exact: true }).click();
  await expect(page.getByText(row.name.en, { exact: false })).toBeVisible();
  expect(protectedQuery).toBe(true); expect(released).toBe(false);
  await page.getByRole("button", { name: "Return to automatic updates", exact: true }).click();
  await expect(page.getByText("No protected source records.", { exact: true })).toBeVisible();
  expect(released).toBe(true);
});
