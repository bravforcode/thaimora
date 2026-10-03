"use client";
import { LocaleLink as Link } from "./context";
import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin, Waves, Buildings } from "@phosphor-icons/react";
import { useSettings } from "./context";
import { useLiveContent } from "@/lib/live-content";
import { currentEvents } from "@/lib/public-content-client";
import { useEventClock } from "@/lib/use-public-content";
import { ContentFreshness } from "./content-freshness";
import { paginate } from "@/lib/pagination";
import { SourceNotes } from "./source-notes";
import { liveMode } from "@/lib/api";
type Kind = "privacy" | "terms" | "guide" | "credits";
export function ContentPage({
  kind,
  approvedCopy,
}: {
  kind: Kind;
  approvedCopy?: { en: string; th: string };
}) {
  const { locale, tr } = useSettings();
  const state = useLiveContent(kind === "guide");
  const content = state.data;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [content.pois]);
  const directory = paginate(content.pois, page);
  const now = useEventClock(content.events);
  const events = now ? currentEvents(content.events, now) : [];
  if (approvedCopy && (kind === "terms" || kind === "privacy"))
    return (
      <main id="main" className="content-page">
        <span className="eyebrow">THAIMORA / {kind.toUpperCase()}</span>
        <h1>
          {kind === "privacy"
            ? tr("Privacy notice", "ประกาศความเป็นส่วนตัว")
            : tr("Terms & property disclaimer", "ข้อกำหนดและข้อจำกัด")}
        </h1>
        <div className="approved-legal" style={{ whiteSpace: "pre-wrap" }}>
          {approvedCopy[locale]}
        </div>
      </main>
    );
  return (
    <main id="main" className="content-page">
      <span className="eyebrow">THAIMORA / {kind.toUpperCase()}</span>
      <h1>
        {kind === "privacy"
          ? tr("Your privacy matters.", "ความเป็นส่วนตัวของคุณสำคัญ")
          : kind === "terms"
            ? tr("Know before you inquire.", "ข้อมูลก่อนการสอบถาม")
            : kind === "credits"
              ? tr("A view of Phuket.", "ภาพบรรยากาศภูเก็ต")
              : tr("Get to know Phuket.", "ทำความรู้จักภูเก็ต")}
      </h1>
      {kind === "guide" ? (
        <>
          <p className="content-intro">
            {tr(
              "Beaches, neighbourhoods, and everyday places. Explore what surrounds your next home.",
              "ชายหาด ย่านที่อยู่อาศัย และสถานที่ในชีวิตประจำวัน สำรวจสิ่งรอบบ้านหลังใหม่ของคุณ",
            )}
          </p>
          <div className="guide-photo">
            <img
              src="/images/phuket-coast.jpg"
              alt={tr("Banana Beach, Phuket", "หาดกล้วย ภูเก็ต")}
            />
            <span>
              Anton Zelenov · CC BY-SA 4.0 ·{" "}
              <Link href="/credits/">{tr("Image credits", "เครดิตภาพ")}</Link>
            </span>
          </div>
          {!liveMode && (
            <p className="notice">
              {tr(
                "Preview guide. Public places are sourced from OpenStreetMap. Distances to synthetic property areas are illustrative; no field survey is claimed.",
                "คู่มือตัวอย่าง ข้อมูลสถานที่มาจาก OpenStreetMap ระยะทางถึงพื้นที่อสังหาริมทรัพย์จำลองเป็นการประมาณ ไม่ได้อ้างว่าเป็นผลสำรวจภาคสนาม",
              )}
            </p>
          )}
          {state.error && !liveMode && (
            <p role="alert" className="notice error">
              {state.error}
            </p>
          )}
          <ContentFreshness state={state} />
          {!liveMode && (
            <p className="data-credit">
              {tr(
                "Place data © OpenStreetMap contributors · ODbL 1.0.",
                "ข้อมูลสถานที่ © ผู้ร่วมสร้าง OpenStreetMap · ODbL 1.0",
              )}{" "}
              <a href="https://www.openstreetmap.org/copyright">
                {tr("License and attribution", "ใบอนุญาตและเครดิต")}
              </a>{" "}
              ·{" "}
              <a href="/data/osm-phuket-pois.json" download>
                {tr(
                  "Download independent place extract",
                  "ดาวน์โหลดข้อมูลสถานที่แยกต่างหาก",
                )}
              </a>
            </p>
          )}
          <div className="guide-places">
            {directory.items.map((p) => (
              <article key={p.id}>
                <div className="guide-icon">
                  {p.category === "Beach" ? (
                    <Waves size={26} />
                  ) : p.category === "Culture" ? (
                    <Buildings size={26} />
                  ) : (
                    <MapPin size={26} />
                  )}
                </div>
                <h2>{p.name[locale]}</h2>
                <p>{p.category}</p>
                <SourceNotes value={p} />
                <a
                  href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("See on map", "ดูบนแผนที่")}
                  <ArrowUpRight size={16} />
                </a>
              </article>
            ))}
          </div>
          <nav aria-label={tr("Place directory pages", "หน้ารายการสถานที่")}>
            <p role="status">{directory.start}–{directory.end} {tr("of", "จาก")} {directory.total} {tr("places", "สถานที่")}</p>
            <button className="button secondary" disabled={directory.page === 0} onClick={() => setPage(directory.page - 1)}>{tr("Previous page", "หน้าก่อนหน้า")}</button>{" "}
            <button className="button secondary" disabled={directory.page + 1 >= directory.pageCount} onClick={() => setPage(directory.page + 1)}>{tr("Next page", "หน้าถัดไป")}</button>
          </nav>
          <h2>{tr("What’s happening nearby", "กิจกรรมในพื้นที่")}</h2>
          {events.length ? (
            events.map((e) => (
              <div key={e.id}>
                <p>
                  {e.title[locale]} · {e.date}
                  {e.sourceUrl && (
                    <a href={e.sourceUrl}> {tr("Source", "แหล่งข้อมูล")}</a>
                  )}
                </p>
                <SourceNotes value={e} />
              </div>
            ))
          ) : (
            <p className="muted">
              {tr(
                "No verified upcoming events have been published.",
                "ยังไม่มีกิจกรรมที่ได้รับการยืนยันเผยแพร่",
              )}
            </p>
          )}
        </>
      ) : kind === "credits" ? (
        <>
          <p>
            {tr(
              "These photographs illustrate Phuket. They do not depict the synthetic properties shown in this preview.",
              "ภาพถ่ายเหล่านี้แสดงบรรยากาศภูเก็ต ไม่ใช่ภาพอสังหาริมทรัพย์จำลองที่แสดงในตัวอย่างนี้",
            )}
          </p>
          <ul className="credit-list">
            <li>
              <strong>Banana Beach, Phuket (2017)</strong> — Anton Zelenov.{" "}
              <a href="https://commons.wikimedia.org/wiki/File:Banana_beach_Phuket_2017_-_01.jpg">
                Wikimedia Commons
              </a>{" "}
              ·{" "}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/">
                CC BY-SA 4.0
              </a>
              . {tr("Resized for web display.", "ปรับขนาดเพื่อแสดงบนเว็บไซต์")}
            </li>
            <li>
              <strong>House with shrine, Phuket (2021)</strong> — Sharon Hahn
              Darlin.{" "}
              <a href="https://commons.wikimedia.org/wiki/File:Phuket,_Thailand_December_2021_-_House_with_shrine.jpg">
                Wikimedia Commons
              </a>{" "}
              ·{" "}
              <a href="https://creativecommons.org/licenses/by/2.0/">
                CC BY 2.0
              </a>
              . {tr("Resized for web display.", "ปรับขนาดเพื่อแสดงบนเว็บไซต์")}
            </li>
          </ul>
        </>
      ) : (
        <>
          <p className="notice">
            {tr(
              "Preview notice · Client-approved legal wording is required before launch. This page describes the preview’s behaviour and is not legal advice.",
              "ประกาศสำหรับตัวอย่าง ต้องได้รับอนุมัติข้อความทางกฎหมายจากลูกค้าก่อนเปิดใช้งาน หน้านี้อธิบายการทำงานของตัวอย่าง ไม่ใช่คำแนะนำทางกฎหมาย",
            )}
          </p>
          {kind === "privacy" ? (
            <>
              <h2>
                {tr("What this preview stores", "ข้อมูลที่ตัวอย่างนี้จัดเก็บ")}
              </h2>
              <p>
                {tr(
                  "Language, currency, units, saved properties, and your analytics choice are stored on this device. Preview inquiries and staff edits stay in local browser storage and are not emailed. You can clear them using your browser’s site-data controls.",
                  "ภาษา สกุลเงิน หน่วย รายการโปรด และการเลือกการวิเคราะห์จะเก็บในอุปกรณ์นี้ คำถามและการแก้ไขของเจ้าหน้าที่ในตัวอย่างจะอยู่ในเบราว์เซอร์และไม่ส่งอีเมล คุณสามารถล้างข้อมูลจากการตั้งค่าข้อมูลเว็บไซต์ของเบราว์เซอร์",
                )}
              </p>
              <h2>{tr("Optional analytics", "การวิเคราะห์แบบเลือกได้")}</h2>
              <p>
                {tr(
                  "Google Analytics is loaded only after you select Accept analytics. Reject optional leaves analytics off. Use Cookie settings to change or withdraw your choice.",
                  "Google Analytics จะโหลดหลังจากเลือกยอมรับการวิเคราะห์เท่านั้น การปฏิเสธจะไม่เปิดการวิเคราะห์ ใช้การตั้งค่าคุกกี้เพื่อเปลี่ยนหรือถอนความยินยอม",
                )}
              </p>
              <h2>
                {tr("Maps and direct contact", "แผนที่และการติดต่อโดยตรง")}
              </h2>
              <p>
                {tr(
                  "The map requests tiles from OpenStreetMap, or the configured licensed satellite provider. These providers receive ordinary browser network data. Links to LINE and WhatsApp open their services and are governed by their own policies.",
                  "แผนที่ขอข้อมูลจาก OpenStreetMap หรือผู้ให้บริการดาวเทียมที่ตั้งค่าและมีสิทธิ์ใช้งาน ผู้ให้บริการเหล่านี้ได้รับข้อมูลเครือข่ายของเบราว์เซอร์ตามปกติ ลิงก์ LINE และ WhatsApp จะเปิดบริการของผู้ให้บริการและใช้นโยบายของบริการนั้น",
                )}
              </p>
            </>
          ) : (
            <>
              <h2>{tr("Listing information", "ข้อมูลรายการ")}</h2>
              <p>
                {tr(
                  "All 30 preview listings are synthetic. Prices, descriptions, ownership labels, and amenities are examples, not verified property facts. Do not use them to make a purchase or rental decision.",
                  "รายการตัวอย่างทั้ง 30 รายการเป็นข้อมูลจำลอง ราคา รายละเอียด กรรมสิทธิ์ และสิ่งอำนวยความสะดวกเป็นเพียงตัวอย่าง ไม่ใช่ข้อมูลอสังหาริมทรัพย์ที่ยืนยันแล้ว ห้ามใช้เพื่อประกอบการตัดสินใจซื้อหรือเช่า",
                )}
              </p>
              <h2>{tr("Independent advice", "คำแนะนำจากผู้เชี่ยวชาญ")}</h2>
              <p>
                {tr(
                  "Ownership eligibility, contracts, taxes, visas, and due diligence depend on individual circumstances. Seek independent qualified advice and verify property details with the owner before agreeing to a transaction. Thaimora does not provide legal or financial advice.",
                  "สิทธิในการถือครอง สัญญา ภาษี วีซ่า และการตรวจสอบขึ้นอยู่กับสถานการณ์ของแต่ละบุคคล ควรขอคำแนะนำจากผู้เชี่ยวชาญอิสระและตรวจสอบข้อมูลกับเจ้าของก่อนทำธุรกรรม Thaimora ไม่ให้คำแนะนำทางกฎหมายหรือการเงิน",
                )}
              </p>
              <h2>{tr("Location and currency", "ตำแหน่งและสกุลเงิน")}</h2>
              <p>
                {tr(
                  "Map pins may show an approximate public area within 300 metres. Currency conversions are approximate and show their rate date. The THB listing price is the reference amount.",
                  "หมุดแผนที่อาจแสดงพื้นที่โดยประมาณภายใน 300 เมตร การแปลงสกุลเงินเป็นค่าประมาณพร้อมวันที่อัตราแลกเปลี่ยน ราคาที่ระบุเป็นเงินบาทใช้เป็นราคาอ้างอิง",
                )}
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}
