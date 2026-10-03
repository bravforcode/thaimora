import type { PublicProperty } from "./property";
export function markerFixtures(
  base: PublicProperty[],
  count = 2000,
): PublicProperty[] {
  if (!base.length) return [];
  return Array.from({ length: count }, (_, i) => ({
    ...base[i % base.length],
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    slug: `synthetic-marker-${i + 1}`,
    title: { en: `Synthetic marker ${i + 1}`, th: `หมุดจำลอง ${i + 1}` },
    status: "available",
    location: {
      lat: 7.77 + (i % 50) * 0.006,
      lng: 98.27 + Math.floor(i / 50) * 0.003,
      accuracy: "approximate",
      radiusMeters: 300,
    },
  }));
}
