import { test, expect } from "@playwright/test";
import snapshot from "../fixtures/live-snapshot.json";

test("image upload sends only public flags while retaining rights proof in the private staff save", async ({ page }) => {
  const listing = snapshot[0];
  const privateProof = "https://rights.example.test/private-owner-license";
  let storageMetadata: unknown;
  let savedImages: { url: string; rights_evidence: string }[] = [];
  await page.addInitScript(() => sessionStorage.setItem("thaimora-staff-token", "mock-staff-token"));
  await page.route("**/mock-storage/storage/v1/object/property-images/**", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["content-type"]).toBe("image/jpeg");
    storageMetadata = JSON.parse(Buffer.from(request.headers()["x-metadata"], "base64").toString("utf8"));
    await route.fulfill({ json: { Key: "mock-image" } });
  });
  await page.route("**/mock-api/**", async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname.includes("/admin/properties")) {
      if (request.method() === "PATCH") {
        savedImages = request.postDataJSON().images;
        await route.fulfill({ json: { item: { id: listing.id } } });
      } else {
        await route.fulfill({ json: { items: [{ ...listing, gallery: [], publication: { published: false, demo: false, rightsStatus: "pending" } }] } });
      }
      return;
    }
    await route.fulfill({ json: { items: [] } });
  });
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Reject optional", exact: true }).click();
  await page.getByRole("button", { name: `Edit ${listing.title.en}`, exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept(privateProof));
  await page.getByLabel("Upload owned image", { exact: true }).setInputFiles("public/images/phuket-coast.jpg");
  await expect.poll(() => storageMetadata).toEqual({ rights_confirmed: true, sanitized: true });
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect.poll(() => savedImages.length).toBeGreaterThan(listing.images.length);
  const uploaded = savedImages.find((image) => image.url.includes("/storage/v1/object/public/property-images/"));
  expect(uploaded?.rights_evidence).toBe(privateProof);
});
