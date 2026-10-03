"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { useSettings } from "./context";
export function AdminMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const { tr } = useSettings();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    marker = useRef<maplibregl.Marker | null>(null),
    change = useRef(onChange);
  const [error, setError] = useState("");
  change.current = onChange;
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    try {
      const m = new maplibregl.Map({
        container: container.current,
        center: [lng, lat],
        zoom: 13,
        style: {
          version: 8,
          sources: {
            base: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
            },
          },
          layers: [{ id: "base", type: "raster", source: "base" }],
        },
      });
      const pin = new maplibregl.Marker({ draggable: true, color: "#1264E8" })
        .setLngLat([lng, lat])
        .addTo(m);
      pin
        .getElement()
        .setAttribute(
          "aria-label",
          "Property location pin; use coordinate inputs for keyboard editing",
        );
      pin.on("dragend", () => {
        const point = pin.getLngLat();
        change.current(point.lat, point.lng);
      });
      m.on("error", () =>
        setError("The map is unavailable. Use the coordinate inputs below."),
      );
      map.current = m;
      marker.current = pin;
      return () => {
        pin.remove();
        m.remove();
        map.current = null;
        marker.current = null;
      };
    } catch {
      setError("The map is unavailable. Use the coordinate inputs below.");
    }
    // Initial map lifecycle is independent of coordinate edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    )
      marker.current?.setLngLat([lng, lat]);
  }, [lat, lng]);
  return (
    <div className="admin-location-map">
      <div ref={container} className="admin-map-canvas" />
      <p className="muted">
        {tr(
          "Drag the pin or enter coordinates below. Staff coordinates stay private until authorized publication.",
          "ลากหมุดหรือป้อนพิกัดด้านล่าง พิกัดเจ้าหน้าที่เป็นข้อมูลส่วนตัวจนกว่าจะอนุญาตให้เผยแพร่",
        )}
      </p>
      {error && (
        <p role="status" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
