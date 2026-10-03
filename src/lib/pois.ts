import { z } from "zod";
import { api, liveMode } from "./api";
export type POI = {
  id: string;
  name: { en: string; th: string };
  category: string;
  lat: number;
  lng: number;
  sourceUrl?: string;
  distanceMeters?: number;
  sourceId?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  fetchedAt?: string;
  sourceUpdatedAt?: string;
};
const point = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), th: z.string() }),
  category: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  sourceUrl: z.string().optional(),
  distanceMeters: z.number().optional(),
  sourceId: z.string().optional(),
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
  attribution: z.string().optional(),
  fetchedAt: z.string().optional(),
  sourceUpdatedAt: z.string().optional(),
});
type RawPOI = {
  id: string;
  name: { en: string; th: string };
  category: string;
  lat?: number;
  lng?: number;
  location?: { lat: number; lng: number };
  sourceUrl?: string;
  source_url?: string;
  distanceMeters?: number;
  distance_m?: number;
  distance_meters?: number;
  sourceId?: string;
  source_id?: string;
  license?: string;
  licenseUrl?: string;
  license_url?: string;
  attribution?: string;
  fetchedAt?: string;
  fetched_at?: string;
  sourceUpdatedAt?: string;
  source_updated_at?: string;
};
export function normalizePOI(p: RawPOI): POI {
  return point.parse({
    ...p,
    lat: p.lat ?? p.location?.lat,
    lng: p.lng ?? p.location?.lng,
    sourceUrl: p.sourceUrl ?? p.source_url ?? undefined,
    distanceMeters:
      p.distanceMeters ?? p.distance_meters ?? p.distance_m ?? undefined,
    sourceId: p.sourceId ?? p.source_id ?? undefined,
    license: p.license ?? undefined,
    licenseUrl: p.licenseUrl ?? p.license_url ?? undefined,
    attribution: p.attribution ?? undefined,
    fetchedAt: p.fetchedAt ?? p.fetched_at ?? undefined,
    sourceUpdatedAt: p.sourceUpdatedAt ?? p.source_updated_at ?? undefined,
  });
}
export async function previewPOIs() {
  const response = await fetch("/data/phuket-pois.json");
  if (!response.ok) throw new Error("Local place data is unavailable.");
  const rows = (await response.json()) as RawPOI[];
  if (!Array.isArray(rows)) throw new Error("Local place data is invalid.");
  return rows.map(normalizePOI);
}
export async function mapPOIs() {
  if (!liveMode) return previewPOIs();
  const result = await api<{ pois: RawPOI[] }>("/v1/content");
  return result.pois.map(normalizePOI);
}
export async function nearbyPOIs(id: string) {
  const result = await api<{ items: RawPOI[] }>(`/v1/properties/${id}/nearby`);
  return result.items.map(normalizePOI);
}
export type LocalEvent = {
  id: string;
  title: { en: string; th: string };
  date: string;
  sourceUrl?: string;
  sourceId?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  fetchedAt?: string;
  sourceUpdatedAt?: string;
};
export async function localContent() {
  if (!liveMode)
    return { pois: await previewPOIs(), events: [] as LocalEvent[] };
  const result = await api<{
    pois: RawPOI[];
    events: {
      id: string;
      title?: { en: string; th: string };
      name?: { en: string; th: string };
      date?: string;
      startsAt?: string;
      sourceUrl?: string;
      source_url?: string;
      sourceId?: string;
      source_id?: string;
      license?: string;
      licenseUrl?: string;
      license_url?: string;
      attribution?: string;
      fetchedAt?: string;
      fetched_at?: string;
      sourceUpdatedAt?: string;
      source_updated_at?: string;
    }[];
  }>("/v1/content");
  return {
    pois: result.pois.map(normalizePOI),
    events: result.events
      .filter((e) => (e.title || e.name) && (e.date || e.startsAt))
      .map((e) => ({
        id: e.id,
        title: (e.title || e.name)!,
        date: (e.date || e.startsAt)!,
        sourceUrl: e.sourceUrl ?? e.source_url,
        sourceId: e.sourceId ?? e.source_id,
        license: e.license,
        licenseUrl: e.licenseUrl ?? e.license_url,
        attribution: e.attribution,
        fetchedAt: e.fetchedAt ?? e.fetched_at,
        sourceUpdatedAt: e.sourceUpdatedAt ?? e.source_updated_at,
      })),
  };
}
