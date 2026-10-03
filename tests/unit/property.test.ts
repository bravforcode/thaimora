import { describe, it, expect } from "vitest";
import { demoProperties } from "../../src/lib/demo";
import {
  defaultFilters,
  filterProperties,
  publicSnapshot,
  toggleCompare,
  inquirySchema,
  insidePolygon,
} from "../../src/lib/property";
import {
  parseCSV,
  parseImportRows,
  propertyToImportRow,
  exportCSV,
} from "../../src/lib/import";
describe("public catalog privacy", () => {
  it("has exactly 30 synthetic IDs and public-safe approximate locations", () => {
    expect(demoProperties).toHaveLength(30);
    expect(new Set(demoProperties.map((p) => p.id)).size).toBe(30);
    demoProperties.forEach((p) =>
      expect(publicSnapshot(p).location.accuracy).toBe("approximate"),
    );
  });
  it("rejects consented exact coordinates in static output", () => {
    expect(() =>
      publicSnapshot({
        ...demoProperties[0],
        location: {
          ...demoProperties[0].location,
          accuracy: "exact",
          radiusMeters: 0,
        },
      }),
    ).toThrow("Exact coordinates");
  });
  it("rejects tiny approximate circles", () => {
    expect(() =>
      publicSnapshot({
        ...demoProperties[0],
        location: { ...demoProperties[0].location, radiusMeters: 30 },
      }),
    ).toThrow("300m");
  });
});
describe("discovery filters", () => {
  it("combines transaction, type, price, ownership and status", () => {
    const rows = filterProperties(demoProperties, {
      ...defaultFilters,
      type: "condo",
      transaction: "rent",
      maxPrice: "130000",
      ownership: "freehold",
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        (p) =>
          p.type === "condo" &&
          p.transaction === "rent" &&
          p.priceTHB <= 130000 &&
          p.ownership === "freehold" &&
          p.status === "available",
      ),
    ).toBe(true);
  });
  it("supports Thai search and local favorites", () => {
    const p = demoProperties[0];
    expect(
      filterProperties(
        demoProperties,
        { ...defaultFilters, q: "วิลล่า", favoritesOnly: true },
        [p.id],
      ),
    ).toEqual([p]);
  });
  it("bounds and polygon reject outside points and price sort is consistent", () => {
    const polygon: [number, number][] = [
      [98.29, 7.98],
      [98.32, 7.98],
      [98.32, 8.03],
      [98.29, 8.03],
    ];
    const rows = filterProperties(
      demoProperties,
      { ...defaultFilters, sort: "price_asc" },
      [],
      [98.29, 7.98, 98.32, 8.03],
      polygon,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((p) =>
        insidePolygon([p.location.lng, p.location.lat], polygon),
      ),
    ).toBe(true);
    expect(rows.map((p) => p.priceTHB)).toEqual(
      rows.map((p) => p.priceTHB).sort((a, b) => a - b),
    );
  });
});
describe("comparison and inquiry", () => {
  it("caps comparison at three and toggles existing selections", () => {
    expect(toggleCompare(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(toggleCompare(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
  it("requires valid contact details, property UUID, message and explicit privacy consent", () => {
    const values = {
      name: "Jane Doe",
      email: "jane@example.com",
      country: "UK",
      message: "Please send more information.",
      propertyId: demoProperties[0].id,
      consent: true,
    };
    expect(inquirySchema.safeParse(values).success).toBe(true);
    for (const bad of [
      { email: "invalid" },
      { message: "Hi" },
      { consent: false },
      { propertyId: "not-an-id" },
    ])
      expect(inquirySchema.safeParse({ ...values, ...bad }).success).toBe(
        false,
      );
  });
});
describe("staff import/export", () => {
  it("handles quoted CSV including comma and multiline cells", () => {
    expect(
      parseCSV('title,note\r\n"Home, Phuket","line one\nline two"'),
    ).toEqual([
      ["title", "note"],
      ["Home, Phuket", "line one\nline two"],
    ]);
  });
  it("reports row errors and rejects exact location imports", () => {
    const p = propertyToImportRow(demoProperties[0]);
    const keys = Object.keys(p);
    const first = Object.values(p);
    const second = {
      ...p,
      id: demoProperties[1].id,
      accuracy: "exact",
      radiusMeters: 0,
    };
    const result = parseImportRows([
      keys,
      first,
      keys.map((k) => second[k as keyof typeof second]),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].message).toContain("Exact coordinates");
  });
  it("neutralizes formula injection in CSV downloads", () => {
    expect(exportCSV([{ name: '=HYPERLINK("bad")' }])).toContain("'=HYPERLINK");
  });
  it("roundtrips public catalog template", () => {
    const result = parseImportRows(
      parseCSV(exportCSV([propertyToImportRow(demoProperties[0])])),
    );
    expect(result.errors).toEqual([]);
    expect(result.items[0].id).toBe(demoProperties[0].id);
  });
});
