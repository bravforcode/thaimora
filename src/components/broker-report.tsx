"use client";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useSettings } from "./context";
import { BrokerApiError, brokerApi, brokerDownload, brokerLeadSchema, brokerReportSchema, type BrokerLead, type BrokerReport } from "@/lib/broker-api";
import { bangkokToday, fillDailySeries, formatResponseTime, reportWindow, type ReportPreset } from "@/lib/broker-report";

const leadPageSchema = z.object({ items: z.array(brokerLeadSchema) });
const pageSize = 50;
const presets: ReportPreset[] = [7, 30, 90];
const statuses: { value: BrokerLead["status"]; en: string; th: string }[] = [
  { value: "new", en: "New", th: "ใหม่" },
  { value: "contacted", en: "Contacted", th: "ติดต่อแล้ว" },
  { value: "closed", en: "Closed", th: "ปิดเรื่อง" },
];
type Problem = "load" | "more" | "status" | "export" | "exportLimit";

export function ReportPanel({ token }: { token: string }) {
  const { tr, locale } = useSettings();
  const [preset, setPreset] = useState<ReportPreset>(30);
  const [report, setReport] = useState<BrokerReport | null>(null);
  const [leads, setLeads] = useState<BrokerLead[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const range = reportWindow(bangkokToday(), preset);
  const query = `from=${range.from}&to=${range.to}`;
  const number = (value: number) => value.toLocaleString(locale === "th" ? "th-TH" : "en-US");
  const problemText: Record<Problem, string> = {
    load: tr("Could not load the report. Try again.", "โหลดรายงานไม่สำเร็จ ลองใหม่อีกครั้ง"),
    more: tr("Could not load more inquiries.", "โหลดคำถามเพิ่มไม่สำเร็จ"),
    status: tr("Could not save the status.", "บันทึกสถานะไม่สำเร็จ"),
    export: tr("Export failed. Try again.", "ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง"),
    exportLimit: tr("This range has more than 10,000 inquiries. Choose a shorter range.", "ช่วงนี้มีคำถามเกิน 10,000 รายการ เลือกช่วงที่สั้นลง"),
  };

  const refresh = useCallback(async () => {
    try {
      const [summary, page] = await Promise.all([
        brokerApi(`/v1/broker/reports/summary?${query}`, brokerReportSchema, token),
        brokerApi(`/v1/broker/reports/leads?${query}&limit=${pageSize}`, leadPageSchema, token),
      ]);
      setReport(summary);
      setLeads(page.items);
      setHasMore(page.items.length === pageSize);
      setProblem(null);
    } catch {
      setProblem("load");
    }
  }, [query, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changeStatus(id: string, status: BrokerLead["status"]) {
    setBusy(true);
    try {
      await brokerApi(`/v1/broker/leads/${id}`, z.unknown(), token, { status }, "PATCH");
      await refresh();
    } catch {
      setProblem("status");
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    const last = leads[leads.length - 1];
    if (!last) return;
    setBusy(true);
    try {
      const page = await brokerApi(`/v1/broker/reports/leads?${query}&limit=${pageSize}&before=${encodeURIComponent(last.createdAt)}`, leadPageSchema, token);
      setLeads(rows => [...rows, ...page.items]);
      setHasMore(page.items.length === pageSize);
    } catch {
      setProblem("more");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(kind: "leads" | "listings") {
    setBusy(true);
    try {
      const url = URL.createObjectURL(await brokerDownload(`/v1/broker/reports/export?kind=${kind}&${query}`, token));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}-${range.from}-${range.to}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setProblem(e instanceof BrokerApiError && e.code === "export_limit_exceeded" ? "exportLimit" : "export");
    } finally {
      setBusy(false);
    }
  }

  const totals = report?.totals;
  const trend = report ? fillDailySeries(report.daily, range.from, range.to) : [];
  const peak = Math.max(1, ...trend.map(row => row.views));
  const barWidth = 100 / Math.max(trend.length, 1);

  return (
    <section className="report-panel" aria-labelledby="report-title">
      <div className="report-head">
        <h2 id="report-title">{tr("Report", "รายงาน")}</h2>
        <div className="report-presets" role="group" aria-label={tr("Date range", "ช่วงเวลา")}>
          {presets.map(days => (
            <button key={days} type="button" className="button secondary" aria-pressed={preset === days} disabled={busy} onClick={() => setPreset(days)}>
              {tr(`${days} days`, `${days} วัน`)}
            </button>
          ))}
        </div>
      </div>
      <p className="report-range">{range.from} – {range.to} · {tr("Bangkok time", "เวลาประเทศไทย")}</p>
      {problem && <p className="notice error" role="alert">{problemText[problem]}</p>}

      {totals && (
        <dl className="report-kpis">
          <div><dt>{tr("Views", "การเข้าชม")}</dt><dd>{number(totals.views)}</dd></div>
          <div><dt>{tr("Inquiries", "คำถาม")}</dt><dd>{number(totals.inquiries)}</dd></div>
          <div><dt>{tr("Contact clicks", "กดติดต่อ")}</dt><dd>{number(totals.contactClicks)}</dd></div>
          <div><dt>{tr("Awaiting reply", "รอตอบ")}</dt><dd>{number(totals.newLeads)}</dd></div>
          <div><dt>{tr("Median reply time", "เวลาตอบกลับ (ค่ากลาง)")}</dt><dd>{formatResponseTime(totals.medianResponseSeconds, locale)}</dd></div>
        </dl>
      )}

      <h3>{tr("Daily views", "การเข้าชมรายวัน")}</h3>
      {report && (
        <>
          <svg className="report-trend" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={tr("Daily views chart", "กราฟการเข้าชมรายวัน")}>
            {trend.map((row, index) => {
              const height = (row.views / peak) * 36;
              return <rect key={row.day} x={index * barWidth + barWidth * 0.15} y={40 - height} width={barWidth * 0.7} height={height}><title>{`${row.day}: ${row.views}`}</title></rect>;
            })}
          </svg>
          <details>
            <summary>{tr("View as table", "ดูเป็นตาราง")}</summary>
            <div className="table-scroll">
              <table>
                <thead><tr><th>{tr("Day", "วัน")}</th><th>{tr("Views", "เข้าชม")}</th><th>{tr("Inquiries", "คำถาม")}</th><th>{tr("Contact clicks", "กดติดต่อ")}</th></tr></thead>
                <tbody>{trend.map(row => <tr key={row.day}><td>{row.day}</td><td>{number(row.views)}</td><td>{number(row.inquiries)}</td><td>{number(row.contactClicks)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <h3>{tr("Per listing", "ผลรายประกาศ")}</h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th>{tr("Listing", "ประกาศ")}</th><th>{tr("Views", "เข้าชม")}</th><th>{tr("Inquiries", "คำถาม")}</th><th>{tr("Contact clicks", "กดติดต่อ")}</th></tr></thead>
          <tbody>
            {report?.listings.map(row => (
              <tr key={row.propertyId}>
                <td>{row.title[locale]}{!row.published && <small> {tr("(not published)", "(ยังไม่เผยแพร่)")}</small>}</td>
                <td>{number(row.views)}</td><td>{number(row.inquiries)}</td><td>{number(row.contactClicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="button secondary" type="button" disabled={busy || !report} onClick={() => exportCsv("listings")}>{tr("Export listings (CSV)", "ส่งออกผลรายประกาศ (CSV)")}</button>

      <h3>{tr("Inquiries and reply status", "คำถามและสถานะการตอบ")}</h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th>{tr("From", "ผู้ติดต่อ")}</th><th>{tr("Message", "ข้อความ")}</th><th>{tr("Received", "ได้รับเมื่อ")}</th><th>{tr("Status", "สถานะ")}</th><th>{tr("Replied in", "ตอบภายใน")}</th></tr></thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id}>
                <td><strong>{lead.name}</strong><br /><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
                <td className="broker-message">{lead.message}</td>
                <td>{new Date(lead.createdAt).toLocaleString(locale === "th" ? "th-TH" : "en-GB")}</td>
                <td>
                  <select aria-label={tr("Follow-up status", "สถานะติดตาม")} value={lead.status} disabled={busy} onChange={e => changeStatus(lead.id, e.target.value as BrokerLead["status"])}>
                    {statuses.map(s => <option key={s.value} value={s.value}>{tr(s.en, s.th)}</option>)}
                  </select>
                </td>
                <td>{lead.firstResponseAt ? formatResponseTime((Date.parse(lead.firstResponseAt) - Date.parse(lead.createdAt)) / 1000, locale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report && leads.length === 0 && <p className="notice">{tr("No inquiries in this range.", "ไม่มีคำถามในช่วงนี้")}</p>}
      <div className="broker-actions">
        {hasMore && <button className="button secondary" type="button" disabled={busy} onClick={loadMore}>{tr("Load more", "โหลดเพิ่ม")}</button>}
        <button className="button secondary" type="button" disabled={busy || !report} onClick={() => exportCsv("leads")}>{tr("Export inquiries (CSV)", "ส่งออกคำถาม (CSV)")}</button>
      </div>
    </section>
  );
}
