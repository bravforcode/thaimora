"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { protectedSourceRecord } from "@/lib/content-automation";
import { paginate } from "@/lib/pagination";
import { useSettings } from "./context";
type Row = Record<string, unknown>;
export function ContentAutomation({ token }: { token: string }) {
  const { locale, tr } = useSettings();
  const [kind, setKind] = useState<"pois" | "events">("pois");
  const [rows, setRows] = useState<Row[]>([]);
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 12_000);
    setRows([]); setPage(0); setError(""); setBusy(true);
    api<{ items: Row[] }>(`/v1/admin/${kind}?protected=true`, { signal: controller.signal }, token)
      .then(result => { if (!controller.signal.aborted) setRows(result.items.filter(protectedSourceRecord)); })
      .catch(() => { if (active) setError("Protected records could not be loaded."); })
      .finally(() => { clearTimeout(deadline); if (active) setBusy(false); });
    return () => { active = false; clearTimeout(deadline); controller.abort(); };
  }, [kind, token, version]);
  async function release(row: Row) {
    if (busy || !protectedSourceRecord(row)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/v1/admin/${kind}/${encodeURIComponent(String(row.id))}/automation`, { method: "POST", body: JSON.stringify({ enabled: true }), signal: AbortSignal.timeout(12_000) }, token);
      setRows(current => current.filter(item => item.id !== row.id));
      setMessage(tr("Protection removed. A configured, enabled source may replace the record on its next successful sync.", "ยกเลิกการป้องกันแล้ว แหล่งข้อมูลที่ตั้งค่าและเปิดใช้งานอาจแทนที่รายการในการอัปเดตที่สำเร็จครั้งถัดไป"));
    } catch { setError(tr("The change could not be confirmed. Reload the records to check the current status.", "ยังยืนยันการเปลี่ยนแปลงไม่ได้ โหลดรายการใหม่เพื่อตรวจสอบสถานะปัจจุบัน")); }
    finally { setBusy(false); }
  }
  const directory = paginate(rows, page);
  return <section className="admin-import">
    <h2>{tr("Automatic content updates", "การอัปเดตเนื้อหาอัตโนมัติ")}</h2>
    <p>{tr("Manual changes protect a source record from replacement. Removing protection allows an enabled source to replace it on its next successful sync. A disabled source will not sync until it is configured and enabled.", "การแก้ไขด้วยตนเองป้องกันแหล่งข้อมูลแทนที่รายการ การยกเลิกการป้องกันอนุญาตให้แหล่งข้อมูลที่เปิดใช้งานแทนที่รายการในการอัปเดตที่สำเร็จครั้งถัดไป แหล่งข้อมูลที่ปิดอยู่จะยังไม่อัปเดตจนกว่าจะตั้งค่าและเปิดใช้งาน")}</p>
    <label>{tr("Content type", "ประเภทเนื้อหา")} <select value={kind} disabled={busy} onChange={event => { setKind(event.target.value as "pois" | "events"); setMessage(""); }}><option value="pois">{tr("Places", "สถานที่")}</option><option value="events">{tr("Events", "กิจกรรม")}</option></select></label>{" "}
    <button className="button secondary" disabled={busy} onClick={() => setVersion(current => current + 1)}>{tr("Reload records", "โหลดรายการใหม่")}</button>
    {busy && <p role="status">{tr("Loading…", "กำลังโหลด…")}</p>}
    {error && <p className="notice error" role="alert">{error === "Protected records could not be loaded." ? tr(error, "โหลดรายการที่ป้องกันไว้ไม่ได้") : error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>{tr("Protected source record", "รายการจากแหล่งข้อมูลที่ป้องกันไว้")}</th><th>{tr("Action", "คำสั่ง")}</th></tr></thead><tbody>{directory.items.map(row => {
      const name = row.name as { en?: string; th?: string } | undefined;
      return <tr key={String(row.id)}><td>{name?.[locale] ?? String(row.id)} · {String(row.source)}</td><td><button className="button secondary" disabled={busy} onClick={() => void release(row)}>{tr("Return to automatic updates", "กลับไปอัปเดตอัตโนมัติ")}</button></td></tr>;
    })}</tbody></table></div>
    {!busy && !error && !rows.length && <p>{tr("No protected source records.", "ไม่มีรายการจากแหล่งข้อมูลที่ป้องกันไว้")}</p>}
    <nav aria-label={tr("Protected record pages", "หน้ารายการที่ป้องกันไว้")}><p role="status">{directory.start}–{directory.end} / {directory.total}</p><button className="button secondary" disabled={directory.page === 0 || busy} onClick={() => setPage(directory.page - 1)}>{tr("Previous page", "หน้าก่อนหน้า")}</button>{" "}<button className="button secondary" disabled={directory.page + 1 >= directory.pageCount || busy} onClick={() => setPage(directory.page + 1)}>{tr("Next page", "หน้าถัดไป")}</button></nav>
  </section>;
}
