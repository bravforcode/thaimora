"use client";
import { LocaleLink as Link } from "./context";
import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { PropertyDetail } from "./property-detail";
import { useSettings } from "./context";
import { type PublicProperty } from "@/lib/property";
import { getProperty, api, liveMode } from "@/lib/api";
import { previewFX } from "@/lib/preview";
export function PropertyPage({ snapshot }: { snapshot: PublicProperty }) {
  const { tr } = useSettings();
  const [p, setP] = useState(snapshot),
    [error, setError] = useState(""),
    [fx, setFx] = useState<{ date: string; rates: Record<string, number> }>(
      liveMode ? { date: "unavailable", rates: { THB: 1 } } : previewFX,
    );
  useEffect(() => {
    if (liveMode) {
      getProperty(snapshot.id)
        .then(setP)
        .catch((e) => setError(e.message));
      api<{ date: string; rates: Record<string, number> }>(
        "/v1/fx?base=THB&quotes=USD,EUR,GBP,AUD,CNY,JPY",
      )
        .then(setFx)
        .catch(() => setFx({ date: "unavailable", rates: { THB: 1 } }));
    }
  }, [snapshot.id]);
  return (
    <main className="property-page" id="main">
      <Link href="/" className="back-link">
        <ArrowLeft size={18} />
        {tr("Back to the map", "กลับสู่แผนที่")}
      </Link>
      {!liveMode && (
        <p className="notice">
          {tr(
            "Synthetic preview listing. Images are illustrative; no real property is offered.",
            "รายการจำลอง ภาพประกอบเท่านั้น ไม่มีการเสนออสังหาริมทรัพย์จริง",
          )}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {tr(
            "Current listing could not be loaded. This is a saved public snapshot; status may have changed.",
            "โหลดรายการปัจจุบันไม่สำเร็จ ข้อมูลนี้เป็นข้อมูลสาธารณะที่บันทึกไว้ สถานะอาจเปลี่ยนแปลง",
          )}{" "}
          {error}
        </p>
      )}
      <PropertyDetail property={p} rates={fx.rates} fxDate={fx.date} />
    </main>
  );
}
