import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { demoListings } from "../../src/lib/demo";
import {
  countByZone,
  zoneById,
  zoneIdFor,
  zoneLabel,
  zones,
} from "../../src/lib/zones";

describe("zone helpers", () => {
  it("resolves zones by id and by English name", () => {
    expect(zoneById("patong")?.en).toBe("Patong");
    expect(zoneById("missing")).toBeUndefined();
    expect(zoneById(null)).toBeUndefined();
    expect(zoneIdFor("Bang Tao")).toBe("bang-tao");
    expect(zoneIdFor("Unknown")).toBeUndefined();
  });

  it("labels zones in the active locale", () => {
    const patong = zoneById("patong");
    if (!patong) throw new Error("patong zone missing");
    expect(zoneLabel(patong, "en")).toBe("Patong");
    expect(zoneLabel(patong, "th")).toBe("ป่าตอง");
  });

  it("counts listings per zone id and ignores unknown zones", () => {
    const counts = countByZone([
      { zone: "Patong" },
      { zone: "Patong" },
      { zone: "Rawai" },
      { zone: "Nowhere" },
    ]);
    expect(counts).toEqual({ patong: 2, rawai: 1 });
  });

  it("keeps the map outline ids in step with the zone list", () => {
    const geojson = JSON.parse(
      readFileSync("public/data/phuket-zones.geojson", "utf8"),
    ) as { features: { properties: { id: string } }[] };
    const outlineIds = geojson.features.map((f) => f.properties.id).sort();
    expect(outlineIds).toEqual(zones.map((z) => z.id).sort());
  });

  it("gives every demo listing a zone that exists on the map", () => {
    for (const listing of demoListings) {
      expect(zoneIdFor(listing.zone)).toBeDefined();
    }
  });
});
