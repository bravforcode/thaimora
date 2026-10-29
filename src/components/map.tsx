"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as LibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import {
  Polygon,
  Check,
  X,
  MapTrifold,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import {
  type PublicProperty,
  type Bounds,
  type Point,
  validatePolygon,
  parsePolygonText,
} from "@/lib/property";
import { useSettings } from "./context";
import { useLiveContent } from "@/lib/live-content";
import type { POI } from "@/lib/pois";
import { liveMode } from "@/lib/api";
type Props = {
  properties: PublicProperty[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (b: Bounds, c: Point) => void;
  onPolygon: (p: Point[]) => void;
  center?: Point;
  poi?: boolean;
  areaPoints?: Point[];
};
const EMPTY_POIS: POI[] = [];
export function PropertyMap({
  properties,
  selectedId,
  onSelect,
  onMove,
  onPolygon,
  center,
  poi = false,
  areaPoints = [],
}: Props) {
  const { locale, tr } = useSettings();
  const content = useLiveContent(poi);
  const pois = poi ? content.data.pois : EMPTY_POIS;
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    props = useRef({ properties, selectedId, onSelect, onMove, onPolygon }),
    markers = useRef<maplibregl.Marker[]>([]),
    plotMarkers = useRef<maplibregl.Marker[]>([]),
    drawingRef = useRef(false),
    pointsRef = useRef<Point[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [drawing, setDrawing] = useState(false),
    [pointCount, setPointCount] = useState(0),
    [hasPolygon, setHasPolygon] = useState(false);
  const [coordinateText, setCoordinateText] = useState(""),
    [drawError, setDrawError] = useState("");
  props.current = { properties, selectedId, onSelect, onMove, onPolygon };
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
        center: [98.326, 7.94],
        zoom: 10.5,
        maxZoom: 18,
        minZoom: 4,
        attributionControl: false,
        cooperativeGestures: true,
      });
      map.current = m;
    } catch {
      setError("The map could not start. Use the property list to continue.");
      return;
    }
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    m.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    let markerSignature = "";
    function drawMarkers() {
      const current = props.current;
      if (!m.getSource("properties")) return;
      const sourceFeatures = m.querySourceFeatures("properties");
      const signature =
        sourceFeatures
          .map((f) => JSON.stringify([f.geometry, f.properties]))
          .sort()
          .join("|") + current.selectedId;
      if (signature === markerSignature) return;
      markerSignature = signature;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      if (!m.getSource("properties")) return;
      const seen = new Set<string>();
      for (const feature of sourceFeatures) {
        const v = feature.properties;
        if (!v || feature.geometry.type !== "Point") continue;
        const id = String(v.cluster ? v.cluster_id : v.id);
        if (seen.has(id)) continue;
        seen.add(id);
        const node = document.createElement("button");
        node.type = "button";
        node.className = v.cluster
          ? "map-cluster"
          : `map-price ${current.selectedId === v.id ? "active" : ""}`;
        node.textContent = v.cluster ? String(v.point_count) : String(v.label);
        node.setAttribute(
          "aria-label",
          v.cluster ? `Show ${v.point_count} properties` : String(v.title),
        );
        node.setAttribute("aria-pressed", String(current.selectedId === v.id));
        node.onclick = () => {
          if (drawingRef.current) return;
          if (v.cluster)
            (m.getSource("properties") as GeoJSONSource)
              .getClusterExpansionZoom(Number(v.cluster_id))
              .then((zoom) =>
                m.easeTo({
                  center:
                    feature.geometry.type === "Point"
                      ? (feature.geometry.coordinates as Point)
                      : [98.33, 7.94],
                  zoom,
                }),
              );
          else current.onSelect(v.id);
        };
        markers.current.push(
          new maplibregl.Marker({ element: node })
            .setLngLat(feature.geometry.coordinates as Point)
            .addTo(m),
        );
      }
    }
    m.on("load", () => {
      m.addSource("properties", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 13,
      });
      m.addLayer({
        id: "property-source",
        type: "circle",
        source: "properties",
        paint: { "circle-opacity": 0, "circle-radius": 1 },
      });
      m.addSource("polygon", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "polygon-fill",
        type: "fill",
        source: "polygon",
        paint: { "fill-color": "#1264E8", "fill-opacity": 0.13 },
        filter: ["==", "$type", "Polygon"],
      });
      m.addLayer({
        id: "polygon-line",
        type: "line",
        source: "polygon",
        paint: { "line-color": "#1264E8", "line-width": 3 },
      });
      m.on("render", drawMarkers);
      setReady(true);
    });
    m.on("moveend", () => {
      const b = m.getBounds(),
        c = m.getCenter();
      props.current.onMove(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        [c.lng, c.lat],
      );
    });
    m.on("click", (event) => {
      if (!drawingRef.current) return;
      if (pointsRef.current.length >= 50) {
        setDrawError(
          "Use at most 50 vertices. Undo a vertex before adding another.",
        );
        return;
      }
      pointsRef.current.push([event.lngLat.lng, event.lngLat.lat]);
      setPointCount(pointsRef.current.length);
      setCoordinateText(pointsRef.current.map((p) => p.join(", ")).join("\n"));
      setDrawError("");
      renderPolygon();
    });
    function renderPolygon() {
      const points = pointsRef.current;
      (m.getSource("polygon") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features:
          points.length > 1
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry:
                    points.length > 2
                      ? {
                          type: "Polygon",
                          coordinates: [[...points, points[0]]],
                        }
                      : { type: "LineString", coordinates: points },
                },
              ]
            : [],
      });
    }
    m.on("error", () => {
      setError(
        "Map tiles are unavailable. Property search and the list still work.",
      );
    });
    return () => {
      markers.current.forEach((marker) => marker.remove());
      plotMarkers.current.forEach((marker) => marker.remove());
      plotMarkers.current = [];
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const features = properties.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.location.lng, p.location.lat],
      },
      properties: {
        id: p.id,
        title: p.title[locale],
        label:
          p.priceTHB >= 1000000
            ? `฿${(p.priceTHB / 1000000).toFixed(1)}m`
            : `฿${Math.round(p.priceTHB / 1000)}k`,
      },
    }));
    (map.current.getSource("properties") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [properties, locale, ready, selectedId]);
  useEffect(() => {
    if (ready && center)
      map.current?.flyTo({
        center,
        zoom: 12,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 600,
      });
  }, [center, ready]);
  useEffect(() => {
    if (!ready || !selectedId) return;
    const p = props.current.properties.find((p) => p.id === selectedId);
    if (p)
      map.current?.easeTo({
        center: [p.location.lng, p.location.lat],
        zoom: Math.max(13.6, map.current.getZoom()),
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 450,
      });
  }, [selectedId, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    if (m.getSource("pois")) {
      if (m.getLayer("pois")) m.removeLayer("pois");
      m.removeSource("pois");
    }
    if (poi) {
      m.addSource("pois", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: pois.map((p) => ({
            type: "Feature",
            properties: { id: p.id, name: p.name[locale] },
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          })),
        },
      });
      m.addLayer({
        id: "pois",
        source: "pois",
        type: "circle",
        paint: {
          "circle-color": "#11866F",
          "circle-radius": 7,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  }, [poi, ready, pois, locale]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;

    function clearPlots() {
      plotMarkers.current.forEach((marker) => marker.remove());
      plotMarkers.current = [];
      try {
        if (m.getLayer("plots-line")) m.removeLayer("plots-line");
        if (m.getLayer("plots-fill")) m.removeLayer("plots-fill");
        if (m.getSource("plots")) m.removeSource("plots");
      } catch {
        // Map or style may be disposing
      }
    }

    clearPlots();

    if (!selectedId) return;
    const selectedProp = properties.find((p) => p.id === selectedId);
    const plots = selectedProp?.plots;
    if (!plots || plots.length === 0) return;

    m.addSource("plots", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: plots.map((plot) => {
          const ring: Point[] = [...plot.polygon];
          if (
            ring.length > 0 &&
            (ring[0][0] !== ring[ring.length - 1][0] ||
              ring[0][1] !== ring[ring.length - 1][1])
          ) {
            ring.push(ring[0]);
          }
          return {
            type: "Feature" as const,
            properties: {
              no: plot.no,
              status: plot.status,
            },
            geometry: {
              type: "Polygon" as const,
              coordinates: [ring],
            },
          };
        }),
      },
    });

    m.addLayer({
      id: "plots-fill",
      type: "fill",
      source: "plots",
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "status"], "sold"],
          "#B8961A",
          "#F5C518",
        ],
        "fill-opacity": [
          "case",
          ["==", ["get", "status"], "sold"],
          0.45,
          0.55,
        ],
      },
    });

    m.addLayer({
      id: "plots-line",
      type: "line",
      source: "plots",
      paint: {
        "line-color": "#3B2F00",
        "line-width": 1.5,
      },
    });

    for (const plot of plots) {
      const points =
        plot.polygon.length > 3 &&
        plot.polygon[0][0] === plot.polygon[plot.polygon.length - 1][0] &&
        plot.polygon[0][1] === plot.polygon[plot.polygon.length - 1][1]
          ? plot.polygon.slice(0, -1)
          : plot.polygon;
      const avgLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
      const avgLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
      const centroid: Point = [avgLng, avgLat];

      const badgeNode = document.createElement("div");
      badgeNode.className = "plot-badge";
      badgeNode.textContent = String(plot.no);
      const badgeMarker = new maplibregl.Marker({
        element: badgeNode,
        offset: [0, -10],
      })
        .setLngLat(centroid)
        .addTo(m);
      plotMarkers.current.push(badgeMarker);

      const tagNode = document.createElement("div");
      tagNode.className =
        plot.status === "sold" ? "plot-tag is-sold" : "plot-tag";
      const baseArea = tr(plot.areaLabel.en, plot.areaLabel.th);
      tagNode.textContent =
        plot.status === "sold"
          ? `${baseArea}${tr(" (SOLD)", " (ขายแล้ว)")}`
          : baseArea;
      const tagMarker = new maplibregl.Marker({
        element: tagNode,
        offset: [0, 14],
      })
        .setLngLat(centroid)
        .addTo(m);
      plotMarkers.current.push(tagMarker);
    }

    const onZoom = () => {
      m.getContainer()?.classList.toggle(
        "plot-tags-hidden",
        m.getZoom() < 16,
      );
    };
    m.on("zoom", onZoom);
    onZoom();

    return () => {
      m.off("zoom", onZoom);
      m.getContainer()?.classList.remove(
        "plot-tags-hidden",
      );
      clearPlots();
    };
  }, [selectedId, properties, locale, ready, tr]);
  function renderArea(points: Point[]) {
    (map.current?.getSource("polygon") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features:
        points.length < 2
          ? []
          : [
              {
                type: "Feature",
                properties: {},
                geometry:
                  points.length > 2
                    ? { type: "Polygon", coordinates: [[...points, points[0]]] }
                    : { type: "LineString", coordinates: points },
              },
            ],
    });
  }
  useEffect(() => {
    if (!ready || drawingRef.current) return;
    pointsRef.current = areaPoints;
    setHasPolygon(areaPoints.length >= 3);
    renderArea(areaPoints);
  }, [areaPoints, ready]);
  function start() {
    pointsRef.current = [];
    setPointCount(0);
    drawingRef.current = true;
    setDrawing(true);
    map.current?.getCanvas().style.setProperty("cursor", "crosshair");
    onPolygon([]);
    setHasPolygon(false);
    setCoordinateText("");
    setDrawError("");
    renderArea([]);
  }
  function undo() {
    pointsRef.current = pointsRef.current.slice(0, -1);
    setPointCount(pointsRef.current.length);
    setCoordinateText(pointsRef.current.map((p) => p.join(", ")).join("\n"));
    setDrawError("");
    renderArea(pointsRef.current);
  }
  function finish(clear = false) {
    if (!clear) {
      try {
        pointsRef.current = validatePolygon(pointsRef.current);
      } catch (e) {
        setDrawError(e instanceof Error ? e.message : "Invalid search area.");
        return;
      }
    }
    drawingRef.current = false;
    setDrawing(false);
    map.current?.getCanvas().style.setProperty("cursor", "");
    if (clear) {
      pointsRef.current = [];
      (map.current?.getSource("polygon") as GeoJSONSource | undefined)?.setData(
        { type: "FeatureCollection", features: [] },
      );
      onPolygon([]);
      setHasPolygon(false);
    } else {
      renderArea(pointsRef.current);
      onPolygon(pointsRef.current);
      setHasPolygon(true);
    }
  }
  return (
    <div className="map-wrapper">
      <div
        ref={container}
        className="map-canvas"
        aria-label={tr("Property map of Phuket", "แผนที่อสังหาริมทรัพย์ภูเก็ต")}
      />
      <div className="map-tools">
        {drawing ? (
          <>
            <span>
              {tr("Click at least 3 points", "คลิกอย่างน้อย 3 จุด")} (
              {pointCount})
            </span>
            <button
              className="icon-button"
              aria-label={tr("Undo last vertex", "ยกเลิกจุดล่าสุด")}
              disabled={!pointCount}
              onClick={undo}
            >
              <ArrowCounterClockwise size={18} />
            </button>
            <button
              className="button small"
              disabled={pointCount < 3}
              onClick={() => finish()}
            >
              <Check size={16} />
              {tr("Finish area", "เสร็จสิ้น")}
            </button>
            <button
              className="icon-button"
              aria-label={tr("Cancel drawing", "ยกเลิกการวาด")}
              onClick={() => finish(true)}
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            className="map-tool"
            onClick={() => (hasPolygon ? finish(true) : start())}
          >
            <Polygon size={18} />
            {hasPolygon
              ? tr("Clear drawn area", "ล้างพื้นที่")
              : tr("Draw search area", "วาดพื้นที่ค้นหา")}
          </button>
        )}
      </div>
      {drawing && (
        <div className="polygon-editor">
          <details>
            <summary>
              {tr(
                "Enter area coordinates with the keyboard",
                "ป้อนพิกัดพื้นที่ด้วยแป้นพิมพ์",
              )}
            </summary>
            <label>
              {tr(
                "One longitude, latitude pair per line (3–50 vertices)",
                "ลองจิจูด, ละติจูดหนึ่งคู่ต่อบรรทัด (3–50 จุด)",
              )}
              <textarea
                rows={4}
                value={coordinateText}
                onChange={(e) => setCoordinateText(e.target.value)}
                placeholder={"98.30, 7.90\n98.35, 7.90\n98.35, 7.95"}
              />
            </label>
            <button
              type="button"
              className="button small"
              onClick={() => {
                try {
                  pointsRef.current = parsePolygonText(coordinateText);
                  setPointCount(pointsRef.current.length);
                  setDrawError("");
                  renderArea(pointsRef.current);
                  finish();
                } catch (e) {
                  setDrawError(
                    e instanceof Error ? e.message : "Invalid search area.",
                  );
                }
              }}
            >
              {tr("Apply area", "ใช้พื้นที่")}
            </button>
          </details>
          {drawError && <p role="alert">{drawError}</p>}
        </div>
      )}
      {poi && !liveMode && (
        <a
          className="map-places-credit"
          href={`${locale === "th" ? "/th" : ""}/guide/`}
        >
          {tr(
            "Places © OpenStreetMap · ODbL",
            "สถานที่ © OpenStreetMap · ODbL",
          )}
        </a>
      )}
      <div className="map-mode-label">
        <MapTrifold size={15} />
        {process.env.NEXT_PUBLIC_ARCGIS_API_KEY
          ? tr("Satellite", "ดาวเทียม")
          : tr(
              "Preview basemap · satellite not configured",
              "แผนที่ตัวอย่าง · ยังไม่ได้ตั้งค่าดาวเทียม",
            )}
      </div>
      {error && (
        <p className="map-error" role="status">
          {tr(error, "แผนที่ไม่พร้อมใช้งาน สามารถค้นหาจากรายการต่อได้")}
        </p>
      )}
      <span className="map-count">
        {properties.length} {tr("places to explore", "รายการให้ค้นหา")}
      </span>
    </div>
  );
}
