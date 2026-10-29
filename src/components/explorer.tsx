"use client";
import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  MapPin,
  SlidersHorizontal,
  ArrowDown,
  MapTrifold,
  ListBullets,
  X,
  Heart,
  Scales,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { previewFX } from "@/lib/preview";
import {
  defaultFilters,
  filterProperties,
  toggleCompare,
  type Filters,
  type Bounds,
  type Point,
  type PublicProperty,
  priceLabel,
  filtersFromParams,
  filtersToParams,
  validatePolygon,
} from "@/lib/property";
import { api, getProperties, liveMode } from "@/lib/api";
import { useSettings } from "./context";
import { PropertyCard } from "./property-card";
import { PropertyDetail } from "./property-detail";
import { markerFixtures } from "@/lib/performance";
const PropertyMap = dynamic(() => import("./map").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});
function QuerySync({
  setFilters,
  setAll,
  setPerformance,
  initialProperties,
  setHydrated,
  setBounds,
  setPolygon,
}: {
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  setAll: React.Dispatch<React.SetStateAction<PublicProperty[]>>;
  setPerformance: React.Dispatch<React.SetStateAction<boolean>>;
  initialProperties: PublicProperty[];
  setHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setBounds: React.Dispatch<React.SetStateAction<Bounds | undefined>>;
  setPolygon: React.Dispatch<React.SetStateAction<Point[]>>;
}) {
  const params = useSearchParams();
  useEffect(() => {
    const next = filtersFromParams(new URLSearchParams(params.toString()));
    setFilters((f) => (JSON.stringify(f) === JSON.stringify(next) ? f : next));
    const box = params.get("bbox")?.split(",").map(Number);
    setBounds((current) => {
      const value =
        box?.length === 4 && box.every(Number.isFinite)
          ? (box as Bounds)
          : undefined;
      return JSON.stringify(value) === JSON.stringify(current)
        ? current
        : value;
    });
    try {
      const value = params.has("polygon")
        ? validatePolygon(JSON.parse(params.get("polygon")!))
        : [];
      setPolygon((current) =>
        JSON.stringify(value) === JSON.stringify(current) ? current : value,
      );
    } catch {
      setPolygon([]);
    }
    setHydrated(true);
    if (!liveMode && params.get("perf") === "2000") {
      setAll(markerFixtures(initialProperties));
      setPerformance(true);
    }
  }, [
    params,
    setFilters,
    setAll,
    setPerformance,
    initialProperties,
    setHydrated,
    setBounds,
    setPolygon,
  ]);
  return null;
}
export function Explorer({
  initialProperties,
}: {
  initialProperties: PublicProperty[];
}) {
  const { locale, tr, favorites, currency } = useSettings();
  const [performance, setPerformance] = useState(false);
  const [hydrated, setHydrated] = useState(false),
    [comparisonLoaded, setComparisonLoaded] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters),
    [all, setAll] = useState<PublicProperty[]>(initialProperties),
    [selectedId, setSelectedId] = useState<string | null>(
      liveMode ? null : (initialProperties[0]?.id ?? null),
    ),
    [mobileView, setMobileView] = useState("map"),
    [mobileDetail, setMobileDetail] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [compare, setCompare] = useState<string[]>([]),
    [compareOpen, setCompareOpen] = useState(false),
    [bounds, setBounds] = useState<Bounds>(),
    [center] = useState<Point>(),
    [sortCenter, setSortCenter] = useState<Point>([98.33, 7.94]),
    [scopeCenter, setScopeCenter] = useState<Point>([98.33, 7.94]),
    [polygon, setPolygon] = useState<Point[]>([]),
    [poi, setPoi] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [fx, setFx] = useState<{ date: string; rates: Record<string, number> }>(
      liveMode ? { date: "unavailable", rates: { THB: 1 } } : previewFX,
    );
  const cards = useRef<HTMLDivElement>(null),
    compareDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const ids: unknown = JSON.parse(
        localStorage.getItem("thaimora-compare") || "[]",
      );
      if (Array.isArray(ids))
        setCompare(
          [
            ...new Set(
              ids.filter(
                (id): id is string =>
                  typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
              ),
            ),
          ].slice(0, 3),
        );
    } catch {}
    setComparisonLoaded(true);
    if (!liveMode) {
      try {
        const local = localStorage.getItem("thaimora-properties");
        if (local) setAll(JSON.parse(local));
      } catch {}
    } else {
      setAll([]);
      setSelectedId(null);
    }
  }, []);
  useEffect(() => {
    if (comparisonLoaded)
      localStorage.setItem("thaimora-compare", JSON.stringify(compare));
  }, [compare, comparisonLoaded]);
  useEffect(() => {
    if (!hydrated) return;
    const params = filtersToParams(
      filters,
      new URLSearchParams(location.search),
    );
    if (bounds) params.set("bbox", bounds.join(","));
    else params.delete("bbox");
    if (polygon.length) params.set("polygon", JSON.stringify(polygon));
    else params.delete("polygon");
    const suffix = params.toString(),
      url = `${location.pathname}${suffix ? `?${suffix}` : ""}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`)
      window.history.replaceState(null, "", url);
  }, [filters, bounds, polygon, hydrated]);
  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController(),
      timer = setTimeout(() => {
        setLoading(true);
        setError("");
        getProperties(filters, controller.signal, {
          bounds,
          polygon,
          center: scopeCenter,
        })
          .then(setAll)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => setLoading(false));
      }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, bounds, polygon, scopeCenter]);
  useEffect(() => {
    if (!liveMode) return;
    api<{ date: string; rates: Record<string, number> }>(
      "/v1/fx?base=THB&quotes=USD,EUR,GBP,AUD,CNY,JPY",
    )
      .then((r) => setFx({ ...r, rates: { THB: 1, ...r.rates } }))
      .catch(() => setFx({ date: "unavailable", rates: { THB: 1 } }));
  }, []);
  const rows = useMemo(
    () =>
      filterProperties(all, filters, favorites, bounds, polygon, sortCenter),
    [all, filters, favorites, bounds, polygon, sortCenter],
  );
  const selected = rows.find((p) => p.id === selectedId) ?? null;
  function select(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
    requestAnimationFrame(() =>
      cards.current
        ?.querySelector(`[data-property-id="${id}"]`)
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "nearest",
          inline: "center",
        }),
    );
  }
  function filter(key: keyof Filters, value: string | boolean) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function reset() {
    setFilters(defaultFilters);
    setBounds(undefined);
    setPolygon([]);
  }
  const activeFilters = Object.entries(filters).filter(
    ([k, v]) =>
      v !== defaultFilters[k as keyof Filters] &&
      k !== "sort" &&
      k !== "favoritesOnly",
  ).length;
  function toggle(id: string) {
    if (compare.length === 3 && !compare.includes(id)) {
      setError(
        tr(
          "Compare up to 3 properties. Remove one to add another.",
          "เปรียบเทียบได้สูงสุด 3 รายการ ลบหนึ่งรายการเพื่อเพิ่มรายการใหม่",
        ),
      );
      return;
    }
    setCompare((v) => toggleCompare(v, id));
  }
  function showCompare() {
    setCompareOpen(true);
    compareDialog.current?.showModal();
  }
  const options: Record<string, { value: string; en: string; th: string }[]> = {
    transaction: [
      { value: "sale", en: "Buy", th: "ซื้อ" },
      { value: "rent", en: "Rent", th: "เช่า" },
    ],
    type: [
      { value: "condo", en: "Condo", th: "คอนโด" },
      { value: "house", en: "House", th: "บ้าน" },
      { value: "villa", en: "Villa", th: "วิลล่า" },
      { value: "land", en: "Land", th: "ที่ดิน" },
      { value: "townhouse", en: "Townhouse", th: "ทาวน์เฮาส์" },
    ],
    ownership: [
      { value: "freehold", en: "Freehold", th: "กรรมสิทธิ์" },
      { value: "leasehold", en: "Leasehold", th: "สิทธิการเช่า" },
      { value: "unknown", en: "Unknown", th: "ยังไม่ยืนยัน" },
    ],
    furnishing: [
      { value: "furnished", en: "Furnished", th: "ตกแต่งครบ" },
      {
        value: "partly_furnished",
        en: "Partly furnished",
        th: "ตกแต่งบางส่วน",
      },
      { value: "unfurnished", en: "Unfurnished", th: "ไม่มีเฟอร์นิเจอร์" },
    ],
    status: [
      { value: "available", en: "Available", th: "พร้อมใช้งาน" },
      { value: "sold", en: "Sold", th: "ขายแล้ว" },
      { value: "rented", en: "Rented", th: "ให้เช่าแล้ว" },
    ],
  };
  return (
    <main id="main" className="explorer">
      <Suspense fallback={null}>
        <QuerySync
          setFilters={setFilters}
          setAll={setAll}
          setPerformance={setPerformance}
          initialProperties={initialProperties}
          setHydrated={setHydrated}
          setBounds={setBounds}
          setPolygon={setPolygon}
        />
      </Suspense>
      {performance && (
        <p className="notice">
          {tr(
            "2,000 synthetic markers · performance fixture",
            "2,000 หมุดจำลอง · ทดสอบการแสดงผล",
          )}
        </p>
      )}
      <section className="search-heading">
        <div>
          <h1>
            {tr("Find your place in Thailand.", "ค้นหาที่ที่ใช่ในประเทศไทย")}
          </h1>
          <p>
            {tr(
              "From island mornings to a home of your own. Start in Phuket.",
              "จากเช้าวันใหม่บนเกาะสู่บ้านในฝัน เริ่มต้นที่ภูเก็ต",
            )}
          </p>
        </div>
        <div className="destination-label">
          <MapPin size={18} weight="fill" />{" "}
          {tr("Exploring Phuket", "สำรวจภูเก็ต")}
          <span>{tr("Thailand", "ประเทศไทย")}</span>
        </div>
      </section>
      <section
        className="search-controls"
        aria-label={tr("Property search", "ค้นหาอสังหาริมทรัพย์")}
      >
        <label className="filter-select">
          <span className="visually-hidden">
            {tr("Buy or rent", "ซื้อหรือเช่า")}
          </span>
          <select
            aria-label={tr("Buy or rent", "ซื้อหรือเช่า")}
            value={filters.transaction}
            onChange={(e) => filter("transaction", e.target.value)}
          >
            <option value="">{tr("Buy & rent", "ซื้อและเช่า")}</option>
            {options.transaction.map((o) => (
              <option key={o.value} value={o.value}>
                {tr(o.en, o.th)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="visually-hidden">
            {tr("Property type", "ประเภทอสังหาริมทรัพย์")}
          </span>
          <select
            aria-label={tr("Property type", "ประเภทอสังหาริมทรัพย์")}
            value={filters.type}
            onChange={(e) => filter("type", e.target.value)}
          >
            <option value="">{tr("Property type", "ประเภท")}</option>
            {options.type.map((o) => (
              <option key={o.value} value={o.value}>
                {tr(o.en, o.th)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`filter-toggle ${activeFilters ? "has-filters" : ""}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={20} />
          {tr("Filters", "ตัวกรอง")}
          {activeFilters > 0 && <b>{activeFilters}</b>}
        </button>
        <button
          className="favorites-toggle icon-button"
          aria-label={tr("Show saved properties", "แสดงรายการโปรด")}
          aria-pressed={filters.favoritesOnly}
          onClick={() => filter("favoritesOnly", !filters.favoritesOnly)}
        >
          <Heart
            size={20}
            weight={filters.favoritesOnly ? "fill" : "regular"}
          />
        </button>
      </section>
      {filtersOpen && (
        <section className="advanced-filters">
          <div className="advanced-heading">
            <h2>{tr("Find the right fit", "ค้นหาให้ตรงใจ")}</h2>
            <button className="text-button" onClick={reset}>
              <ArrowCounterClockwise size={16} />
              {tr("Reset filters", "รีเซ็ต")}
            </button>
          </div>
          <div className="filter-grid">
            <label>
              {tr("Zone", "โซน")}
              <select
                value={filters.zone}
                onChange={(e) => filter("zone", e.target.value)}
              >
                <option value="">{tr("All zones", "ทุกโซน")}</option>
                {[...new Set(all.map((p) => p.zone))].sort().map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
            <fieldset className="amenity-filters">
              <legend>{tr("Amenities", "สิ่งอำนวยความสะดวก")}</legend>
              {[...new Set(all.flatMap((p) => p.amenities))]
                .sort()
                .map((amenity) => (
                  <label className="checkbox-label" key={amenity}>
                    <input
                      type="checkbox"
                      checked={filters.amenities.split(",").includes(amenity)}
                      onChange={(e) => {
                        const values = filters.amenities
                          .split(",")
                          .filter(Boolean)
                          .filter((v) => v !== amenity);
                        filter(
                          "amenities",
                          (e.target.checked
                            ? [...values, amenity]
                            : values
                          ).join(","),
                        );
                      }}
                    />
                    {amenity}
                  </label>
                ))}
            </fieldset>
            {(
              [
                ["minPrice", "Min price (THB)", "ราคาต่ำสุด (บาท)"],
                ["maxPrice", "Max price (THB)", "ราคาสูงสุด (บาท)"],
                ["beds", "Min bedrooms", "ห้องนอนขั้นต่ำ"],
                ["baths", "Min bathrooms", "ห้องน้ำขั้นต่ำ"],
                ["minArea", "Min area (m²)", "พื้นที่ขั้นต่ำ (ตร.ม.)"],
                ["maxArea", "Max area (m²)", "พื้นที่สูงสุด (ตร.ม.)"],
              ] as const
            ).map(([key, en, th]) => (
              <label key={key}>
                {tr(en, th)}
                <input
                  type="number"
                  min={0}
                  value={filters[key]}
                  onChange={(e) => filter(key, e.target.value)}
                />
              </label>
            ))}
            {(["ownership", "furnishing", "status"] as const).map((key) => (
              <label key={key}>
                {key === "ownership"
                  ? tr("Ownership", "กรรมสิทธิ์")
                  : key === "furnishing"
                    ? tr("Furnishing", "การตกแต่ง")
                    : tr("Status", "สถานะ")}
                <select
                  value={filters[key]}
                  onChange={(e) => filter(key, e.target.value)}
                >
                  <option value="">{tr("Any", "ทั้งหมด")}</option>
                  {options[key].map((o) => (
                    <option key={o.value} value={o.value}>
                      {tr(o.en, o.th)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className="button" onClick={() => setFiltersOpen(false)}>
            {tr("Show results", "แสดงผลลัพธ์")} ({rows.length})
          </button>
        </section>
      )}
      <div className="results-bar">
        <div>
          <strong>{rows.length}</strong>{" "}
          {tr("places, endless possibilities", "รายการ เต็มไปด้วยโอกาส")}{" "}
          {!liveMode && !performance && (
            <span className="preview-badge">
              {tr(
                "30 synthetic listings · preview",
                "30 รายการจำลอง · ตัวอย่าง",
              )}
            </span>
          )}
        </div>
        <div className="results-actions">
          <button
            className="poi-toggle"
            aria-pressed={poi}
            onClick={() => setPoi(!poi)}
          >
            <MapPin size={16} />
            {tr("Nearby places", "สถานที่ใกล้เคียง")}
          </button>
          <label className="sort-label">
            <ArrowDown size={15} />
            <span className="visually-hidden">
              {tr("Sort properties", "เรียงรายการ")}
            </span>
            <select
              aria-label={tr("Sort properties", "เรียงรายการ")}
              value={filters.sort}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="relevance">{tr("Recommended", "แนะนำ")}</option>
              <option value="price_asc">
                {tr("Price: low to high", "ราคา: ต่ำไปสูง")}
              </option>
              <option value="price_desc">
                {tr("Price: high to low", "ราคา: สูงไปต่ำ")}
              </option>
              <option value="newest">{tr("Newest first", "ใหม่ที่สุด")}</option>
              <option value="distance">
                {tr("Nearest to map center", "ใกล้จุดกลางแผนที่")}
              </option>
            </select>
          </label>
        </div>
      </div>
      {loading && (
        <p role="status" className="notice">
          {tr("Loading current listings…", "กำลังโหลดรายการปัจจุบัน…")}
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            {tr("Dismiss", "ปิด")}
          </button>
        </div>
      )}
      <div className="mobile-view-toggle">
        <button
          aria-pressed={mobileView === "map"}
          onClick={() => setMobileView("map")}
        >
          <MapTrifold size={18} />
          {tr("Map", "แผนที่")}
        </button>
        <button
          aria-pressed={mobileView === "list"}
          onClick={() => setMobileView("list")}
        >
          <ListBullets size={18} />
          {tr("List", "รายการ")}
        </button>
      </div>
      <div className={`discovery-workspace mobile-${mobileView}`}>
        <div className="map-column">
          <PropertyMap
            properties={rows}
            selectedId={selectedId}
            onSelect={select}
            center={center}
            onPolygon={setPolygon}
            areaPoints={polygon}
            poi={poi}
            onMove={(b, c) => {
              setBounds(b);
              setScopeCenter(c);
              setSortCenter(c);
            }}
          />
          <div className="map-caption">
            <span className="pulse-dot" />
            {tr(
              "Every pin is a possibility. Make one yours.",
              "ทุกหมุดคือโอกาส ค้นหาที่ที่เป็นของคุณ",
            )}
          </div>
        </div>
        {selected && (
          <aside
            className={`selected-panel ${mobileDetail ? "mobile-open" : ""}`}
          >
            <PropertyDetail
              property={selected}
              compact
              onClose={() => {
                setSelectedId(null);
                setMobileDetail(false);
              }}
              rates={fx.rates}
              fxDate={fx.date}
            />
          </aside>
        )}
        <section
          className="results-strip"
          aria-label={tr("Property results", "ผลการค้นหา")}
        >
          <div className="strip-heading">
            <h2>
              {filters.favoritesOnly
                ? tr("Your saved places", "รายการโปรดของคุณ")
                : tr("A few places to call home", "สถานที่ที่คุณเรียกว่าบ้าน")}
            </h2>
            <span>{tr("Explore on the map", "สำรวจบนแผนที่")} →</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty-state">
              <MapPin size={30} />
              <h3>
                {tr("No places match just yet.", "ยังไม่มีรายการที่ตรงกัน")}
              </h3>
              <p>
                {tr(
                  "Try a wider area or fewer filters.",
                  "ลองขยายพื้นที่หรือลดตัวกรอง",
                )}
              </p>
              <button className="button secondary" onClick={reset}>
                {tr("Reset search", "เริ่มค้นหาใหม่")}
              </button>
            </div>
          ) : (
            <div className="property-cards" ref={cards}>
              {(performance ? rows.slice(0, 30) : rows).map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  selected={p.id === selectedId}
                  onSelect={() => select(p.id)}
                  onCompare={() => toggle(p.id)}
                  compared={compare.includes(p.id)}
                  rates={fx.rates}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {compare.length > 0 && (
        <div className="compare-bar">
          <Scales size={20} />
          {compare.length}{" "}
          {tr("selected for comparison", "รายการเพื่อเปรียบเทียบ")}
          <button className="button small" onClick={showCompare}>
            {tr("Compare", "เปรียบเทียบ")}
          </button>
          <button
            className="icon-button"
            aria-label={tr("Clear comparison", "ล้างการเปรียบเทียบ")}
            onClick={() => setCompare([])}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <dialog
        ref={compareDialog}
        className="compare-dialog"
        onClose={() => setCompareOpen(false)}
      >
        <div className="dialog-heading">
          <h2>{tr("Side by side.", "เปรียบเทียบกัน")}</h2>
          <button
            className="icon-button"
            aria-label={tr("Close comparison", "ปิดการเปรียบเทียบ")}
            onClick={() => compareDialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {compareOpen && (
          <div className="compare-table">
            <table>
              <thead>
                <tr>
                  <th>{tr("Property", "อสังหาริมทรัพย์")}</th>
                  {compare.map((id) => (
                    <th key={id}>
                      {all.find((p) => p.id === id)?.title[locale]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Price",
                    "ราคา",
                    (p: PublicProperty) =>
                      priceLabel(p, locale, currency, fx.rates),
                  ],
                  ["Type", "ประเภท", (p: PublicProperty) => p.type],
                  ["Bedrooms", "ห้องนอน", (p: PublicProperty) => p.beds],
                  ["Bathrooms", "ห้องน้ำ", (p: PublicProperty) => p.baths],
                  [
                    "Area (m²)",
                    "พื้นที่ (ตร.ม.)",
                    (p: PublicProperty) => p.areaM2,
                  ],
                  [
                    "Ownership",
                    "กรรมสิทธิ์",
                    (p: PublicProperty) => p.ownership,
                  ],
                  ["Zone", "พื้นที่", (p: PublicProperty) => p.zone],
                ].map(([en, th, fn]) => (
                  <tr key={String(en)}>
                    <th>{tr(String(en), String(th))}</th>
                    {compare.map((id) => (
                      <td key={id}>
                        {all.find((p) => p.id === id)
                          ? (fn as (p: PublicProperty) => React.ReactNode)(
                              all.find((p) => p.id === id)!,
                            )
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </dialog>
    </main>
  );
}
