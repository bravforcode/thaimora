import {
  propertySchema,
  type Filters,
  type PublicProperty,
  type Bounds,
  type Point,
  type Locale,
  type Inquiry,
} from "./property";
export const liveMode = process.env.NEXT_PUBLIC_DATA_MODE === "live";
const base = process.env.NEXT_PUBLIC_API_URL || "https://hpjmttoxomdhxxsourih.supabase.co/functions/v1/api";
export type SearchScope = {
  bounds?: Bounds;
  polygon?: Point[];
  center?: Point;
};
export async function api<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  if (!base) throw new Error("Live API is not configured.");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message ??
        body?.message ??
        `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.json();
}
export function propertyQuery(f: Filters, scope: SearchScope = {}) {
  const query = new URLSearchParams({ limit: "50" });
  Object.entries(f).forEach(([key, value]) => {
    if (key !== "favoritesOnly" && value !== "" && value !== false)
      query.set(key, String(value));
  });
  if (scope.bounds) query.set("bbox", scope.bounds.join(","));
  if (scope.polygon && scope.polygon.length >= 3)
    query.set(
      "polygon",
      JSON.stringify({
        type: "Polygon",
        coordinates: [[...scope.polygon, scope.polygon[0]]],
      }),
    );
  if (scope.center) query.set("center", scope.center.join(","));
  return query;
}
export async function getProperties(
  f: Filters,
  signal?: AbortSignal,
  scope: SearchScope = {},
): Promise<PublicProperty[]> {
  const query = propertyQuery(f, scope),
    items: PublicProperty[] = [],
    seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    if (cursor) query.set("cursor", cursor);
    const result = await api<{
      items: unknown[];
      total?: number;
      nextCursor?: string | null;
    }>(`/v1/properties?${query}`, { signal });
    if (!Array.isArray(result.items))
      throw new Error("The listing response is invalid.");
    items.push(...result.items.map((p) => propertySchema.parse(p)));
    if (!result.nextCursor) {
      if (result.total !== undefined && items.length < result.total)
        throw new Error(
          "The catalog response ended early. Please retry search.",
        );
      return [...new Map(items.map((p) => [p.id, p])).values()];
    }
    if (seen.has(result.nextCursor))
      throw new Error("The listing cursor repeated. Please retry search.");
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error(
    "Search exceeded the supported page count. Narrow the search area.",
  );
}
export async function getProperty(id: string) {
  const result = await api<unknown>(`/v1/properties/${id}`);
  return propertySchema.parse(
    result && typeof result === "object" && "property" in result
      ? (result as { property: unknown }).property
      : result,
  );
}
export type Place = { id: string; label: string; lat: number; lng: number };
export function normalizePlace(value: unknown, locale: Locale): Place {
  const p = value as {
    id?: unknown;
    label?: unknown;
    name?: unknown;
    lat?: unknown;
    lng?: unknown;
    location?: { lat?: unknown; lng?: unknown };
  };
  const name = p.name;
  const label =
    typeof p.label === "string"
      ? p.label
      : typeof name === "string"
        ? name
        : name && typeof name === "object"
          ? (name as Record<string, unknown>)[locale]
          : undefined;
  const lat = Number(p.location?.lat ?? p.lat),
    lng = Number(p.location?.lng ?? p.lng);
  if (
    typeof p.id !== "string" ||
    typeof label !== "string" ||
    !label ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new Error("The place response is invalid.");
  return { id: p.id, label, lat, lng };
}
export function inquiryDelivery(value: {
  emailStatus?: string;
  deliveryStatus?: string;
}): "sent" | "pending_retry" {
  const status = value.emailStatus ?? value.deliveryStatus;
  if (status === "sent") return "sent";
  if (["pending", "sending", "failed", "pending_retry"].includes(status ?? ""))
    return "pending_retry";
  throw new Error(
    "The inquiry was recorded, but its delivery status is unavailable. Please contact the team before submitting again.",
  );
}
export type AdminInquiry = Inquiry & {
  status?: "new" | "contacted" | "closed";
};
export function normalizeInquiry(value: Record<string, unknown>): AdminInquiry {
  return {
    id: String(value.id),
    propertyId: String(value.property_id ?? value.propertyId),
    name: String(value.name ?? ""),
    email: String(value.email ?? ""),
    country: String(value.country ?? ""),
    message: String(value.message ?? ""),
    consent: true,
    createdAt: String(value.created_at ?? value.createdAt),
    deliveryStatus:
      value.deliveryStatus === "local_preview"
        ? "local_preview"
        : value.email_status === "sent" || value.deliveryStatus === "sent"
          ? "sent"
          : "pending_retry",
    status: value.status as AdminInquiry["status"],
  };
}
export type DailyStats = {
  day: string;
  property_id: string | null;
  views: number;
  inquiries: number;
  contact_clicks: number;
};
export function aggregateStats(rows: DailyStats[]) {
  return rows.reduce(
    (sum, row) => ({
      views: sum.views + Number(row.views || 0),
      inquiries: sum.inquiries + Number(row.inquiries || 0),
      contact_clicks: sum.contact_clicks + Number(row.contact_clicks || 0),
    }),
    { views: 0, inquiries: 0, contact_clicks: 0 },
  );
}
export async function recordMeasurement(
  propertyId: string,
  event: "view" | "contact_click",
  consent: boolean,
) {
  if (!liveMode || !consent) return;
  await api("/v1/analytics/events", {
    method: "POST",
    body: JSON.stringify({ propertyId, kind: event, consented: true }),
  });
}
