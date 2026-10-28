"use client";
import { LocaleLink as Link } from "./context";
import { useState, useEffect } from "react";
import {
  Bed,
  Bathtub,
  Ruler,
  MapPin,
  Heart,
  ShareNetwork,
  ArrowUpRight,
  X,
  Check,
  SwimmingPool,
  Barbell,
  Car,
  ShieldCheck,
  Tree,
  Sun,
  RoadHorizon,
  CalendarBlank,
} from "@phosphor-icons/react";
import { useSettings } from "./context";
import { type PublicProperty, priceLabel } from "@/lib/property";
import { previewFX } from "@/lib/preview";
import { liveMode, recordMeasurement } from "@/lib/api";
import { InquiryButton } from "./inquiry";
import { nearbyPOIs, previewPOIs, type POI } from "@/lib/pois";
import { SourceNotes } from "./source-notes";
import { distanceKm } from "@/lib/property";
const amenityIcons: Record<string, typeof SwimmingPool> = {
  pool: SwimmingPool,
  gym: Barbell,
  parking: Car,
  security: ShieldCheck,
  garden: Tree,
  balcony: Sun,
  "road access": RoadHorizon,
};
export function PropertyDetail({
  property: p,
  compact = false,
  onClose,
  rates = previewFX.rates,
  fxDate = previewFX.date,
}: {
  property: PublicProperty;
  compact?: boolean;
  onClose?: () => void;
  rates?: Record<string, number>;
  fxDate?: string;
}) {
  const {
    locale,
    tr,
    currency,
    unit,
    favorites,
    toggleFavorite,
    measurementConsent,
  } = useSettings();
  useEffect(() => {
    recordMeasurement(p.id, "view", measurementConsent).catch(() => {});
  }, [p.id, measurementConsent]);
  const [photo, setPhoto] = useState(0),
    [copied, setCopied] = useState(false),
    [nearby, setNearby] = useState<POI[]>([]);
  useEffect(() => {
    setPhoto(0);
    let disposed = false;
    const request = liveMode
      ? nearbyPOIs(p.id)
      : previewPOIs().then((rows) =>
          rows
            .map((item) => ({
              ...item,
              distanceMeters: Math.round(
                distanceKm(
                  [p.location.lng, p.location.lat],
                  [item.lng, item.lat],
                ) * 1000,
              ),
            }))
            .sort((a, b) => a.distanceMeters - b.distanceMeters)
            .slice(0, 5),
        );
    request
      .then((rows) => {
        if (!disposed) setNearby(rows);
      })
      .catch(() => {
        if (!disposed) setNearby([]);
      });
    return () => {
      disposed = true;
    };
  }, [p.id, p.location.lng, p.location.lat]);
  async function share() {
    const url = new URL(`/property/${p.slug}/`, location.origin).toString();
    try {
      if (navigator.share)
        await navigator.share({ title: p.title[locale], url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      setCopied(false);
    }
  }
  const area = (v: number) =>
    `${Math.round(v * (unit === "sqft" ? 10.7639 : 1))} ${unit === "sqm" ? "m²" : "ft²"}`;
  const labels: Record<string, [string, string]> = {
    freehold: ["Freehold", "กรรมสิทธิ์"],
    leasehold: ["Leasehold", "สิทธิการเช่า"],
    unknown: ["Not confirmed", "ยังไม่ยืนยัน"],
    furnished: ["Furnished", "ตกแต่งครบ"],
    partly_furnished: ["Partly furnished", "ตกแต่งบางส่วน"],
    unfurnished: ["Unfurnished", "ไม่มีเฟอร์นิเจอร์"],
    available: ["Available", "พร้อมใช้งาน"],
    sold: ["Sold", "ขายแล้ว"],
    rented: ["Rented", "ให้เช่าแล้ว"],
    condo: ["Condo", "คอนโด"],
    villa: ["Villa", "วิลล่า"],
    house: ["House", "บ้าน"],
    land: ["Land", "ที่ดิน"],
    townhouse: ["Townhouse", "ทาวน์เฮาส์"],
  };
  const name = (v: string) => (labels[v] ? tr(...labels[v]) : v);
  return (
    <section
      className={`property-detail ${compact ? "compact" : ""}`}
      aria-label={tr("Selected property", "อสังหาริมทรัพย์ที่เลือก")}
    >
      <div className="detail-gallery">
        <img
          src={p.images[photo]?.url}
          alt={p.images[photo]?.alt[locale] || p.title[locale]}
        />
        <span className="image-note" hidden={liveMode}>
          {tr("Illustrative photography", "ภาพถ่ายประกอบ")}
        </span>
        {onClose && (
          <button
            className="gallery-close icon-button"
            aria-label={tr("Close property detail", "ปิดรายละเอียด")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        )}
        <div className="gallery-pagination">
          {p.images.map((_, i) => (
            <button
              key={i}
              className={i === photo ? "active" : ""}
              aria-label={`${tr("View image", "ดูภาพ")} ${i + 1}`}
              onClick={() => setPhoto(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="detail-content">
        <div className="detail-topline">
          <span className="availability">
            <span />
            {name(p.status)}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label={tr("Save property", "บันทึกอสังหาริมทรัพย์")}
              aria-pressed={favorites.includes(p.id)}
              onClick={() => toggleFavorite(p.id)}
            >
              <Heart
                size={20}
                weight={favorites.includes(p.id) ? "fill" : "regular"}
              />
            </button>
            <button
              className="icon-button"
              aria-label={tr("Share property", "แชร์อสังหาริมทรัพย์")}
              onClick={share}
            >
              {copied ? <Check size={20} /> : <ShareNetwork size={20} />}
            </button>
          </div>
        </div>
        {compact ? <h2>{p.title[locale]}</h2> : <h1>{p.title[locale]}</h1>}
        <p className="detail-location">
          <MapPin size={17} />
          {p.zone}, {p.province}, {tr("Thailand", "ประเทศไทย")}
        </p>
        <div className="detail-price">
          {priceLabel(p, locale, currency, rates)}
          {p.transaction === "rent" && (
            <small>{tr("/ month", "/ เดือน")}</small>
          )}
        </div>
        {currency !== "THB" && (
          <p className="fx-note">
            {tr("Approximate conversion", "อัตราแลกเปลี่ยนโดยประมาณ")} ·{" "}
            {fxDate}
            {!liveMode && ` · ${tr("sample rate", "อัตราตัวอย่าง")}`}
          </p>
        )}
        <div className="detail-facts">
          <div>
            <Bed size={22} />
            <strong>{p.beds}</strong>
            <span>{tr("Bedrooms", "ห้องนอน")}</span>
          </div>
          <div>
            <Bathtub size={22} />
            <strong>{p.baths}</strong>
            <span>{tr("Bathrooms", "ห้องน้ำ")}</span>
          </div>
          <div>
            <Ruler size={22} />
            <strong>{area(p.areaM2)}</strong>
            <span>{tr("Living area", "พื้นที่ใช้สอย")}</span>
          </div>
        </div>
        <InquiryButton property={p} />
        {compact && (
          <Link className="detail-link" href={`/property/${p.slug}/`}>
            {tr("View full property details", "ดูรายละเอียดทั้งหมด")}
            <ArrowUpRight size={16} />
          </Link>
        )}
        <div className="detail-section">
          <h3>{tr("A little more about this place", "รายละเอียดเพิ่มเติม")}</h3>
          <p>{p.description[locale]}</p>
          <dl className="specifications">
            {[
              [tr("Property type", "ประเภท"), name(p.type)],
              [
                tr("Transaction", "ประเภทการซื้อขาย"),
                p.transaction === "sale"
                  ? tr("For sale", "ขาย")
                  : tr("For rent", "เช่า"),
              ],
              [tr("Ownership", "กรรมสิทธิ์"), name(p.ownership)],
              [tr("Furnishing", "การตกแต่ง"), name(p.furnishing)],
              [
                tr("Land area", "พื้นที่ดิน"),
                p.landAreaM2 === null ? "—" : area(p.landAreaM2),
              ],
              [tr("Floor", "ชั้น"), p.floor ?? "—"],
              [tr("Built", "ปีที่สร้าง"), p.builtYear ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="detail-section">
          <h3>{tr("Amenities", "สิ่งอำนวยความสะดวก")}</h3>
          <div className="amenities">
            {p.amenities.map((a) => {
              const Icon = amenityIcons[a.toLowerCase()];
              return (
                <span key={a}>
                  {Icon && <Icon size={16} />}
                  {a}
                </span>
              );
            })}
          </div>
        </div>
        <div className="location-notice">
          <MapPin size={20} />
          <p>
            {p.location.accuracy === "exact"
              ? tr(
                  "Location shared with the owner’s permission.",
                  "แสดงตำแหน่งโดยได้รับอนุญาตจากเจ้าของ",
                )
              : tr(
                  `Approximate location · within ${p.location.radiusMeters} m. Contact the team for a viewing.`,
                  `ตำแหน่งโดยประมาณ ภายใน ${p.location.radiusMeters} เมตร ติดต่อทีมงานเพื่อนัดเข้าชม`,
                )}
          </p>
        </div>
        {nearby.length > 0 && (
          <div className="detail-section">
            <h3>{tr("Nearby", "สถานที่ใกล้เคียง")}</h3>
            {nearby.map((item) => (
              <div key={item.id}>
                <p>
                  {item.name[locale]}
                  {item.distanceMeters !== undefined
                    ? ` · ${Math.round(item.distanceMeters)} m`
                    : ""}
                </p>
                <SourceNotes value={item} />
              </div>
            ))}
            {!liveMode && (
              <p className="photo-credit">
                {tr(
                  "Approximate straight-line distance to a synthetic property area. Places © OpenStreetMap contributors, ODbL 1.0.",
                  "ระยะทางเส้นตรงโดยประมาณถึงพื้นที่อสังหาริมทรัพย์จำลอง สถานที่ © ผู้ร่วมสร้าง OpenStreetMap, ODbL 1.0",
                )}{" "}
                <a href="/data/osm-phuket-pois.json" download>
                  {tr("Place data", "ข้อมูลสถานที่")}
                </a>
              </p>
            )}
          </div>
        )}
        <p className="updated">
          <CalendarBlank size={14} />
          {tr("Updated", "อัปเดต")}{" "}
          {new Date(p.updatedAt).toLocaleDateString(
            locale === "th" ? "th-TH" : "en-GB",
          )}
        </p>
        <SourceNotes
          value={{
            sourceUrl: p.sourceUrl,
            sourceId: p.sourceId,
            license: p.license,
            fetchedAt: p.fetchedAt,
            sourceUpdatedAt: p.sourceUpdatedAt,
          }}
        />
        <p className="photo-credit">
          {p.images[photo]?.credit}
          {p.images[photo]?.sourceUrl && (
            <>
              {" "}
              ·{" "}
              <a
                href={p.images[photo].sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {tr("Image source", "แหล่งภาพ")}
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
