"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Buildings, House, Storefront, UserCircle } from "@phosphor-icons/react";
import { LocaleLink as Link, useSettings } from "./context";
import { previewFX } from "@/lib/demo";
import { type HomeListing } from "@/lib/listings";
import {
  type PublishedListing,
  usePublished,
} from "@/lib/published";
import { readStore, writeStore } from "@/lib/store";
import { priceLabel, type Locale, type PublicProperty } from "@/lib/property";
import { countByZone, zoneLabel, zones } from "@/lib/zones";

type Role = "owner" | "agent";
type Session = { role: Role; name: string };
type ListingInput = {
  title: string;
  zone: string;
  type: PublicProperty["type"];
  transaction: PublicProperty["transaction"];
  priceTHB: number;
  beds: number;
  baths: number;
  areaM2: number;
};
type Draft = ListingInput & { id: string };

type PriceOf = (p: Pick<PublicProperty, "priceTHB" | "transaction">) => string;

const SESSION_KEY = "phuketlens.demo.session";
const MEMBERSHIP_KEY = "phuketlens.demo.membership";
const DRAFTS_KEY = "phuketlens.demo.drafts";
const IDENTITY_KEY = "phuketlens.demo.identity";
const AGENT_PRICE_USD = 25;
const ID_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ID_MAX_BYTES = 5 * 1024 * 1024;

const types = ["villa", "condo", "house", "townhouse", "land"] as const;

function areaName(zoneName: string, locale: Locale) {
  const zone = zones.find((z) => z.en === zoneName);
  return zone ? zoneLabel(zone, locale) : zoneName;
}

// Form numbers are clamped to a non-negative range before they are stored.
const clamp = (value: string, max: number) =>
  Math.min(max, Math.max(0, Number(value) || 0));

export function PhuketDashboard({ listings }: { listings: HomeListing[] }) {
  const { locale, tr, currency } = useSettings();
  const [ready, setReady] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [membership, setMembership] = useState(false),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [identity, setIdentity] = useState(false);
  const { items: published, publish } = usePublished();

  useEffect(() => {
    setSession(readStore<Session | null>(SESSION_KEY, null));
    setMembership(readStore<boolean>(MEMBERSHIP_KEY, false));
    setDrafts(readStore<Draft[]>(DRAFTS_KEY, []));
    setIdentity(readStore<boolean>(IDENTITY_KEY, false));
    setReady(true);
  }, []);

  const signIn = (role: Role, name: string) => {
    const next: Session = {
      role,
      name:
        name.trim() ||
        (role === "owner" ? tr("Owner", "เจ้าของ") : tr("Agent", "นายหน้า")),
    };
    setSession(next);
    writeStore(SESSION_KEY, next);
  };
  const signOut = () => {
    setSession(null);
    writeStore(SESSION_KEY, null);
  };
  const toggleMembership = () => {
    const next = !membership;
    setMembership(next);
    writeStore(MEMBERSHIP_KEY, next);
  };
  const addDraft = (draft: ListingInput) => {
    const next = [{ ...draft, id: `draft-${Date.now()}` }, ...drafts];
    setDrafts(next);
    writeStore(DRAFTS_KEY, next);
  };
  // Only the fact that a file was received is kept; the file itself is never stored.
  const markIdentity = (received: boolean) => {
    setIdentity(received);
    writeStore(IDENTITY_KEY, received);
  };

  const priceOf: PriceOf = (p) =>
    priceLabel(p, locale, currency, previewFX.rates) +
    (p.transaction === "rent" ? tr(" / month", " / เดือน") : "");

  if (!ready)
    return (
      <main id="main" className="dash">
        <p className="muted">{tr("Loading…", "กำลังโหลด…")}</p>
      </main>
    );

  return (
    <main id="main" className="dash">
      <header className="dash-head">
        <div>
          <span className="eyebrow">
            {tr("Demo preview", "ตัวอย่างการใช้งาน")}
          </span>
          <h1>
            {session
              ? session.role === "owner"
                ? tr("Owner dashboard", "แดชบอร์ดเจ้าของ")
                : tr("Agent dashboard", "แดชบอร์ดนายหน้า")
              : tr("Owner or agent sign-in", "เข้าสู่ระบบเจ้าของ / นายหน้า")}
          </h1>
          <p className="muted">
            {tr(
              "No account is created and no payment is taken in this preview. Data stays in this browser.",
              "ตัวอย่างนี้ไม่สร้างบัญชีและไม่รับชำระเงิน ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น",
            )}
          </p>
        </div>
        {session && (
          <button type="button" className="button ghost" onClick={signOut}>
            {tr("Sign out", "ออกจากระบบ")}
          </button>
        )}
      </header>

      {!session && (
        <SignIn onSignIn={signIn} />
      )}

      {session?.role === "owner" && (
        <OwnerView
          name={session.name}
          drafts={drafts}
          listings={listings}
          identity={identity}
          onIdentity={markIdentity}
          onDraft={addDraft}
          priceOf={priceOf}
        />
      )}

      {session?.role === "agent" && (
        <AgentView
          name={session.name}
          membership={membership}
          onToggleMembership={toggleMembership}
          published={published}
          onPublish={(input) => publish({ ...input, agent: session.name })}
          priceOf={priceOf}
        />
      )}
    </main>
  );
}

function SignIn({
  onSignIn,
}: {
  onSignIn: (role: Role, name: string) => void;
}) {
  const { tr } = useSettings();
  const [role, setRole] = useState<Role>("owner"),
    [name, setName] = useState("");
  return (
    <section className="signin-grid" aria-label={tr("Choose an account type", "เลือกประเภทบัญชี")}>
      <div className="role-cards" role="radiogroup" aria-label={tr("Account type", "ประเภทบัญชี")}>
        <button
          type="button"
          role="radio"
          aria-checked={role === "owner"}
          className="role-card"
          onClick={() => setRole("owner")}
        >
          <House size={28} />
          <b>{tr("Property owner", "เจ้าของทรัพย์สิน")}</b>
          <span>
            {tr(
              "List your property and sell it directly, without an agent.",
              "ลงประกาศทรัพย์สินของคุณและขายเองโดยไม่ผ่านนายหน้า",
            )}
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={role === "agent"}
          className="role-card"
          onClick={() => setRole("agent")}
        >
          <Storefront size={28} />
          <b>{tr("Agent", "นายหน้า")}</b>
          <span>
            {tr(
              "Subscribe, post listings and show them on the zone map.",
              "สมัครสมาชิก ลงประกาศ และแสดงบนแผนที่ตามโซน",
            )}
          </span>
        </button>
      </div>
      <form
        className="panel-card signin-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSignIn(role, name);
        }}
      >
        <label>
          {tr("Name or company (optional)", "ชื่อหรือชื่อบริษัท (ไม่บังคับ)")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
          />
        </label>
        <button type="submit" className="button primary">
          {tr("Continue to dashboard", "ไปยังแดชบอร์ด")}
        </button>
        <p className="muted small">
          {tr(
            "Preview sign-in only. Live accounts need email verification before listings are published.",
            "ลงชื่อเข้าใช้เพื่อดูตัวอย่างเท่านั้น บัญชีจริงต้องยืนยันอีเมลก่อนเผยแพร่ประกาศ",
          )}
        </p>
      </form>
    </section>
  );
}

function ListingForm({
  mode,
  disabled = false,
  disabledNote,
  onSubmit,
}: {
  mode: "draft" | "publish";
  disabled?: boolean;
  disabledNote?: string;
  onSubmit: (input: ListingInput) => void;
}) {
  const { locale, tr } = useSettings();
  const [title, setTitle] = useState(""),
    [zone, setZone] = useState(zones[0].en),
    [type, setType] = useState<(typeof types)[number]>("villa"),
    [transaction, setTransaction] = useState<"sale" | "rent">("sale"),
    [price, setPrice] = useState(""),
    [beds, setBeds] = useState(""),
    [baths, setBaths] = useState(""),
    [size, setSize] = useState("");
  const [saved, setSaved] = useState(false);
  const typeLabel = (t: string) =>
    ({
      villa: tr("Villa", "วิลลา"),
      condo: tr("Condo", "คอนโด"),
      house: tr("House", "บ้าน"),
      townhouse: tr("Townhouse", "ทาวน์เฮาส์"),
      land: tr("Land", "ที่ดิน"),
    })[t] ?? t;
  return (
    <form
      className="panel-card listing-form"
      onSubmit={(e) => {
        e.preventDefault();
        const priceTHB = Number(price);
        if (!title.trim() || !Number.isFinite(priceTHB) || priceTHB <= 0) return;
        onSubmit({
          title: title.trim(),
          zone,
          type,
          transaction,
          priceTHB,
          beds: Math.round(clamp(beds, 50)),
          baths: Math.round(clamp(baths, 50)),
          areaM2: clamp(size, 100000),
        });
        setTitle("");
        setPrice("");
        setBeds("");
        setBaths("");
        setSize("");
        setSaved(true);
      }}
    >
      <fieldset disabled={disabled} className="listing-fields">
        <label className="span-full">
          {tr("Listing title", "ชื่อประกาศ")}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
            maxLength={120}
            required
          />
        </label>
        <label>
          {tr("Area", "พื้นที่")}
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.en}>
                {zoneLabel(z, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Property type", "ประเภททรัพย์สิน")}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof types)[number])}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("For", "ประกาศเพื่อ")}
          <select
            value={transaction}
            onChange={(e) => setTransaction(e.target.value as "sale" | "rent")}
          >
            <option value="sale">{tr("Sale", "ขาย")}</option>
            <option value="rent">{tr("Rent", "เช่า")}</option>
          </select>
        </label>
        <label>
          {tr("Price (THB)", "ราคา (บาท)")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <label>
          {tr("Bedrooms", "ห้องนอน")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
          />
        </label>
        <label>
          {tr("Bathrooms", "ห้องน้ำ")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
          />
        </label>
        <label>
          {tr("Size (m²)", "ขนาด (ตร.ม.)")}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </label>
        <div className="span-full form-actions">
          <button type="submit" className="button primary">
            {mode === "publish"
              ? tr("Publish to map", "เผยแพร่ขึ้นแผนที่")
              : tr("Save as draft", "บันทึกเป็นฉบับร่าง")}
          </button>
          {saved && (
            <span role="status" className="muted small">
              {mode === "publish"
                ? tr(
                    "Published in this preview. It now shows on the Phuket map.",
                    "เผยแพร่ในตัวอย่างนี้แล้ว ปรากฏบนแผนที่ภูเก็ตแล้ว",
                  )
                : tr(
                    "Saved as a draft in this preview. Not published.",
                    "บันทึกเป็นฉบับร่างในตัวอย่างนี้ ยังไม่เผยแพร่",
                  )}
            </span>
          )}
          {disabled && disabledNote && (
            <span className="muted small">{disabledNote}</span>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function IdentityCheck({
  received,
  onReceived,
}: {
  received: boolean;
  onReceived: (received: boolean) => void;
}) {
  const { tr } = useSettings();
  const [problem, setProblem] = useState<"type" | "size" | null>(null);
  return (
    <>
      <p>
        {received
          ? tr(
              "Demo upload received, not verified. This preview checks the file type and size on this device only. Nothing is uploaded or stored.",
              "รับไฟล์ตัวอย่างแล้ว ยังไม่ยืนยัน ตัวอย่างนี้ตรวจชนิดและขนาดไฟล์บนเครื่องของคุณเท่านั้น ไม่มีการอัปโหลดหรือเก็บไฟล์",
            )
          : tr(
              "Upload a passport or ID photo (JPG, PNG or PDF, up to 5 MB). This preview checks the file on this device only. Nothing is uploaded or stored.",
              "อัปโหลดรูปหนังสือเดินทางหรือบัตรประชาชน (JPG, PNG หรือ PDF ไม่เกิน 5 MB) ตัวอย่างนี้ตรวจไฟล์บนเครื่องของคุณเท่านั้น ไม่มีการอัปโหลดหรือเก็บไฟล์",
            )}
      </p>
      <input
        type="file"
        accept={ID_TYPES.join(",")}
        aria-label={tr("Passport or ID file", "ไฟล์หนังสือเดินทางหรือบัตรประชาชน")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!ID_TYPES.includes(file.type)) {
            setProblem("type");
            return;
          }
          if (file.size > ID_MAX_BYTES) {
            setProblem("size");
            return;
          }
          setProblem(null);
          onReceived(true);
        }}
      />
      {problem && (
        <p className="error-text">
          {problem === "type"
            ? tr("Use a JPG, PNG or PDF file.", "ใช้ไฟล์ JPG, PNG หรือ PDF")
            : tr("This file is larger than 5 MB.", "ไฟล์นี้ใหญ่กว่า 5 MB")}
        </p>
      )}
      <p>
        <span className="badge pending">
          {received
            ? tr("Demo received", "รับไฟล์ตัวอย่างแล้ว")
            : tr("Pending", "รอตรวจ")}
        </span>
      </p>
    </>
  );
}

function DraftList({
  drafts,
  priceOf,
}: {
  drafts: Draft[];
  priceOf: PriceOf;
}) {
  const { locale, tr } = useSettings();
  if (!drafts.length)
    return (
      <p className="muted">
        {tr("No drafts yet.", "ยังไม่มีฉบับร่าง")}
      </p>
    );
  return (
    <ul className="table-list">
      {drafts.map((d) => {
        return (
          <li key={d.id}>
            <b>{d.title}</b>
            <span>{areaName(d.zone, locale)}</span>
            <span>{priceOf(d)}</span>
            <span className="badge draft">{tr("Draft", "ฉบับร่าง")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PublishedList({
  items,
  priceOf,
}: {
  items: PublishedListing[];
  priceOf: PriceOf;
}) {
  const { locale, tr } = useSettings();
  if (!items.length)
    return (
      <p className="muted">
        {tr("No listings on the map yet.", "ยังไม่มีประกาศบนแผนที่")}
      </p>
    );
  return (
    <ul className="table-list">
      {[...items].reverse().map((d) => (
        <li key={d.id}>
          <b>{d.title}</b>
          <span>{areaName(d.zone, locale)}</span>
          <span>{priceOf(d)}</span>
          <span className="badge live">{tr("Live on map", "แสดงบนแผนที่")}</span>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function OwnerView({
  name,
  drafts,
  listings,
  identity,
  onIdentity,
  onDraft,
  priceOf,
}: {
  name: string;
  drafts: Draft[];
  listings: HomeListing[];
  identity: boolean;
  onIdentity: (received: boolean) => void;
  onDraft: (d: ListingInput) => void;
  priceOf: PriceOf;
}) {
  const { locale, tr } = useSettings();
  const sample = listings.filter((l) => l.channel.kind === "owner").slice(0, 3);
  return (
    <div className="dash-grid">
      <section className="panel-card">
        <div className="profile-row">
          <UserCircle size={36} />
          <div>
            <b>{name}</b>
            <p className="muted small">{tr("Owner account", "บัญชีเจ้าของ")}</p>
          </div>
        </div>
        <div className="kpi-grid">
          <Kpi label={tr("My listings", "ประกาศของฉัน")} value={drafts.length} />
          <Kpi label={tr("Enquiries", "คำถาม")} value={0} />
          <Kpi label={tr("Sample on map", "ตัวอย่างบนแผนที่")} value={sample.length} />
        </div>
      </section>

      <section className="panel-card">
        <h2>{tr("Identity check", "ยืนยันตัวตน")}</h2>
        <IdentityCheck received={identity} onReceived={onIdentity} />
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("List a property yourself", "ลงประกาศทรัพย์สินเอง")}</h2>
        <ListingForm mode="draft" onSubmit={onDraft} />
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("Your drafts", "ฉบับร่างของคุณ")}</h2>
        <DraftList drafts={drafts} priceOf={priceOf} />
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("Sample owner listings on the map", "ตัวอย่างประกาศของเจ้าของบนแผนที่")}</h2>
        <ul className="table-list">
          {sample.map((l) => (
            <li key={l.id}>
              <b>{locale === "th" ? l.title.th : l.title.en}</b>
              <span>{areaName(l.zone, locale)}</span>
              <span>{priceOf(l)}</span>
              <span className="badge live">{tr("Owner direct", "เจ้าของขายเอง")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AgentView({
  name,
  membership,
  onToggleMembership,
  published,
  onPublish,
  priceOf,
}: {
  name: string;
  membership: boolean;
  onToggleMembership: () => void;
  published: PublishedListing[];
  onPublish: (input: ListingInput) => void;
  priceOf: PriceOf;
}) {
  const { locale, tr } = useSettings();
  const counts = countByZone(published);
  const covered = Object.keys(counts).length;
  return (
    <div className="dash-grid">
      <section className="panel-card membership-card">
        <div className="profile-row">
          <Buildings size={36} />
          <div>
            <b>{name}</b>
            <p className="muted small">
              {tr("Agent membership", "สมาชิกนายหน้า")} · US${AGENT_PRICE_USD}{" "}
              {tr("per month", "ต่อเดือน")}
            </p>
          </div>
        </div>
        <p>
          {membership
            ? tr(
                "Membership active in this preview. Your listings go straight to the map.",
                "สมาชิกเปิดใช้งานในตัวอย่างนี้แล้ว ประกาศของคุณขึ้นแผนที่ได้ทันที",
              )
            : tr(
                "Start membership to post listings. No payment is taken in this preview.",
                "เริ่มสมาชิกเพื่อลงประกาศ ตัวอย่างนี้ไม่รับชำระเงิน",
              )}
        </p>
        <button type="button" className="button primary" onClick={onToggleMembership}>
          {membership
            ? tr("Cancel membership (demo)", "ยกเลิกสมาชิก (ตัวอย่าง)")
            : tr("Start membership (demo)", "เริ่มสมาชิก (ตัวอย่าง)")}
        </button>
        <p className="muted small">
          {tr(
            "Live billing is not connected in this preview.",
            "ยังไม่ได้เชื่อมระบบชำระเงินจริงในตัวอย่างนี้",
          )}
        </p>
      </section>

      <section className="panel-card">
        <div className="kpi-grid">
          <Kpi label={tr("Listings live", "ประกาศที่แสดง")} value={published.length} />
          <Kpi label={tr("Areas covered", "พื้นที่ที่ครอบคลุม")} value={covered} />
          <Kpi label={tr("Enquiries", "คำถาม")} value={0} />
        </div>
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("Listings by area on the map", "ประกาศแยกตามพื้นที่บนแผนที่")}</h2>
        <ul className="area-bars">
          {zones.map((z) => {
            const n = counts[z.id] ?? 0;
            return (
              <li key={z.id}>
                <span>{zoneLabel(z, locale)}</span>
                <span className="bar">
                  <i style={{ width: `${Math.min(100, n * 20)}%` }} />
                </span>
                <b>{n}</b>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("Post a listing", "ลงประกาศ")}</h2>
        <ListingForm
          mode="publish"
          disabled={!membership}
          disabledNote={tr(
            "Start membership to post.",
            "เริ่มสมาชิกก่อนลงประกาศ",
          )}
          onSubmit={onPublish}
        />
      </section>

      <section className="panel-card wide-card">
        <h2>{tr("Your listings on the map", "ประกาศของคุณบนแผนที่")}</h2>
        <Link className="text-link" href="/">
          {tr("View the map", "ดูแผนที่")}
        </Link>
        <PublishedList items={published} priceOf={priceOf} />
      </section>
    </div>
  );
}
