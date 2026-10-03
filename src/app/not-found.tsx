"use client";
import Link from "next/link";
import { useSettings } from "@/components/context";
export default function NotFound() {
  const { tr } = useSettings();
  return (
    <main id="main" className="content-page">
      <h1>{tr("This place is no longer here.", "ไม่พบรายการนี้")}</h1>
      <p>
        {tr(
          "The link may have changed or the listing may have been removed.",
          "ลิงก์อาจเปลี่ยนแปลงหรือรายการถูกลบ",
        )}
      </p>
      <Link className="button" href="/">
        {tr("Explore the map", "สำรวจแผนที่")}
      </Link>
    </main>
  );
}
