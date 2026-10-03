"use client";
import { Heart, Bed, Bathtub, Ruler, Plus, Check } from "@phosphor-icons/react";
import { type PublicProperty, priceLabel } from "@/lib/property";
import { previewFX } from "@/lib/preview";
import { useSettings } from "./context";
import { liveMode } from "@/lib/api";
import { SourceNotes } from "./source-notes";
export function PropertyCard({
  property: p,
  selected,
  onSelect,
  onCompare,
  compared,
  rates = previewFX.rates,
}: {
  property: PublicProperty;
  selected?: boolean;
  onSelect: () => void;
  onCompare: () => void;
  compared: boolean;
  rates?: Record<string, number>;
}) {
  const { locale, tr, favorites, toggleFavorite, currency, unit } =
    useSettings();
  return (
    <article
      className={`property-card ${selected ? "selected" : ""}`}
      data-property-id={p.id}
    >
      <button
        className="card-image"
        onClick={onSelect}
        aria-label={`${tr("View", "ดู")} ${p.title[locale]}`}
      >
        <img
          src={p.images[0]?.url || "/images/phuket-coast.jpg"}
          alt={p.images[0]?.alt[locale] || p.title[locale]}
          loading="lazy"
        />
        <span className="card-badge" hidden={liveMode}>
          {tr("Illustrative image", "ภาพประกอบ")}
        </span>
      </button>
      <button
        className={`favorite-button ${favorites.includes(p.id) ? "is-favorite" : ""}`}
        onClick={() => toggleFavorite(p.id)}
        aria-label={
          favorites.includes(p.id)
            ? tr("Remove from saved", "ลบจากรายการโปรด")
            : tr("Save property", "บันทึกอสังหาริมทรัพย์")
        }
        aria-pressed={favorites.includes(p.id)}
      >
        <Heart
          size={20}
          weight={favorites.includes(p.id) ? "fill" : "regular"}
        />
      </button>
      <div className="card-content">
        <div className="card-price">
          {priceLabel(p, locale, currency, rates)}
          {p.transaction === "rent" && (
            <small>{tr("/ month", "/ เดือน")}</small>
          )}
          <button
            className="compare-button"
            aria-label={tr("Compare property", "เปรียบเทียบอสังหาริมทรัพย์")}
            aria-pressed={compared}
            onClick={onCompare}
          >
            {compared ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
        <button className="card-title" onClick={onSelect}>
          {p.title[locale]}
        </button>
        <p className="card-zone">
          {p.zone}, {p.province}
        </p>
        <div className="property-facts">
          <span>
            <Bed size={16} />
            {p.beds} {tr("beds", "นอน")}
          </span>
          <span>
            <Bathtub size={16} />
            {p.baths}
          </span>
          <span>
            <Ruler size={16} />
            {Math.round(p.areaM2 * (unit === "sqft" ? 10.7639 : 1))}{" "}
            {unit === "sqm" ? "m²" : "ft²"}
          </span>
        </div>
        <SourceNotes
          compact
          value={{
            sourceUrl: p.sourceUrl ?? p.images[0]?.sourceUrl,
            sourceId: p.sourceId,
            license: p.license,
            fetchedAt: p.fetchedAt,
            sourceUpdatedAt: p.sourceUpdatedAt,
            attribution: p.images[0]?.credit,
          }}
        />
      </div>
    </article>
  );
}
