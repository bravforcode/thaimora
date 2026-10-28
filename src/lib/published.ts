import { useEffect, useState } from "react";
import { z } from "zod";
import { illustrativeImages } from "./demo";
import { type HomeListing } from "./listings";
import { readStore, writeStore } from "./store";
import { phuketCenter, zoneById, zoneIdFor } from "./zones";

export const PUBLISHED_KEY = "phuketlens.demo.published";

const countField = z.number().int().min(0).max(50);

const publishedSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  zone: z.string().refine((zone) => zoneIdFor(zone) !== undefined, {
    message: "Zone must be one shown on the map.",
  }),
  type: z.enum(["condo", "house", "villa", "land", "townhouse"]),
  transaction: z.enum(["sale", "rent"]),
  priceTHB: z.number().positive().max(1e12),
  beds: countField,
  baths: countField,
  areaM2: z.number().min(0).max(100000),
  agent: z.string().max(80),
  publishedAt: z.iso.datetime(),
});

export type PublishedListing = z.infer<typeof publishedSchema>;
export type PublishInput = Omit<PublishedListing, "id" | "publishedAt">;

// Rows are checked one by one, so one damaged row cannot hide the others.
export function readPublished(raw: unknown): PublishedListing[] {
  const rows = z.array(z.unknown()).catch([]).parse(raw);
  return rows.flatMap((row) => {
    const parsed = publishedSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

// Pins in one zone sit on a small golden-angle spiral so they do not stack.
export function toHomeListing(p: PublishedListing, index: number): HomeListing {
  const [lng, lat] = zoneById(zoneIdFor(p.zone))?.center ?? phuketCenter;
  const angle = index * 2.39996;
  const radius = 0.0015 * Math.sqrt(index + 1);
  return {
    id: p.id,
    slug: p.id,
    title: { en: p.title, th: p.title },
    description: {
      en: "Posted by an agent in this preview. Not a verified listing.",
      th: "ประกาศโดยนายหน้าในตัวอย่างนี้ ยังไม่ได้ตรวจสอบ",
    },
    transaction: p.transaction,
    type: p.type,
    priceTHB: p.priceTHB,
    areaM2: p.areaM2,
    landAreaM2: p.type === "land" ? p.areaM2 : null,
    beds: p.beds,
    baths: p.baths,
    floor: null,
    builtYear: null,
    ownership: "unknown",
    furnishing: "unfurnished",
    status: "available",
    location: {
      lat: Number((lat + Math.sin(angle) * radius).toFixed(4)),
      lng: Number((lng + Math.cos(angle) * radius).toFixed(4)),
      accuracy: "approximate",
      radiusMeters: 300,
    },
    zone: p.zone,
    province: "Phuket",
    images: illustrativeImages,
    amenities: [],
    updatedAt: p.publishedAt,
    expiresAt: null,
    channel: { kind: "agent", name: p.agent, agency: "" },
    published: true,
  };
}

export function usePublished() {
  const [items, setItems] = useState<PublishedListing[]>([]);
  useEffect(() => {
    setItems(readPublished(readStore<unknown>(PUBLISHED_KEY, [])));
  }, []);
  const publish = (input: PublishInput) => {
    const next: PublishedListing[] = [
      ...items,
      {
        ...input,
        id: `pub-${Date.now()}-${items.length}`,
        publishedAt: new Date().toISOString(),
      },
    ];
    setItems(next);
    writeStore(PUBLISHED_KEY, next);
  };
  return { items, publish };
}
