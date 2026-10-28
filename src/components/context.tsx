"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Script from "next/script";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type Locale, savedPropertyIds } from "@/lib/property";
type Settings = {
  locale: Locale;
  setLocale: (v: Locale) => void;
  currency: string;
  setCurrency: (v: string) => void;
  unit: "sqm" | "sqft";
  setUnit: (v: "sqm" | "sqft") => void;
  favorites: string[];
  measurementConsent: boolean;
  toggleFavorite: (id: string) => void;
  tr: (en: string, th: string) => string;
};
const Context = createContext<Settings | null>(null);
export function useSettings() {
  const value = useContext(Context);
  if (!value) throw new Error("Settings provider missing");
  return value;
}
export function LocaleLink({
  href,
  prefetch = false,
  ...props
}: React.ComponentProps<typeof NextLink>) {
  const { locale } = useSettings();
  const localized =
    typeof href === "string" &&
    href.startsWith("/") &&
    !href.startsWith("/th/") &&
    href !== "/th" &&
    locale === "th"
      ? `/th${href}`
      : href;
  if (
    typeof localized === "string" &&
    /^\/(?:th\/)?(broker|owner|admin)(?:\/|$)/.test(localized)
  )
    return (
      <a
        href={localized}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      />
    );
  return <NextLink href={localized} prefetch={prefetch} {...props} />;
}
export function SettingsProvider({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    routeLocale: Locale =
      path.startsWith("/th/") || path === "/th" ? "th" : "en";
  const accountRoute = /^\/(?:th\/)?broker(?:\/|$)/.test(path);
  const [locale, setLocaleState] = useState<Locale>(routeLocale),
    [currency, setCurrencyState] = useState("THB"),
    [unit, setUnitState] = useState<"sqm" | "sqft">("sqm"),
    [favorites, setFavorites] = useState<string[]>([]),
    [consent, setConsent] = useState<string | null>(null),
    [cookiesOpen, setCookiesOpen] = useState(false);
  useEffect(() => {
    try {
      if (
        location.pathname === "/" &&
        localStorage.getItem("thaimora-language") === "th"
      )
        router.replace(`/th/${location.search}`);
      setCurrencyState(localStorage.getItem("thaimora-currency") || "THB");
      setUnitState(
        localStorage.getItem("thaimora-unit") === "sqft" ? "sqft" : "sqm",
      );
      setFavorites(
        savedPropertyIds(JSON.parse(localStorage.getItem("thaimora-favorites") || "[]")),
      );
      const saved = localStorage.getItem("thaimora-consent");
      setConsent(saved);
      setCookiesOpen(!saved);
    } catch {
      setCookiesOpen(true);
    }
  }, [router]);
  useEffect(() => setLocaleState(routeLocale), [routeLocale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function setLocale(v: Locale) {
    setLocaleState(v);
    localStorage.setItem("thaimora-language", v);
    const clean = path.replace(/^\/th(?=\/|$)/, "") || "/";
    if(accountRoute) {
      // A fresh document keeps account-link tokens away from public-page analytics.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${v === "th" ? "/th" : ""}${clean}${location.search}${location.hash}`);
      return;
    }
    router.push(
      `${v === "th" ? "/th" : ""}${clean}${location.search}${location.hash}`,
    );
  }
  function setCurrency(v: string) {
    setCurrencyState(v);
    localStorage.setItem("thaimora-currency", v);
  }
  function setUnit(v: "sqm" | "sqft") {
    setUnitState(v);
    localStorage.setItem("thaimora-unit", v);
  }
  function toggleFavorite(id: string) {
    setFavorites((v) => {
      const next = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
      localStorage.setItem("thaimora-favorites", JSON.stringify(next));
      return next;
    });
  }
  function decide(v: string) {
    localStorage.setItem("thaimora-consent", v);
    setConsent(v);
    setCookiesOpen(false);
    if (v === "rejected") {
      const w = window as unknown as Record<string, unknown>;
      if (process.env.NEXT_PUBLIC_GA4_ID)
        w[`ga-disable-${process.env.NEXT_PUBLIC_GA4_ID}`] = true;
      document.cookie.split(";").forEach((c) => {
        const name = c.trim().split("=")[0];
        if (name.startsWith("_ga")) {
          document.cookie = `${name}=; Max-Age=0; path=/`;
          document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
        }
      });
    }
  }
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        currency,
        setCurrency,
        unit,
        setUnit,
        favorites,
        measurementConsent: consent === "accepted" && !accountRoute,
        toggleFavorite,
        tr: (en, th) => (locale === "th" ? th : en),
      }}
    >
      {children}
      <button className="cookie-settings" onClick={() => setCookiesOpen(true)}>
        {locale === "th" ? "คุกกี้" : "Cookie settings"}
      </button>
      {cookiesOpen && (
        <aside
          className="cookie-banner"
          aria-label={
            locale === "th" ? "การตั้งค่าคุกกี้" : "Cookie preferences"
          }
        >
          <div>
            <strong>
              {locale === "th"
                ? "คุณเลือกความเป็นส่วนตัวได้"
                : "Your privacy, your choice"}
            </strong>
            <p>
              {locale === "th"
                ? "เราใช้พื้นที่จัดเก็บที่จำเป็นสำหรับภาษา รายการโปรด และเซสชันบัญชี การวิเคราะห์จะเปิดใช้เมื่อคุณยินยอมเท่านั้น"
                : "Essential storage remembers your language, saved homes and account session. Analytics runs only with your permission."}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => decide("rejected")}
          >
            {locale === "th" ? "ปฏิเสธทั้งหมด" : "Reject optional"}
          </button>
          <button className="button" onClick={() => decide("accepted")}>
            {locale === "th" ? "ยอมรับการวิเคราะห์" : "Accept analytics"}
          </button>
        </aside>
      )}
      {consent === "accepted" && !accountRoute && process.env.NEXT_PUBLIC_GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4"
            strategy="afterInteractive"
          >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window['ga-disable-${process.env.NEXT_PUBLIC_GA4_ID}']=false;gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA4_ID}',{anonymize_ip:true});`}</Script>
        </>
      )}
    </Context.Provider>
  );
}
