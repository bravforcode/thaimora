import { describe, it, expect } from "vitest";
import { demoListings } from "../../src/lib/demo";
import {
  readPublished,
  toHomeListing,
  type PublishedListing,
} from "../../src/lib/published";
import { countByZone, zoneAnchor } from "../../src/lib/zones";

const row: PublishedListing = {
  id: "pub-1",
  title: "Sea-view villa",
  zone: "Patong",
  type: "villa",
  transaction: "sale",
  priceTHB: 9000000,
  beds: 3,
  baths: 2,
  areaM2: 180,
  agent: "Test Agent",
  publishedAt: "2026-10-27T00:00:00.000Z",
};

describe("published agent listings", () => {
  it("keeps only well-formed rows on a zone the map shows", () => {
    const rows = readPublished([
      row,
      { ...row, id: "pub-2", zone: "Nowhere" },
      { ...row, id: "pub-3", priceTHB: -1 },
      "garbage",
    ]);
    expect(rows.map((r) => r.id)).toEqual(["pub-1"]);
    expect(readPublished(null)).toEqual([]);
  });

  it("turns a published row into an agent listing in its zone", () => {
    const listing = toHomeListing(row, 0);
    expect(listing.published).toBe(true);
    expect(listing.zone).toBe("Patong");
    expect(listing.channel).toEqual({
      kind: "agent",
      name: "Test Agent",
      agency: "",
    });
    expect(listing.location.accuracy).toBe("approximate");
    const [anchorLng, anchorLat] = zoneAnchor("patong");
    expect(Math.abs(listing.location.lat - anchorLat)).toBeLessThan(0.01);
    expect(Math.abs(listing.location.lng - anchorLng)).toBeLessThan(0.01);
  });

  it("spreads pins in one zone so they do not stack", () => {
    const first = toHomeListing(row, 0);
    const second = toHomeListing({ ...row, id: "pub-2" }, 1);
    expect([second.location.lat, second.location.lng]).not.toEqual([
      first.location.lat,
      first.location.lng,
    ]);
  });

  it("counts published listings in the zone totals", () => {
    const merged = [...demoListings, ...readPublished([row])];
    const before = countByZone(demoListings).patong ?? 0;
    expect(countByZone(merged).patong).toBe(before + 1);
  });
});
