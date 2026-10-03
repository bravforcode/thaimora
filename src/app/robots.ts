import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return process.env.NEXT_PUBLIC_DATA_MODE === "live"
    ? {
        rules: [
          { userAgent: "*", allow: "/", disallow: ["/admin/", "/th/admin/"] },
        ],
        sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
