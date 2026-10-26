"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type Map as LibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { HomeListing } from "@/lib/listings";
import { phuketCenter, zoneById, zoneLabel, zones } from "@/lib/zones";
import { useSettings } from "./context";

type Props = {
  listings: HomeListing[];
  counts: Record<string, number>;
  activeZone: string | null;
  selectedId: string | null;
  onZone: (id: string) => void;
  onListing: (id: string) => void;
};

type Geo = {
  features: {
    properties: { id: string };
    geometry: { coordinates: number[][][][] };
  }[];
};

const HOUSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill="currentColor"/></svg>';
const CONDO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6zM9 7h2v2H9zm4 0h2v2h-2zM9 11h2v2H9zm4 0h2v2h-2z" fill="currentColor"/></svg>';
const LAND_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 9l4 6 3-4 5 7z" fill="currentColor"/></svg>';

function pinIcon(type: string) {
  if (type === "condo") return CONDO_ICON;
  if (type === "land") return LAND_ICON;
  return HOUSE_ICON;
}

function boundsOf(geo: Geo, id: string) {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const f of geo.features) {
    if (f.properties.id !== id) continue;
    for (const part of f.geometry.coordinates)
      for (const ring of part)
        for (const [x, y] of ring) {
          w = Math.min(w, x);
          e = Math.max(e, x);
          s = Math.min(s, y);
          n = Math.max(n, y);
        }
  }
  return Number.isFinite(w)
    ? ([
        [w, s],
        [e, n],
      ] as [[number, number], [number, number]])
    : null;
}

export function ZoneMap({
  listings,
  counts,
  activeZone,
  selectedId,
  onZone,
  onListing,
}: Props) {
  const { locale, tr } = useSettings();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    geo = useRef<Geo | null>(null),
    markers = useRef<maplibregl.Marker[]>([]),
    latest = useRef({ onZone, onListing });
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  latest.current = { onZone, onListing };

  useEffect(() => {
    if (!container.current || map.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const key = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
    const style: StyleSpecification = {
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: [
            key
              ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(key)}`
              : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: key
            ? "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    };
    let m: LibreMap;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style,
        center: phuketCenter,
        zoom: 10.6,
        minZoom: 9,
        maxZoom: 16,
        attributionControl: false,
      });
    } catch {
      setError(
        tr(
          "The map could not start. Pick an area from the list instead.",
          "ไม่สามารถเปิดแผนที่ได้ เลือกพื้นที่จากรายการด้านข้างแทน",
        ),
      );
      return;
    }
    map.current = m;
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    m.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    m.on("load", async () => {
      try {
        const res = await fetch("/data/phuket-zones.geojson");
        geo.current = (await res.json()) as Geo;
        m.addSource("zones", { type: "geojson", data: geo.current as never });
        m.addLayer({
          id: "zone-fill",
          type: "fill",
          source: "zones",
          paint: { "fill-color": "#1264e8", "fill-opacity": 0.14 },
        });
        m.addLayer({
          id: "zone-active",
          type: "fill",
          source: "zones",
          filter: ["==", ["get", "id"], "__none__"],
          paint: { "fill-color": "#11866f", "fill-opacity": 0.4 },
        });
        m.addLayer({
          id: "zone-line",
          type: "line",
          source: "zones",
          filter: ["==", ["get", "approximate"], false],
          paint: { "line-color": "#082b46", "line-width": 1.2, "line-opacity": 0.55 },
        });
        m.addLayer({
          id: "zone-line-approx",
          type: "line",
          source: "zones",
          filter: ["==", ["get", "approximate"], true],
          paint: {
            "line-color": "#082b46",
            "line-width": 1.2,
            "line-opacity": 0.55,
            "line-dasharray": [2, 2],
          },
        });
        for (const layer of ["zone-fill", "zone-active"]) {
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
          m.on("click", layer, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") latest.current.onZone(id);
          });
        }
        setReady(true);
      } catch {
        setError(
          tr(
            "Zone outlines could not load. Pick an area from the list instead.",
            "โหลดขอบเขตโซนไม่สำเร็จ เลือกพื้นที่จากรายการด้านข้างแทน",
          ),
        );
      }
    });
    return () => {
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      m.remove();
      map.current = null;
    };
    // The map is created once; labels come from the latest render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zoom to the active zone, or back out to all of Phuket.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (!activeZone) {
      m.flyTo({ center: phuketCenter, zoom: 10.6, duration: 900 });
      return;
    }
    const zone = zoneById(activeZone);
    const box = geo.current && boundsOf(geo.current, activeZone);
    if (box) m.fitBounds(box, { padding: 60, maxZoom: 14, duration: 900 });
    else if (zone) m.flyTo({ center: zone.center, zoom: 13, duration: 900 });
  }, [ready, activeZone]);

  // Count labels for the overview; property pins inside the active zone.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setFilter("zone-active", [
      "==",
      ["get", "id"],
      activeZone ?? "__none__",
    ]);
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    const add = (el: HTMLElement, lng: number, lat: number) =>
      markers.current.push(
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(m),
      );
    const label = document.createElement("div");
    label.className = "zone-island-label";
    label.textContent = locale === "th" ? "เกาะภูเก็ต" : "PHUKET ISLAND";
    add(label, phuketCenter[0] + 0.02, phuketCenter[1]);
    if (!activeZone) {
      for (const z of zones) {
        const n = counts[z.id] ?? 0;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "zone-count";
        el.setAttribute(
          "aria-label",
          `${zoneLabel(z, locale)} · ${n} ${locale === "th" ? "รายการ" : "listings"}`,
        );
        const name = document.createElement("b");
        name.textContent = zoneLabel(z, locale);
        const badge = document.createElement("span");
        badge.textContent = `${n} ${locale === "th" ? "รายการ" : "listings"}`;
        el.append(name, badge);
        el.onclick = () => latest.current.onZone(z.id);
        add(el, z.center[0], z.center[1]);
      }
    } else {
      for (const l of listings) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "zone-pin";
        el.dataset.id = l.id;
        el.setAttribute("aria-label", locale === "th" ? l.title.th : l.title.en);
        el.setAttribute("aria-pressed", String(l.id === selectedId));
        if (l.id === selectedId) el.classList.add("is-selected");
        el.innerHTML = pinIcon(l.type);
        el.onclick = () => latest.current.onListing(l.id);
        add(el, l.location.lng, l.location.lat);
      }
    }
  }, [ready, activeZone, listings, selectedId, counts, locale]);

  return (
    <div className="zone-map">
      <div ref={container} className="zone-map-canvas" />
      {error && (
        <p className="zone-map-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
