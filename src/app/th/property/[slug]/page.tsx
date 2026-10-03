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
    title: p.title.th,
    description: p.description.th,
    alternates: {
      canonical: `/th/property/${p.slug}/`,
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
  return <PropertyPage snapshot={p} />;
}
