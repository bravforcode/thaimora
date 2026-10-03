import { describe, it, expect } from "vitest";
import { snapshotProperty } from "../../supabase/functions/_shared/domain";
import {
  publicSnapshot,
  snapshotForExport,
  priceLabel,
} from "../../src/lib/property";
import { demoProperties } from "../../src/lib/demo";
describe("backend snapshot/frontend contract", () => {
  it("consumes a safely projected exact-publication listing without private coordinates or evidence", () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "test",
      title: { en: "Test", th: "ทดสอบ" },
      description: { en: "Description", th: "รายละเอียด" },
      transaction: "sale",
      type: "villa",
      price_thb: 1000000,
      area_m2: 100,
      land_area_m2: null,
      beds: 2,
      baths: 2,
      floor: null,
      built_year: null,
      ownership: "freehold",
      furnishing: "furnished",
      status: "available",
      public_location: {
        lat: 7.912345,
        lng: 98.312345,
        accuracy: "exact",
        radiusMeters: 0,
      },
      zone: "Phuket",
      province: "Phuket",
      images: [
        {
          url: "https://example.test/fixture.jpg",
          alt: { en: "Test", th: "ทดสอบ" },
        },
      ],
      amenities: [],
      updated_at: "2026-10-03T00:00:00Z",
      expires_at: null,
    };
    const result = publicSnapshot(snapshotProperty(row));
    expect(result.location.accuracy).toBe("approximate");
    expect(result.location.radiusMeters).toBe(300);
    expect(JSON.stringify(result)).not.toContain("7.912345");
    expect(JSON.stringify(result)).not.toContain("98.312345");
    expect(JSON.stringify(result)).not.toContain("consent_evidence");
  });
  it("public CSV projection coarsens consented exact API coordinates", () => {
    const p = {
      ...demoProperties[0],
      location: {
        lat: 7.912345,
        lng: 98.312345,
        accuracy: "exact" as const,
        radiusMeters: 0,
      },
    };
    expect(() => publicSnapshot(p)).toThrow();
    expect(snapshotForExport(p).location.accuracy).toBe("approximate");
  });
  it("shows THB when a requested live exchange rate is unavailable", () => {
    expect(priceLabel(demoProperties[0], "en", "USD", { THB: 1 })).toContain(
      "THB",
    );
    expect(
      priceLabel(demoProperties[0], "en", "USD", { THB: 1, USD: 0.03 }),
    ).toContain("$");
  });
});
