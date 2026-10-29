import type { Locale, PublicProperty } from "./property";

export type Zone = {
  id: string;
  en: string;
  th: string;
  center: [number, number];
};

// Label anchors for the Phuket zone map. Polygons come from
// public/data/phuket-zones.geojson (OpenStreetMap, ODbL).
export const zones: readonly Zone[] = [
  { id: "mai-khao", en: "Mai Khao", th: "ไม้ขาว", center: [98.29, 8.12] },
  { id: "bang-tao", en: "Bang Tao", th: "บางเทา", center: [98.293, 8.004] },
  {
    id: "cherng-talay",
    en: "Cherng Talay",
    th: "เชิงทะเล",
    center: [98.302, 7.965],
  },
  { id: "patong", en: "Patong", th: "ป่าตอง", center: [98.296, 7.896] },
  { id: "karon", en: "Karon", th: "กะรน", center: [98.298, 7.845] },
  { id: "kata", en: "Kata", th: "กะตะ", center: [98.2955, 7.815] },
  { id: "chalong", en: "Chalong", th: "ฉลอง", center: [98.34, 7.845] },
  { id: "rawai", en: "Rawai", th: "ราไวย์", center: [98.325, 7.78] },
];

export const phuketCenter: [number, number] = [98.33, 7.93];

export function zoneById(id: string | null | undefined) {
  return zones.find((z) => z.id === id);
}

// Anchors are interior points of public/data/phuket-zones.geojson polygons.
const zoneAnchors: Record<string, [number, number]> = {
  "mai-khao": [98.3213, 8.1364],
  "bang-tao": [98.3066, 8.0029],
  "cherng-talay": [98.3024, 7.9752],
  "patong": [98.305, 7.8862],
  "karon": [98.3047, 7.8415],
  "kata": [98.3077, 7.8193],
  "chalong": [98.3367, 7.8444],
  "rawai": [98.3168, 7.7881],
};

export function zoneAnchor(id: string): [number, number] {
  return zoneAnchors[id] ?? zoneById(id)?.center ?? phuketCenter;
}

export function zoneIdFor(zoneName: string) {
  return zones.find((z) => z.en === zoneName)?.id;
}

export function zoneLabel(zone: Zone, locale: Locale) {
  return locale === "th" ? zone.th : zone.en;
}

export function countByZone(properties: readonly Pick<PublicProperty, "zone">[]) {
  const counts: Record<string, number> = {};
  for (const p of properties) {
    const id = zoneIdFor(p.zone);
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
