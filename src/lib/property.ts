import { z } from "zod";
export const localizedSchema = z.object({
  en: z.string().min(1),
  th: z.string().min(1),
});
export const plotSchema = z.object({
  no: z.number().int().positive(),
  status: z.enum(["available", "sold"]),
  areaLabel: localizedSchema,
  polygon: z
    .array(
      z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ]),
    )
    .min(3),
});
export type PropertyPlot = z.infer<typeof plotSchema>;
export const propertySchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: localizedSchema,
  description: localizedSchema,
  transaction: z.enum(["sale", "rent"]),
  type: z.enum(["condo", "house", "villa", "land", "townhouse"]),
  priceTHB: z.number().positive(),
  areaM2: z.number().nonnegative(),
  landAreaM2: z.number().nonnegative().nullable(),
  beds: z.number().int().nonnegative(),
  baths: z.number().int().nonnegative(),
  floor: z.number().int().nullable(),
  builtYear: z.number().int().nullable(),
  ownership: z.enum(["freehold", "leasehold", "unknown"]),
  furnishing: z.enum(["furnished", "partly_furnished", "unfurnished"]),
  status: z.enum(["available", "sold", "rented"]),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.enum(["exact", "approximate"]),
    radiusMeters: z.number().nonnegative(),
  }),
  zone: z.string(),
  province: z.string(),
  images: z.array(
    z.object({
      url: z.string(),
      alt: localizedSchema,
      credit: z.string().optional(),
      sourceUrl: z.string().optional(),
    }),
  ),
  amenities: z.array(z.string()),
  updatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  sourceUrl: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  sourceId: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  license: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  fetchedAt: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  sourceUpdatedAt: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  plots: z.array(plotSchema).optional(),
});
export function savedPropertyIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                id,
              ),
          ),
        ),
      ]
    : [];
}
export type PublicProperty = z.infer<typeof propertySchema>;
export type Locale = "en" | "th";
export type Filters = {
  q: string;
  transaction: string;
  type: string;
  minPrice: string;
  maxPrice: string;
  beds: string;
  baths: string;
  minArea: string;
  maxArea: string;
  ownership: string;
  furnishing: string;
  status: string;
  zone: string;
  amenities: string;
  sort: string;
  favoritesOnly: boolean;
};
export const defaultFilters: Filters = {
  q: "",
  transaction: "",
  type: "",
  minPrice: "",
  maxPrice: "",
  beds: "",
  baths: "",
  minArea: "",
  maxArea: "",
  ownership: "",
  furnishing: "",
  status: "available",
  zone: "",
  amenities: "",
  sort: "relevance",
  favoritesOnly: false,
};
export type Bounds = [number, number, number, number];
export type Point = [number, number];
export function insidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = point,
      [xi, yi] = polygon[i],
      [xj, yj] = polygon[j];
    if (pointOnSegment(point, [xi, yi], [xj, yj])) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function pointOnSegment(p: Point, a: Point, b: Point) {
  return (
    Math.abs(cross(a, b, p)) < 1e-10 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-10 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-10 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-10
  );
}
export function validatePolygon(input: Point[]): Point[] {
  const points = input.map((p) => [...p] as Point);
  if (
    points.length > 1 &&
    points[0][0] === points.at(-1)![0] &&
    points[0][1] === points.at(-1)![1]
  )
    points.pop();
  if (points.length < 3 || points.length > 50)
    throw new Error("Use 3 to 50 vertices for the search area.");
  if (
    points.some(
      ([lng, lat]) =>
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        Math.abs(lng) > 180 ||
        Math.abs(lat) > 90,
    )
  )
    throw new Error("Enter valid longitude, latitude coordinates.");
  if (new Set(points.map((p) => p.join(","))).size !== points.length)
    throw new Error("Each vertex must be different.");
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      if (
        (cross(a, b, c) * cross(a, b, d) < 0 &&
          cross(c, d, a) * cross(c, d, b) < 0) ||
        pointOnSegment(c, a, b) ||
        pointOnSegment(d, a, b) ||
        pointOnSegment(a, c, d) ||
        pointOnSegment(b, c, d)
      )
        throw new Error("Search area edges must not cross or touch.");
    }
  }
  const area = points.reduce(
    (sum, p, i) =>
      sum +
      p[0] * points[(i + 1) % points.length][1] -
      points[(i + 1) % points.length][0] * p[1],
    0,
  );
  if (Math.abs(area) < 1e-10)
    throw new Error("The search area must enclose an area.");
  return points;
}
export function parsePolygonText(text: string) {
  return validatePolygon(
    text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const values = line.split(",").map((v) => Number(v.trim()));
        if (values.length !== 2 || line.split(",").some((v) => !v.trim()))
          throw new Error("Use one longitude, latitude pair per line.");
        return values as Point;
      }),
  );
}
export function filtersFromParams(params: URLSearchParams): Filters {
  const result = { ...defaultFilters };
  for (const key of Object.keys(defaultFilters) as (keyof Filters)[]) {
    if (key === "favoritesOnly")
      result.favoritesOnly = params.get("favorites") === "1";
    else if (params.has(key))
      result[key] = params.get(key) ?? defaultFilters[key];
  }
  return result;
}
export function filtersToParams(
  filters: Filters,
  params = new URLSearchParams(),
) {
  for (const key of Object.keys(defaultFilters) as (keyof Filters)[]) {
    const name = key === "favoritesOnly" ? "favorites" : key;
    if (filters[key] === defaultFilters[key]) params.delete(name);
    else params.set(name, key === "favoritesOnly" ? "1" : String(filters[key]));
  }
  return params;
}
export function distanceKm(a: Point, b: Point) {
  const r = Math.PI / 180,
    dLat = (b[1] - a[1]) * r,
    dLng = (b[0] - a[0]) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function filterProperties(
  properties: PublicProperty[],
  f: Filters,
  favorites: string[] = [],
  bounds?: Bounds,
  polygon: Point[] = [],
  center: Point = [98.33, 7.94],
) {
  const q = f.q.trim().toLocaleLowerCase();
  const rows = properties.filter((p) => {
    const v = p.location;
    return (
      (!q ||
        [p.title.en, p.title.th, p.zone, p.province, ...p.amenities]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q)) &&
      (!f.transaction || p.transaction === f.transaction) &&
      (!f.type || p.type === f.type) &&
      (!f.status || p.status === f.status) &&
      (!f.ownership || p.ownership === f.ownership) &&
      (!f.furnishing || p.furnishing === f.furnishing) &&
      (!f.zone || p.zone === f.zone) &&
      (!f.amenities ||
        f.amenities
          .split(",")
          .filter(Boolean)
          .every((a) => p.amenities.includes(a))) &&
      (!f.minPrice || p.priceTHB >= Number(f.minPrice)) &&
      (!f.maxPrice || p.priceTHB <= Number(f.maxPrice)) &&
      (!f.beds || p.beds >= Number(f.beds)) &&
      (!f.baths || p.baths >= Number(f.baths)) &&
      (!f.minArea || p.areaM2 >= Number(f.minArea)) &&
      (!f.maxArea || p.areaM2 <= Number(f.maxArea)) &&
      (!f.favoritesOnly || favorites.includes(p.id)) &&
      (!bounds ||
        (v.lng >= bounds[0] &&
          v.lat >= bounds[1] &&
          v.lng <= bounds[2] &&
          v.lat <= bounds[3])) &&
      (polygon.length < 3 || insidePolygon([v.lng, v.lat], polygon))
    );
  });
  return rows.sort((a, b) =>
    f.sort === "price_asc"
      ? a.priceTHB - b.priceTHB
      : f.sort === "price_desc"
        ? b.priceTHB - a.priceTHB
        : f.sort === "newest"
          ? b.updatedAt.localeCompare(a.updatedAt)
          : f.sort === "distance"
            ? distanceKm(center, [a.location.lng, a.location.lat]) -
              distanceKm(center, [b.location.lng, b.location.lat])
            : 0,
  );
}
export function publicSnapshot(p: PublicProperty): PublicProperty {
  if (p.location.accuracy === "exact")
    throw new Error("Exact coordinates cannot enter a static snapshot.");
  if (p.location.radiusMeters < 300)
    throw new Error(
      "Static locations require an approximate radius of at least 300m.",
    );
  return propertySchema.parse(p);
}
export function snapshotForExport(p: PublicProperty): PublicProperty {
  return publicSnapshot(
    p.location.accuracy === "exact"
      ? {
          ...p,
          location: {
            lat: Math.round(p.location.lat / 0.002) * 0.002,
            lng: Math.round(p.location.lng / 0.002) * 0.002,
            accuracy: "approximate",
            radiusMeters: 300,
          },
        }
      : p,
  );
}
export function toggleCompare(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((i) => i !== id)
    : ids.length < 3
      ? [...ids, id]
      : ids;
}
export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  country: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(3000),
  propertyId: z.uuid(),
  consent: z.literal(true),
});
export type Inquiry = z.infer<typeof inquirySchema> & {
  id: string;
  createdAt: string;
  deliveryStatus: "local_preview" | "sent" | "pending_retry";
};
export const currencies = [
  "THB",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CNY",
  "JPY",
] as const;
export function priceLabel(
  p: Pick<PublicProperty, "priceTHB">,
  locale: Locale,
  currency: string = "THB",
  rates: Record<string, number> = { THB: 1 },
) {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", {
    style: "currency",
    currency: rates[currency] > 0 ? currency : "THB",
    maximumFractionDigits: 0,
  }).format(p.priceTHB * (rates[currency] > 0 ? rates[currency] : 1));
}
