"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { demoProperties } from "@/lib/demo";
import {
  inquirySchema,
  priceLabel,
  type Inquiry,
  type PublicProperty,
} from "@/lib/property";
import { LocaleLink, useSettings } from "./context";

const storedInquirySchema = inquirySchema.extend({
  id: z.string(),
  createdAt: z.string(),
  deliveryStatus: z.enum(["local_preview", "sent", "pending_retry"]),
});
const sampleListings = demoProperties.slice(0, 6);
const statusNames: Record<PublicProperty["status"], [string, string]> = {
  available: ["Available", "พร้อมขาย/เช่า"],
  sold: ["Sold", "ขายแล้ว"],
  rented: ["Rented", "เช่าแล้ว"],
};

function readInquiries(): Inquiry[] {
  try {
    const rows = z
      .array(z.unknown())
      .parse(JSON.parse(localStorage.getItem("thaimora-inquiries") || "[]"));
    return rows.flatMap((row) => {
      const parsed = storedInquirySchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function BrokerDemoDesk() {
  const { tr } = useSettings();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  useEffect(() => setInquiries(readInquiries()), []);
  const available = sampleListings.filter((p) => p.status === "available");
  return (
    <>
      <section
        className="broker-stats"
        aria-label={tr("Sample listing statistics", "สถิติประกาศตัวอย่าง")}
      >
        {[
          [tr("Sample listings", "ประกาศตัวอย่าง"), sampleListings.length],
          [tr("Available", "พร้อมขาย/เช่า"), available.length],
          [tr("Inquiries on this device", "คำถามในอุปกรณ์นี้"), inquiries.length],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>
      <section className="broker-desk">
        <h2>{tr("Sample properties", "ทรัพย์ตัวอย่าง")}</h2>
        <p>
          {tr(
            "Synthetic listings from the preview data set. Editing, publication review and exact coordinates open after broker accounts are connected.",
            "ประกาศจำลองจากชุดข้อมูลตัวอย่าง การแก้ไข การตรวจสอบก่อนเผยแพร่ และพิกัดจริงจะเปิดหลังเชื่อมบัญชีนายหน้า",
          )}
        </p>
        <div className="broker-listings">
          {sampleListings.map((p) => (
            <DemoListing key={p.id} p={p} />
          ))}
        </div>
      </section>
      <section className="broker-desk">
        <h2>{tr("Inquiries sent from this device", "คำถามที่ส่งจากอุปกรณ์นี้")}</h2>
        <p>
          {tr(
            "Preview inquiries stay in this browser. No email was sent and no broker was contacted.",
            "คำถามตัวอย่างเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ได้ส่งอีเมลหรือติดต่อนายหน้า",
          )}
        </p>
        {inquiries.length === 0 && (
          <p className="notice">
            {tr(
              "No inquiries yet. Send one from a property page to see it here.",
              "ยังไม่มีคำถาม ส่งคำถามจากหน้าทรัพย์เพื่อดูที่นี่",
            )}
          </p>
        )}
        <div className="broker-leads">
          {inquiries.map((lead) => (
            <DemoLead key={lead.id} lead={lead} />
          ))}
        </div>
      </section>
    </>
  );
}

function DemoListing({ p }: { p: PublicProperty }) {
  const { tr, locale } = useSettings();
  const [statusEn, statusTh] = statusNames[p.status];
  return (
    <article>
      <h3>{p.title[locale]}</h3>
      <p>
        {p.zone} · {priceLabel(p, locale)}
        {p.transaction === "rent" && tr(" / month", " / เดือน")}
      </p>
      <p>
        {tr("Status", "สถานะ")}: {tr(statusEn, statusTh)}
      </p>
      <LocaleLink href={`/property/${p.slug}/`}>
        {tr("Open public page", "เปิดหน้าทรัพย์สาธารณะ")}
      </LocaleLink>
    </article>
  );
}

function DemoLead({ lead }: { lead: Inquiry }) {
  const { tr, locale } = useSettings();
  const property = demoProperties.find((p) => p.id === lead.propertyId);
  return (
    <article>
      <h3>{lead.name}</h3>
      <p>
        {lead.country} ·{" "}
        {new Date(lead.createdAt).toLocaleString(
          locale === "th" ? "th-TH" : "en-GB",
        )}
      </p>
      <p>
        {tr("About", "เรื่อง")}:{" "}
        {property?.title[locale] ?? tr("Unknown property", "ไม่พบทรัพย์")}
      </p>
      <p>{lead.email}</p>
      <p className="broker-message">{lead.message}</p>
    </article>
  );
}
