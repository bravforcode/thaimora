import type { MetadataRoute } from "next";
import { snapshots } from "@/lib/snapshot";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "live") return [];
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) throw new Error("Production requires a canonical site URL.");
  return [
    "",
    "guide/",
    "privacy/",
    "terms/",
    ...snapshots().map((p) => `property/${p.slug}/`),
  ].flatMap((path) => [
    {
      url: `${base}/${path}`,
      alternates: {
        languages: { en: `${base}/${path}`, th: `${base}/th/${path}` },
      },
    },
    {
      url: `${base}/th/${path}`,
      alternates: {
        languages: { en: `${base}/${path}`, th: `${base}/th/${path}` },
      },
    },
  ]);
}
