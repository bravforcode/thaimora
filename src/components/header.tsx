"use client";
import { LocaleLink as Link } from "./context";
import { Heart, MapPin, ArrowUpRight, List } from "@phosphor-icons/react";
import { useSettings } from "./context";
import { currencies } from "@/lib/property";
export function Header() {
  const {
    locale,
    setLocale,
    currency,
    setCurrency,
    unit,
    setUnit,
    favorites,
    tr,
  } = useSettings();
  return (
    <>
      <a className="skip-link" href="#main">
        {tr("Skip to content", "ข้ามไปยังเนื้อหา")}
      </a>
      <header className="header">
        <Link className="brand" href="/" aria-label="PhuketLens home">
          <span className="brand-mark">
            <MapPin weight="fill" size={24} />
          </span>
          PhuketLens<span className="brand-dot">.</span>
        </Link>
        <nav
          className="main-nav"
          aria-label={tr("Main navigation", "เมนูหลัก")}
        >
          <Link href="/explore/?transaction=sale">{tr("Buy", "ซื้อ")}</Link>
          <Link href="/explore/?transaction=rent">{tr("Rent", "เช่า")}</Link>
          <Link href="/guide/">
            {tr("Explore Phuket", "สำรวจภูเก็ต")}
            <ArrowUpRight size={13} />
          </Link>
          <Link href="/broker/">{tr("For agents", "สำหรับนายหน้า")}</Link>
        <Link href="/owner/">{tr("For owners", "สำหรับเจ้าของทรัพย์")}</Link>
        </nav>
        <div className="header-actions">
          <Link className="header-signin" href="/dashboard/">
            {tr("Owner / agent sign-in", "เข้าสู่ระบบเจ้าของ / นายหน้า")}
          </Link>
          <Link
            className="saved-link"
            href="/explore/?favorites=1"
            aria-label={tr("Saved properties", "รายการโปรด")}
          >
            <Heart size={20} />
            <span>{tr("Saved", "รายการโปรด")}</span>
            {favorites.length > 0 && <b>{favorites.length}</b>}
          </Link>
          <label className="visually-hidden" htmlFor="language">
            {tr("Language", "ภาษา")}
          </label>
          <select
            id="language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as "en" | "th")}
          >
            <option value="en">EN</option>
            <option value="th">ไทย</option>
          </select>
          <details className="preferences">
            <summary
              aria-label={tr(
                "Currency and area settings",
                "ตั้งค่าสกุลเงินและพื้นที่",
              )}
            >
              <List size={20} />
            </summary>
            <div className="preferences-panel">
              <label>
                {tr("Currency", "สกุลเงิน")}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Area unit", "หน่วยพื้นที่")}
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as "sqm" | "sqft")}
                >
                  <option value="sqm">m²</option>
                  <option value="sqft">ft²</option>
                </select>
              </label>
              <Link href="/?transaction=sale">{tr("Buy", "ซื้อ")}</Link>
              <Link href="/?transaction=rent">{tr("Rent", "เช่า")}</Link>
              <Link href="/guide/">{tr("Explore Phuket", "สำรวจภูเก็ต")}</Link>
              <Link href="/broker/">{tr("For agents", "สำหรับนายหน้า")}</Link>
              <Link href="/owner/">{tr("For owners", "สำหรับเจ้าของทรัพย์")}</Link>
              <Link href="/admin/">
                {tr("Staff preview", "ตัวอย่างสำหรับเจ้าหน้าที่")}
              </Link>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  const { tr } = useSettings();
  return (
    <footer className="footer">
      <span>© 2026 PhuketLens</span>
      <Link href="/privacy/">{tr("Privacy", "ความเป็นส่วนตัว")}</Link>
      <Link href="/terms/">
        {tr("Terms & property disclaimer", "ข้อกำหนดและข้อจำกัด")}
      </Link>
      <Link href="/guide/">{tr("Phuket guide", "คู่มือภูเก็ต")}</Link>
      <Link href="/broker/">{tr("For agents", "สำหรับนายหน้า")}</Link>
      <Link href="/owner/">{tr("For owners", "สำหรับเจ้าของทรัพย์")}</Link>
    </footer>
  );
}
