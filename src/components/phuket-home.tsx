"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Bathtub,
  Bed,
  Heart,
  Ruler,
  Storefront,
  UserCircle,
} from "@phosphor-icons/react";
import { LocaleLink as Link, useSettings } from "./context";
import { InquiryButton } from "./inquiry";
import { previewFX } from "@/lib/demo";
import { priceLabel, type PublicProperty } from "@/lib/property";
import { type HomeListing } from "@/lib/listings";
import { toHomeListing, usePublished } from "@/lib/published";
import { countByZone, zoneById, zoneIdFor, zoneLabel, zones } from "@/lib/zones";

const ZoneMap = dynamic(() => import("./zone-map").then((m) => m.ZoneMap), {
  ssr: false,
  loading: () => <div className="zone-map-loading">Loading map…</div>,
});

const typeLabels: Record<string, [string, string]> = {
  villa: ["Villa", "วิลลา"],
  condo: ["Condo", "คอนโด"],
  house: ["House", "บ้าน"],
  townhouse: ["Townhouse", "ทาวน์เฮาส์"],
  land: ["Land", "ที่ดิน"],
};

type Transaction = "" | "sale" | "rent";

export function PhuketHome({ listings: catalog }: { listings: HomeListing[] }) {
  const { locale, tr, currency, unit, favorites, toggleFavorite } =
    useSettings();
  const { items: published } = usePublished();
  const listings = useMemo(
    () => [...catalog, ...published.map((p, i) => toHomeListing(p, i))],
    [catalog, published],
  );
  const [activeZone, setActiveZone] = useState<string | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [transaction, setTransaction] = useState<Transaction>(""),
    [type, setType] = useState("");
  const counts = useMemo(() => countByZone(listings), [listings]);
  const zone = zoneById(activeZone);
  const zoneListings = useMemo(
    () =>
      listings.filter(
        (l) =>
          zoneIdFor(l.zone) === activeZone &&
          (!transaction || l.transaction === transaction) &&
          (!type || l.type === type),
      ),
    [listings, activeZone, transaction, type],
  );
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const ownerCount = listings.filter((l) => l.channel.kind === "owner").length;
  const agentCount = listings.length - ownerCount;
  const sizeLabel = (p: PublicProperty) => {
    const m2 = p.type === "land" ? (p.landAreaM2 ?? p.areaM2) : p.areaM2;
    const digits = locale === "th" ? "th-TH" : "en-US";
    return unit === "sqft"
      ? `${Math.round(m2 * 10.7639).toLocaleString(digits)} ft²`
      : `${m2.toLocaleString(digits)} m²`;
  };
  const priceOf = (p: PublicProperty) =>
    priceLabel(p, locale, currency, previewFX.rates) +
    (p.transaction === "rent" ? tr(" / month", " / เดือน") : "");
  const pickZone = (id: string | null) => {
    setActiveZone(id);
    setSelectedId(null);
  };
  const typeName = (t: string) => typeLabels[t]?.[locale === "th" ? 1 : 0] ?? t;

  return (
    <main id="main" className="home">
      <section className="home-intro">
        <h1>
          {tr("Find your place in Phuket", "หาที่ใช่ในภูเก็ต")}
        </h1>
        <p>
          {tr(
            "Pick an area on the map to see homes listed by owners and agents.",
            "เลือกพื้นที่บนแผนที่เพื่อดูบ้านที่เจ้าของและนายหน้าลงประกาศไว้",
          )}
        </p>
      </section>
      <div className="home-grid">
        <section className="home-map" aria-label={tr("Phuket map", "แผนที่ภูเก็ต")}>
          <ZoneMap
            listings={zoneListings}
            counts={counts}
            activeZone={activeZone}
            selectedId={selectedId}
            onZone={pickZone}
            onListing={setSelectedId}
          />
          {zone && (
            <button
              type="button"
              className="map-back"
              onClick={() => pickZone(null)}
            >
              <ArrowLeft size={16} />
              {tr("All of Phuket", "ภูเก็ตทั้งหมด")}
            </button>
          )}
        </section>

        <aside className="home-panel" aria-live="polite">
          {!zone && (
            <>
              <div className="panel-card">
                <h2>{tr("Popular areas", "พื้นที่ยอดนิยม")}</h2>
                <ul className="zone-list">
                  {zones.map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        className="zone-row"
                        onClick={() => pickZone(z.id)}
                      >
                        <span className="zone-row-name">{zoneLabel(z, locale)}</span>
                        <span className="zone-row-count">
                          {counts[z.id] ?? 0}{" "}
                          {tr("listings", "รายการ")}
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel-card stats-card">
                <div>
                  <b>{listings.length}</b>
                  <span>{tr("listings", "รายการ")}</span>
                </div>
                <div>
                  <b>{ownerCount}</b>
                  <span>{tr("owner direct", "เจ้าของขายเอง")}</span>
                </div>
                <div>
                  <b>{agentCount}</b>
                  <span>{tr("via agents", "ผ่านนายหน้า")}</span>
                </div>
              </div>
              <div className="panel-card cta-card">
                <p>
                  {tr(
                    "Own property here? List it yourself or join as an agent.",
                    "มีทรัพย์สินในภูเก็ต? ลงประกาศเองหรือสมัครเป็นนายหน้า",
                  )}
                </p>
                <Link className="button primary" href="/dashboard/">
                  {tr("Owner or agent sign-in", "เข้าสู่ระบบเจ้าของ / นายหน้า")}
                </Link>
              </div>
            </>
          )}

          {zone && !selected && (
            <>
              <div className="panel-card zone-head">
                <span className="eyebrow">{tr("Area", "พื้นที่")}</span>
                <h2>{zoneLabel(zone, locale)}</h2>
                <p>
                  {zoneListings.length}{" "}
                  {tr("listings shown", "รายการที่แสดง")}
                </p>
              </div>
              <div className="filter-row" role="group" aria-label={tr("Filter", "กรอง")}>
                {(["", "sale", "rent"] as const).map((t) => (
                  <button
                    key={t || "all"}
                    type="button"
                    className="chip"
                    aria-pressed={transaction === t}
                    onClick={() => setTransaction(t)}
                  >
                    {t === ""
                      ? tr("All", "ทั้งหมด")
                      : t === "sale"
                        ? tr("For sale", "ขาย")
                        : tr("For rent", "เช่า")}
                  </button>
                ))}
                {Object.keys(typeLabels).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    aria-pressed={type === t}
                    onClick={() => setType(type === t ? "" : t)}
                  >
                    {typeName(t)}
                  </button>
                ))}
              </div>
              <ul className="listing-list">
                {zoneListings.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="listing-row"
                      onClick={() => setSelectedId(l.id)}
                    >
                      <img src={l.images[0]?.url} alt="" loading="lazy" />
                      <span className="listing-row-body">
                        <b>{locale === "th" ? l.title.th : l.title.en}</b>
                        <span className="listing-row-price">{priceOf(l)}</span>
                        <span className="listing-row-meta">
                          {typeName(l.type)} · {l.beds} {tr("bd", "นอน")} ·{" "}
                          {sizeLabel(l)}
                        </span>
                        <ChannelTag listing={l} />
                      </span>
                    </button>
                  </li>
                ))}
                {zoneListings.length === 0 && (
                  <li className="empty-note">
                    {tr(
                      "No listings match these filters in this area.",
                      "ไม่มีรายการที่ตรงกับตัวกรองในพื้นที่นี้",
                    )}
                  </li>
                )}
              </ul>
            </>
          )}

          {selected && (
            <article className="panel-card listing-detail">
              <div className="detail-top">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft size={16} />
                  {tr("Back to list", "กลับไปรายการ")}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-pressed={favorites.includes(selected.id)}
                  onClick={() => toggleFavorite(selected.id)}
                >
                  <Heart
                    size={18}
                    weight={favorites.includes(selected.id) ? "fill" : "regular"}
                  />
                  {tr("Save", "บันทึก")}
                </button>
              </div>
              <img
                className="detail-photo"
                src={selected.images[0]?.url}
                alt={locale === "th" ? selected.images[0]?.alt.th : selected.images[0]?.alt.en}
              />
              {selected.images[0]?.credit && (
                <p className="photo-credit">{selected.images[0].credit}</p>
              )}
              <h2>{locale === "th" ? selected.title.th : selected.title.en}</h2>
              <p className="detail-price">{priceOf(selected)}</p>
              <ul className="spec-row">
                <li>
                  <Bed size={16} /> {selected.beds} {tr("bedrooms", "ห้องนอน")}
                </li>
                <li>
                  <Bathtub size={16} /> {selected.baths} {tr("bathrooms", "ห้องน้ำ")}
                </li>
                <li>
                  <Ruler size={16} /> {sizeLabel(selected)}
                </li>
              </ul>
              <p className="detail-zone">
                {typeName(selected.type)} · {zone ? zoneLabel(zone, locale) : ""} · {selected.province}
              </p>
              <p className="detail-body">
                {locale === "th"
                  ? selected.description.th
                  : selected.description.en}
              </p>
              <ChannelBox listing={selected} />
              {!selected.published && (
                <Link className="text-link" href={`/property/${selected.slug}/`}>
                  {tr("Full property page", "หน้ารายละเอียดเต็ม")}
                </Link>
              )}
            </article>
          )}
        </aside>
      </div>
    </main>
  );
}

function ChannelTag({ listing }: { listing: HomeListing }) {
  const { tr } = useSettings();
  return listing.channel.kind === "owner" ? (
    <span className="tag owner">{tr("Owner direct", "เจ้าของขายเอง")}</span>
  ) : (
    <span className="tag agent">{tr("Via agent", "ผ่านนายหน้า")}</span>
  );
}

function ChannelBox({ listing }: { listing: HomeListing }) {
  const { tr } = useSettings();
  if (listing.channel.kind === "owner")
    return (
      <div className="channel-box">
        <p>
          <UserCircle size={18} />{" "}
          {tr(
            "Sold directly by the owner. Send your question through PhuketLens; the owner is notified only after you consent.",
            "เจ้าของขายเอง ส่งคำถามผ่าน PhuketLens เจ้าของจะได้รับแจ้งเมื่อคุณยินยอมเท่านั้น",
          )}
        </p>
        <InquiryButton property={listing} />
      </div>
    );
  return (
    <div className="channel-box">
      <p>
        <Storefront size={18} />{" "}
        {[listing.channel.name, listing.channel.agency].filter(Boolean).join(" · ") ||
          tr("Listed by an agent", "ลงประกาศโดยนายหน้า")}
      </p>
      <p className="muted">
        {tr(
          "Contact the agent through PhuketLens. Your details go to the agent only after you consent.",
          "ติดต่อนายหน้าผ่าน PhuketLens ข้อมูลของคุณจะส่งถึงนายหน้าเมื่อคุณยินยอมเท่านั้น",
        )}
      </p>
      <InquiryButton property={listing} />
    </div>
  );
}
