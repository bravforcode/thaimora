"use client";
import { liveMode } from "@/lib/api";
import { useLiveContent } from "@/lib/live-content";
import { eventSourceHealth } from "@/lib/source-health";
import { useSettings } from "./context";
export function ContentFreshness({ state }: { state: ReturnType<typeof useLiveContent> }) {
  const { locale, tr: t } = useSettings();
  if (!liveMode) return null;
  const health = eventSourceHealth(state.meta);
  return <>
    {state.error && <p className="notice" role="status">{state.checkedAt ? t("Showing the last available content. Automatic updates are temporarily unavailable.", "กำลังแสดงข้อมูลล่าสุดที่ดึงได้ ระบบอัปเดตอัตโนมัติไม่พร้อมใช้งานชั่วคราว") : t("Current content could not be checked.", "ยังตรวจสอบข้อมูลปัจจุบันไม่ได้")} <button className="text-button" onClick={() => void state.retry()} disabled={state.checking}>{t("Try again", "ลองอีกครั้ง")}</button></p>}
    {state.checkedAt && <p className="muted">{t("Content last checked", "ตรวจสอบข้อมูลล่าสุด")} {new Date(state.checkedAt).toLocaleString(locale === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} ICT. {t("Source update times are shown with each record.", "เวลาอัปเดตจากแหล่งข้อมูลแสดงในแต่ละรายการ")}</p>}
    {health === "disconnected" && <p className="notice">{t("No automatic event source is connected. Only confirmed published events are shown.", "ยังไม่ได้เชื่อมแหล่งกิจกรรมอัตโนมัติ แสดงเฉพาะกิจกรรมที่ยืนยันและเผยแพร่แล้ว")}</p>}
    {(health === "error" || health === "awaiting") && <p className="notice">{t("An event source has not refreshed successfully. Some events may be missing. Confirm updates with the organizer.", "แหล่งข้อมูลกิจกรรมยังอัปเดตไม่สำเร็จ อาจมีกิจกรรมที่ยังไม่แสดง โปรดยืนยันข้อมูลล่าสุดกับผู้จัด")}</p>}
  </>;
}
