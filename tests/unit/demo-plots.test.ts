import { describe, it, expect } from "vitest";
import { demoProperties } from "../../src/lib/demo";

function computeRingArea(polygon: [number, number][]): number {
  const [lng0, lat0] = polygon[0];
  const pts = polygon.map(([lng, lat]) => [
    (lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180),
    (lat - lat0) * 110540,
  ]);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    sum += pts[i][0] * next[1] - next[0] * pts[i][1];
  }
  return Math.abs(sum) / 2;
}

function parseThaiAreaLabel(label: string): number {
  const match = label.replace("ไร่", "").trim();
  const parts = match.split("-").map((s) => Number.parseInt(s.trim(), 10) || 0);
  const rai = parts[0] ?? 0;
  const ngan = parts[1] ?? 0;
  const sqWa = parts[2] ?? 0;
  return rai * 1600 + ngan * 400 + sqWa * 4;
}

describe("demo land plots", () => {
  const landListings = demoProperties.filter(
    (p) => p.type === "land" && p.plots && p.plots.length > 0,
  );

  it("has expected number of plots for each land listing", () => {
    expect(landListings.length).toBeGreaterThan(0);
    landListings.forEach((listing) => {
      const isKaron = listing.title.en.includes("Karon");
      const expectedCount = isKaron ? 7 : 3;
      expect(listing.plots).toHaveLength(expectedCount);
    });
  });

  it("computes ring area within 0.5% of parsed label area for every plot", () => {
    expect(landListings.length).toBeGreaterThan(0);
    landListings.forEach((listing) => {
      if (!listing.plots) {
        throw new Error("Missing plots on land listing");
      }
      listing.plots.forEach((plot) => {
        const targetArea = parseThaiAreaLabel(plot.areaLabel.th);
        const computedArea = computeRingArea(plot.polygon);
        const diffPct = Math.abs(computedArea - targetArea) / targetArea;
        expect(diffPct).toBeLessThanOrEqual(0.005);
      });
    });
  });

  it("has pin strictly north-east of every plot vertex for Karon listing", () => {
    const karonListing = landListings.find((p) => p.title.en.includes("Karon"));
    expect(karonListing).toBeDefined();
    if (!karonListing || !karonListing.plots) {
      throw new Error("Missing Karon land listing with plots");
    }
    let maxPlotLat = -Infinity;
    let maxPlotLng = -Infinity;
    for (const plot of karonListing.plots) {
      for (const [lng, lat] of plot.polygon) {
        if (lat > maxPlotLat) maxPlotLat = lat;
        if (lng > maxPlotLng) maxPlotLng = lng;
      }
    }

    expect(karonListing.location.lat).toBeGreaterThan(maxPlotLat);
    expect(karonListing.location.lng).toBeGreaterThan(maxPlotLng);
  });
});
