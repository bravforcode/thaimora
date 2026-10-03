import { snapshots } from "@/lib/snapshot";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PropertyPage } from "@/components/property-page";
export function generateStaticParams() {
  return snapshots().map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = snapshots().find((p) => p.slug === slug);
  if (!p) return {};
  return {
    title: p.title.en,
    description: p.description.en,
    alternates: {
      canonical: `/property/${p.slug}/`,
      languages: { en: `/property/${p.slug}/`, th: `/th/property/${p.slug}/` },
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = snapshots().find((p) => p.slug === slug);
  if (!p) notFound();
  return (
    <>
      <PropertyPage snapshot={p} />
      {process.env.NEXT_PUBLIC_DATA_MODE === "live" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "RealEstateListing",
              name: p.title.en,
              description: p.description.en,
              url: `${process.env.NEXT_PUBLIC_SITE_URL}/property/${p.slug}/`,
              datePosted: p.updatedAt,
              about: {
                "@type": "Place",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: p.zone,
                  addressRegion: p.province,
                  addressCountry: "TH",
                },
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
    </>
  );
}
