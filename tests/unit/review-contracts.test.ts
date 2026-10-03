import { describe, it, expect } from "vitest";
import {
  normalizePlace,
  inquiryDelivery,
  normalizeInquiry,
  aggregateStats,
} from "../../src/lib/api";
import {
  validatePolygon,
  parsePolygonText,
  insidePolygon,
  filtersFromParams,
  filtersToParams,
  defaultFilters,
  filterProperties,
} from "../../src/lib/property";
import {
  parseImportRows,
  propertyToImportRow,
  exportCSV,
  parseCSV,
} from "../../src/lib/import";
import { demoProperties } from "../../src/lib/demo";
describe("reviewed live contracts", () => {
  it("normalizes the actual geocoder DTO and bilingual names", () => {
    expect(
      normalizePlace(
        {
          id: "phuket",
          name: "Phuket, Thailand",
          location: { lat: 7.94, lng: 98.33 },
        },
        "en",
      ),
    ).toEqual({
      id: "phuket",
      label: "Phuket, Thailand",
      lat: 7.94,
      lng: 98.33,
    });
    expect(
      normalizePlace(
        {
          id: "a",
          name: { en: "Phuket", th: "ภูเก็ต" },
          location: { lat: 7.94, lng: 98.33 },
        },
        "th",
      ).label,
    ).toBe("ภูเก็ต");
    expect(() =>
      normalizePlace(
        { id: "bad", name: "Bad", location: { lat: 99, lng: 98 } },
        "en",
      ),
    ).toThrow();
  });
  it("never reports sent for pending backend email states", () => {
    expect(inquiryDelivery({ emailStatus: "sent" })).toBe("sent");
    for (const emailStatus of ["pending", "failed", "sending"])
      expect(inquiryDelivery({ emailStatus })).toBe("pending_retry");
    expect(() => inquiryDelivery({ emailStatus: "unknown" })).toThrow(
      "unavailable",
    );
  });
  it("maps actual staff inquiry and daily statistics records", () => {
    const row = normalizeInquiry({
      id: "id",
      property_id: demoProperties[0].id,
      name: "A",
      email: "a@example.test",
      country: "Thai",
      message: "message",
      created_at: "2026-10-03T00:00:00Z",
      status: "contacted",
      email_status: "sent",
    });
    expect(row.propertyId).toBe(demoProperties[0].id);
    expect(row.createdAt).toContain("2026");
    expect(row.deliveryStatus).toBe("sent");
    expect(row.status).toBe("contacted");
    expect(
      aggregateStats([
        {
          day: "2026-10-03",
          property_id: "a",
          views: 2,
          inquiries: 1,
          contact_clicks: 3,
        },
        {
          day: "2026-10-04",
          property_id: "a",
          views: 4,
          inquiries: 2,
          contact_clicks: 1,
        },
      ]),
    ).toEqual({ views: 6, inquiries: 3, contact_clicks: 4 });
  });
  it("retains snake-case rights evidence and identifies each invalid import row", () => {
    const valid = {
      ...propertyToImportRow(demoProperties[0]),
      source_url: "https://source.test/property",
      license: "Authorized",
      rights_evidence: "Reviewed permission",
      ownership_evidence_url: "https://source.test/ownership",
      image_url: "https://source.test/image.jpg",
      image_source_url: "https://source.test/photo",
      image_license: "Authorized",
      image_rights_evidence_url: "https://source.test/image-rights",
    };
    const result = parseImportRows(
      parseCSV(
        exportCSV([valid, { ...valid, slug: "invalid", source_url: "" }]),
      ),
      { live: true },
    );
    expect(result.items).toHaveLength(1);
    expect(result.records[0].price_thb).toBe(String(valid.price_thb));
    expect(result.records[0].ownership_evidence_url).toBe(
      valid.ownership_evidence_url,
    );
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].message).toContain("source_url");
  });
});
describe("accessible bounded polygon", () => {
  const square: [number, number][] = [
    [98, 7],
    [99, 7],
    [99, 8],
    [98, 8],
  ];
  it("includes vertices and boundaries like ST_Covers", () => {
    expect(insidePolygon([98, 7.5], square)).toBe(true);
    expect(insidePolygon([98, 7], square)).toBe(true);
    expect(insidePolygon([97.9, 7.5], square)).toBe(false);
  });
  it("accepts keyboard coordinates and a closed ring", () => {
    expect(parsePolygonText("98,7\n99,7\n99,8\n98,8")).toEqual(square);
    expect(validatePolygon([...square, square[0]])).toEqual(square);
  });
  it("rejects crossings, degenerate, duplicate, and oversized areas", () => {
    expect(() =>
      validatePolygon([
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ]),
    ).toThrow("cross");
    expect(() =>
      validatePolygon([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toThrow("area");
    expect(() =>
      validatePolygon([
        [0, 0],
        [1, 0],
        [0, 0],
      ]),
    ).toThrow();
    expect(() =>
      validatePolygon(
        Array.from({ length: 51 }, (_, i) => [Math.cos(i), Math.sin(i)]),
      ),
    ).toThrow("50");
  });
});
describe("shareable filters", () => {
  it("round-trips all filter controls while preserving unrelated query state", () => {
    const f = {
      ...defaultFilters,
      q: "บางเทา",
      zone: "Bang Tao",
      amenities: "Pool,Gym",
      type: "villa",
      minPrice: "100",
      beds: "2",
      favoritesOnly: true,
      sort: "price_desc",
    };
    const params = filtersToParams(f, new URLSearchParams("perf=2000"));
    expect(filtersFromParams(params)).toEqual(f);
    expect(params.get("perf")).toBe("2000");
  });
  it("requires all selected amenities and the selected zone", () => {
    const p = demoProperties[0];
    const f = {
      ...defaultFilters,
      status: "",
      zone: p.zone,
      amenities: p.amenities.join(","),
    };
    const rows = filterProperties(demoProperties, f);
    expect(rows).toContain(p);
    expect(
      rows.every(
        (r) =>
          r.zone === p.zone &&
          p.amenities.every((a) => r.amenities.includes(a)),
      ),
    ).toBe(true);
  });
});
