import { describe, it, expect } from "vitest";
import { savedPropertyIds, propertySchema } from "../../src/lib/property";
import { demoProperties } from "../../src/lib/demo";
import {
  parseImportRows,
  propertyToImportRow,
  exportCSV,
  parseCSV,
  applyPreviewImport,
} from "../../src/lib/import";
import { normalizePOI } from "../../src/lib/pois";
describe("safe saved state", () => {
  it("rejects corrupt objects and null and retains unique valid string IDs", () => {
    const id = demoProperties[0].id;
    expect(savedPropertyIds(null)).toEqual([]);
    expect(savedPropertyIds({ id })).toEqual([]);
    expect(savedPropertyIds([id, id, null, {}, 5, "invalid"])).toEqual([id]);
  });
});
describe("partial imports and duplicate policies", () => {
  it("preserves existing expiry and optional fields when duplicate update cells are absent or blank", () => {
    const original = {
      ...demoProperties[0],
      expiresAt: "2030-01-01T00:00:00Z",
      status: "sold" as const,
      floor: 5,
      builtYear: 2020,
      landAreaM2: 100,
      amenities: ["Pool"],
    };
    const incoming = {
      ...original,
      expiresAt: null,
      status: "available" as const,
      floor: null,
      builtYear: null,
      landAreaM2: null,
      amenities: [],
    };
    const result = applyPreviewImport([original], [incoming], [2], "update", [
      { expires_at: "", floor: "" },
    ]);
    expect(result.items[0]).toMatchObject({
      expiresAt: original.expiresAt,
      status: "sold",
      floor: 5,
      builtYear: 2020,
      landAreaM2: 100,
      amenities: ["Pool"],
    });
    const next = { ...incoming, expiresAt: "2031-01-01T00:00:00Z" };
    expect(
      applyPreviewImport([original], [next], [2], "update", [
        { expires_at: next.expiresAt },
      ]).items[0].expiresAt,
    ).toBe(next.expiresAt);
  });
  it("keeps valid rows and maps them to original rows around errors", () => {
    const row = propertyToImportRow(demoProperties[0]);
    const result = parseImportRows(
      parseCSV(
        exportCSV([
          row,
          { ...row, id: "invalid-id" },
          { ...row, id: demoProperties[1].id, slug: "other-row" },
        ]),
      ),
    );
    expect(result.items).toHaveLength(2);
    expect(result.records).toHaveLength(2);
    expect(result.rowNumbers).toEqual([2, 4]);
    expect(result.errors[0].row).toBe(3);
  });
  it("accepts canonical rights evidence URL aliases without dropping them", () => {
    const row = {
      ...propertyToImportRow(demoProperties[0]),
      source_url: "https://source.test/property",
      license: "Approved",
      rights_evidence: "",
      rights_evidence_url: "https://source.test/rights",
      ownership_evidence_url: "https://source.test/ownership",
      image_url: "https://source.test/image.jpg",
      image_source_url: "https://source.test/image",
      image_license: "Approved",
      image_rights_evidence_url: "https://source.test/image-rights",
    };
    const result = parseImportRows(parseCSV(exportCSV([row])), { live: true });
    expect(result.errors).toEqual([]);
    expect(result.records[0].rights_evidence).toBe(row.rights_evidence_url);
    expect(result.records[0].rights_evidence_url).toBe(row.rights_evidence_url);
  });
  it("skips duplicates while still importing distinct valid rows", () => {
    const original = demoProperties[0],
      incoming = { ...original, title: { en: "Changed", th: "เปลี่ยน" } },
      other = demoProperties[1];
    const result = applyPreviewImport(
      [original],
      [incoming, other],
      [2, 4],
      "skip",
    );
    expect(result.written).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.items.find((p) => p.id === original.id)?.title).toEqual(
      original.title,
    );
  });
  it("updates a slug match using the existing stable ID", () => {
    const original = demoProperties[0],
      incoming = {
        ...original,
        id: demoProperties[1].id,
        title: { en: "Updated", th: "อัปเดต" },
      };
    const result = applyPreviewImport([original], [incoming], [4], "update");
    expect(result.written).toBe(1);
    expect(result.items[0].id).toBe(original.id);
    expect(result.items[0].title.en).toBe("Updated");
  });
  it("reports duplicate row errors while importing other rows", () => {
    const original = demoProperties[0];
    const result = applyPreviewImport(
      [original],
      [original, demoProperties[1]],
      [2, 4],
      "error",
    );
    expect(result.written).toBe(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.items).toHaveLength(2);
  });
});
describe("public source metadata", () => {
  it("normalizes actual distance_meters and keeps source fields including zero distance", () => {
    const poi = normalizePOI({
      id: "poi",
      name: { en: "Beach", th: "หาด" },
      category: "Beach",
      location: { lat: 7.94, lng: 98.33 },
      distance_meters: 0,
      source_url: "https://source.test/place",
      source_id: "osm:node:1",
      license: "ODbL 1.0",
      license_url: "https://source.test/license",
      fetched_at: "2026-10-03T00:00:00Z",
      source_updated_at: "2026-10-02T00:00:00Z",
    });
    expect(poi).toMatchObject({
      distanceMeters: 0,
      sourceUrl: "https://source.test/place",
      sourceId: "osm:node:1",
      license: "ODbL 1.0",
      fetchedAt: "2026-10-03T00:00:00Z",
      sourceUpdatedAt: "2026-10-02T00:00:00Z",
    });
  });
  it("retains public property provenance while treating nullable metadata as absent", () => {
    const property = propertySchema.parse({
      ...demoProperties[0],
      sourceUrl: "https://source.test/listing",
      sourceId: "licensed:1",
      license: "Authorized",
      fetchedAt: "2026-10-03T00:00:00Z",
      sourceUpdatedAt: null,
    });
    expect(property.sourceUrl).toBe("https://source.test/listing");
    expect(property.fetchedAt).toContain("2026");
    expect(property.sourceUpdatedAt).toBeUndefined();
  });
});
