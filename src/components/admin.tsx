"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  PencilSimple,
  Trash,
  UploadSimple,
  ArrowUp,
  ArrowDown,
  X,
  SignOut,
  House,
  ChatCircle,
  ChartBar,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useSettings } from "./context";
import { ContentAutomation } from "./content-automation";
import { BrokerAdmin } from "./broker-admin";
import { newProperty } from "@/lib/new-property";
import {
  propertySchema,
  publicSnapshot,
  snapshotForExport,
  type PublicProperty,
  type Inquiry,
} from "@/lib/property";
import {
  parseCSV,
  parseImportRows,
  exportCSV,
  propertyToImportRow,
  applyPreviewImport,
  type DuplicatePolicy,
} from "@/lib/import";
import {
  api,
  liveMode,
  normalizeInquiry,
  aggregateStats,
  type DailyStats,
} from "@/lib/api";
const AdminMap = dynamic(() => import("./admin-map").then((m) => m.AdminMap), {
  ssr: false,
});
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
type Publication = {
  published: boolean;
  demo: boolean;
  rights_status: string;
  ownership_evidence: string;
  source_url: string;
  rights_evidence: string;
};
type PrivateLocation = {
  lat: number;
  lng: number;
  exact_publication_consent: boolean;
  consent_evidence: string;
};
type ImageRights = {
  id?: string;
  rights_status: string;
  rights_evidence: string;
  license?: string;
};
type AdminRecord = PublicProperty & {
  publication?: {
    published: boolean;
    demo: boolean;
    rightsStatus: string;
    ownershipEvidence: string;
    sourceUrl?: string;
    rightsEvidence?: string;
  };
  privateLocation?: PrivateLocation;
  gallery?: {
    id?: string;
    url: string;
    rights_status: string;
    rights_evidence: string;
    license?: string;
  }[];
};
function backendPayload(
  p: PublicProperty,
  publication: Publication,
  privateLocation: PrivateLocation,
  rights: Record<string, ImageRights>,
) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    transaction: p.transaction,
    type: p.type,
    price_thb: p.priceTHB,
    area_m2: p.areaM2,
    land_area_m2: p.landAreaM2,
    beds: p.beds,
    baths: p.baths,
    floor: p.floor,
    built_year: p.builtYear,
    ownership: p.ownership,
    furnishing: p.furnishing,
    status: p.status,
    ...publication,
    privateLocation,
    zone: p.zone,
    province: p.province,
    images: p.images.map((img, index) => ({
      ...img,
      source_url: img.sourceUrl,
      ...(rights[img.url] ?? { rights_status: "pending", rights_evidence: "" }),
      position: index,
    })),
    amenities: p.amenities,
    expires_at: p.expiresAt,
  };
}
export function Admin({
  initialProperties,
}: {
  initialProperties: PublicProperty[];
}) {
  const { locale, tr } = useSettings();
  const [rows, setRows] = useState<PublicProperty[]>([]),
    [inquiries, setInquiries] = useState<Inquiry[]>([]),
    [token, setToken] = useState(""),
    [tab, setTab] = useState("properties"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<PublicProperty | null>(null),
    [isNew, setIsNew] = useState(false),
    [imported, setImported] = useState<ReturnType<
      typeof parseImportRows
    > | null>(null),
    [rawCSV, setRawCSV] = useState(""),
    [filter, setFilter] = useState(""),
    [stats, setStats] = useState<DailyStats[]>([]),
    [truncated, setTruncated] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] =
      useState<DuplicatePolicy>("skip"),
    [importDone, setImportDone] = useState(false);
  const [statsFrom, setStatsFrom] = useState(() =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
        new Date(Date.now() - 30 * 86400000),
      ),
    ),
    [statsTo, setStatsTo] = useState(() =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
        new Date(),
      ),
    );
  const [expiryThreshold] = useState(() => Date.now() + 7 * 86400000);
  const expiring = rows.filter(
    (p) => p.expiresAt && new Date(p.expiresAt).getTime() < expiryThreshold,
  );
  const totals = aggregateStats(stats);
  const dialog = useRef<HTMLDialogElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const adminDetails = useRef<Record<string, AdminRecord>>({});
  const [publication, setPublication] = useState<Publication>({
    published: false,
    demo: !liveMode,
    rights_status: "pending",
    ownership_evidence: "",
    source_url: "",
    rights_evidence: "",
  });
  const [privateLocation, setPrivateLocation] = useState<PrivateLocation>({
    lat: 7.94,
    lng: 98.33,
    exact_publication_consent: false,
    consent_evidence: "",
  });
  const [imageRights, setImageRights] = useState<Record<string, ImageRights>>(
    {},
  );
  useEffect(() => {
    if (liveMode) {
      setToken(sessionStorage.getItem("thaimora-staff-token") || "");
    } else {
      try {
        setRows(
          JSON.parse(
            localStorage.getItem("thaimora-properties") ||
              JSON.stringify(initialProperties),
          ),
        );
        setInquiries(
          JSON.parse(localStorage.getItem("thaimora-inquiries") || "[]"),
        );
      } catch {
        setRows(initialProperties);
      }
    }
  }, [initialProperties]);
  useEffect(() => {
    if (!liveMode || !token) return;
    setBusy(true);
    Promise.all([
      api<{ items: AdminRecord[]; truncated?: boolean }>(
        "/v1/admin/properties",
        {},
        token,
      ),
      api<{ items: Record<string, unknown>[]; truncated?: boolean }>(
        "/v1/admin/inquiries",
        {},
        token,
      ),
      api<{ items: DailyStats[] }>(
        `/v1/admin/stats?from=${statsFrom}&to=${statsTo}`,
        {},
        token,
      ),
    ])
      .then(([p, i, s]) => {
        p.items.forEach((row) => {
          adminDetails.current[row.id] = row;
        });
        setRows(p.items.map((p) => propertySchema.parse(p)));
        setInquiries(i.items.map(normalizeInquiry));
        setStats(s.items);
        setTruncated(p.truncated === true || i.truncated === true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [token, statsFrom, statsTo]);
  function persist(next: PublicProperty[]) {
    setRows(next);
    if (!liveMode)
      localStorage.setItem("thaimora-properties", JSON.stringify(next));
  }
  function startEdit(p?: PublicProperty) {
    const record = p ? adminDetails.current[p.id] : undefined;
    setPublication({
      published: record?.publication?.published ?? false,
      demo: record?.publication?.demo ?? !liveMode,
      rights_status: record?.publication?.rightsStatus ?? "pending",
      ownership_evidence: record?.publication?.ownershipEvidence ?? "",
      source_url: record?.publication?.sourceUrl ?? "",
      rights_evidence: record?.publication?.rightsEvidence ?? "",
    });
    setPrivateLocation(
      record?.privateLocation ?? {
        lat: p?.location.lat ?? 7.94,
        lng: p?.location.lng ?? 98.33,
        exact_publication_consent: false,
        consent_evidence: "",
      },
    );
    setImageRights(
      Object.fromEntries(
        (record?.gallery ?? []).map((img) => [
          img.url,
          {
            id: img.id,
            rights_status: img.rights_status,
            rights_evidence: img.rights_evidence,
            license: img.license,
          },
        ]),
      ),
    );
    setIsNew(!p);
    setEdit(
      p
        ? {
            ...structuredClone(p),
            location: {
              lat: Math.round(p.location.lat / 0.002) * 0.002,
              lng: Math.round(p.location.lng / 0.002) * 0.002,
              accuracy: "approximate",
              radiusMeters: 300,
            },
          }
        : {
            ...newProperty(),
            id: crypto.randomUUID(),
            slug: `new-property-${Date.now()}`,
            title: { en: "", th: "" },
            description: { en: "", th: "" },
            images: [],
            updatedAt: new Date().toISOString(),
          },
    );
    setError("");
    dialog.current?.showModal();
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const p = publicSnapshot(
        propertySchema.parse({ ...edit, updatedAt: new Date().toISOString() }),
      );
      if (rows.some((r) => r.slug === p.slug && r.id !== p.id))
        throw new Error("Slug already exists.");
      let saved = p;
      if (liveMode) {
        const result = await api<{ item: { id: string } }>(
          `/v1/admin/properties${isNew ? "" : `/${p.id}`}`,
          {
            method: isNew ? "POST" : "PATCH",
            body: JSON.stringify(
              backendPayload(p, publication, privateLocation, imageRights),
            ),
          },
          token,
        );
        const refreshed = await api<{ items: AdminRecord[] }>(
          "/v1/admin/properties",
          {},
          token,
        );
        const record = refreshed.items.find((row) => row.id === result.item.id);
        if (!record)
          throw new Error(
            "The server saved this listing, but it could not be refreshed. Reload the catalog before editing again.",
          );
        saved = propertySchema.parse(record);
        adminDetails.current[saved.id] = record;
      }
      persist(
        isNew ? [saved, ...rows] : rows.map((r) => (r.id === p.id ? saved : r)),
      );
      dialog.current?.close();
      setNotice(
        liveMode
          ? tr("Listing saved.", "บันทึกแล้ว")
          : tr(
              "Preview listing saved on this device.",
              "บันทึกรายการตัวอย่างในอุปกรณ์นี้แล้ว",
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  function changeLocation(lat: number, lng: number) {
    setPrivateLocation((value) => ({ ...value, lat, lng }));
    if (!liveMode && edit)
      setEdit({
        ...edit,
        location: {
          lat: Math.round(lat / 0.002) * 0.002,
          lng: Math.round(lng / 0.002) * 0.002,
          accuracy: "approximate",
          radiusMeters: 300,
        },
      });
  }
  async function remove(p: PublicProperty) {
    if (
      !window.confirm(
        tr(
          `Delete ${p.title.en}? This removes it from ${liveMode ? "the live catalog" : "this preview"}.`,
          `ลบ ${p.title.th} ออกจาก${liveMode ? "รายการจริง" : "ตัวอย่างนี้"}?`,
        ),
      )
    )
      return;
    try {
      if (liveMode)
        await api(`/v1/admin/properties/${p.id}`, { method: "DELETE" }, token);
      persist(rows.filter((r) => r.id !== p.id));
      setNotice(tr("Listing deleted.", "ลบรายการแล้ว"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }
  async function loadImport(file: File) {
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Import exceeds 5 MB.");
      let cells: unknown[][];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: readXlsxFile } = await import("read-excel-file");
        cells = await readXlsxFile(file);
      } else cells = parseCSV(await file.text());
      const preview = parseImportRows(cells, { live: liveMode });
      setImported(preview);
      setImportDone(false);
      setNotice("");
      setRawCSV(exportCSV(preview.records));
      setTab("imports");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }
  async function commitImport() {
    if (!imported || !imported.items.length || importDone) return;
    setBusy(true);
    try {
      if (liveMode) {
        const result = await api<{
          job: { rows_written: number };
          errors: { row_number: number; field?: string; message: string }[];
          skipped?: number;
        }>(
          "/v1/admin/imports",
          {
            method: "POST",
            body: JSON.stringify({ csv: rawCSV, duplicatePolicy }),
          },
          token,
        );
        const errors = result.errors.map((e) => ({
          row: imported.rowNumbers[e.row_number - 2] ?? e.row_number,
          message: `${e.field ? `${e.field}: ` : ""}${e.message}`,
        }));
        const allErrors = [...imported.errors, ...errors];
        const skipped = result.skipped ?? 0;
        setNotice(
          tr(
            `${result.job.rows_written} rows imported as drafts. ${allErrors.length} rows failed. ${skipped} duplicates skipped. Row numbers refer to the original file.`,
            `${result.job.rows_written} แถวนำเข้าเป็นฉบับร่าง ${allErrors.length} แถวล้มเหลว ข้ามรายการซ้ำ ${skipped} แถว หมายเลขแถวอ้างอิงไฟล์ต้นฉบับ`,
          ),
        );
        setImported({ ...imported, errors: allErrors });
        setImportDone(true);
        try {
          const refreshed = await api<{ items: AdminRecord[] }>(
            "/v1/admin/properties",
            {},
            token,
          );
          refreshed.items.forEach((p) => {
            adminDetails.current[p.id] = p;
          });
          persist(refreshed.items.map((p) => propertySchema.parse(p)));
        } catch (e) {
          setError(
            `Import was processed, but the catalog could not be refreshed. ${e instanceof Error ? e.message : "Reload the catalog before editing."}`,
          );
        }
        return;
      }
      const result = applyPreviewImport(
        rows,
        imported.items,
        imported.rowNumbers,
        duplicatePolicy,
        imported.records,
      );
      persist(result.items);
      const allErrors = [...imported.errors, ...result.errors];
      setNotice(
        tr(
          `${result.written} listings imported locally for preview. ${result.skipped} duplicates skipped. ${allErrors.length} rows failed.`,
          `นำเข้า ${result.written} รายการในเครื่องเพื่อดูตัวอย่าง ข้ามรายการซ้ำ ${result.skipped} รายการ ${allErrors.length} แถวล้มเหลว`,
        ),
      );
      setImported({ ...imported, errors: allErrors });
      setImportDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  async function uploadImage(file: File) {
    if (!edit) return;
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Image exceeds 10 MB.");
      const rightsEvidence = liveMode
        ? window.prompt(
            tr(
              "Provide the ownership or license reference for this image.",
              "ระบุหลักฐานเจ้าของหรือสัญญาอนุญาตสำหรับภาพนี้",
            ),
          )
        : "Local owned-image preview";
      if (!rightsEvidence?.trim())
        throw new Error(
          tr(
            "An image rights reference is required before upload.",
            "ต้องระบุหลักฐานสิทธิ์ก่อนอัปโหลด",
          ),
        );
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Use JPEG, PNG, or WebP.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let url = canvas.toDataURL("image/jpeg", 0.85);
      if (liveMode) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (v) =>
              v ? resolve(v) : reject(new Error("Image processing failed")),
            "image/jpeg",
            0.85,
          ),
        );
        const path = `${edit.id}/${crypto.randomUUID()}.jpg`;
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/property-images/${path}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              "Content-Type": "image/jpeg",
              "x-metadata": btoa(
                Array.from(
                  new TextEncoder().encode(
                    JSON.stringify({
                      rights_confirmed: true,
                      sanitized: true,
                    }),
                  ),
                  (v) => String.fromCharCode(v),
                ).join(""),
              ),
            },
            body: blob,
          },
        );
        if (!response.ok)
          throw new Error("Upload failed. Confirm staff storage access.");
        url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-images/${path}`;
      }
      setImageRights((v) => ({
        ...v,
        [url]: { rights_status: "pending", rights_evidence: rightsEvidence },
      }));
      setEdit({
        ...edit,
        images: [
          ...edit.images,
          {
            url,
            alt: {
              en: "Owner-authorized property image",
              th: "ภาพอสังหาริมทรัพย์ที่เจ้าของอนุญาต",
            },
            credit: "Owner-authorized upload",
          },
        ],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }
  function change(key: keyof PublicProperty, value: unknown) {
    if (edit) setEdit({ ...edit, [key]: value });
  }
  function reorder(i: number, offset: number) {
    if (!edit) return;
    const images = [...edit.images];
    [images[i], images[i + offset]] = [images[i + offset], images[i]];
    change("images", images);
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
        throw new Error(
          tr(
            "Staff authentication is not configured.",
            "ยังไม่ได้ตั้งค่าการยืนยันตัวตนเจ้าหน้าที่",
          ),
        );
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(fields),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.msg || result.message || "Sign-in failed");
      setToken(result.access_token);
      sessionStorage.setItem("thaimora-staff-token", result.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (liveMode && !token)
    return (
      <main id="main" className="admin-login">
        <h1>{tr("Welcome back.", "ยินดีต้อนรับกลับ")}</h1>
        <p>
          {tr(
            "Sign in with your client-owned staff account.",
            "ลงชื่อเข้าใช้บัญชีเจ้าหน้าที่ของลูกค้า",
          )}
        </p>
        <form onSubmit={login}>
          <label>
            {tr("Email", "อีเมล")}
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            {tr("Password", "รหัสผ่าน")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="button wide" disabled={busy}>
            {busy
              ? tr("Signing in…", "กำลังลงชื่อ…")
              : tr("Sign in", "ลงชื่อเข้าใช้")}
          </button>
        </form>
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => setToken("preview-staff-token")}
          >
            {tr("Preview property desk (demo)", "ทดลองใช้โต๊ะจัดการ (ตัวอย่าง)")}
          </button>
        </div>
      </main>
    );
  return (
    <main id="main" className="admin-page">
      <div className="admin-heading">
        <div>
          <h1>{tr("Your property desk.", "โต๊ะจัดการอสังหาริมทรัพย์")}</h1>
        </div>
        {liveMode ? (
          <button
            className="button secondary"
            onClick={() => {
              setToken("");
              sessionStorage.removeItem("thaimora-staff-token");
              setRows([]);
              setInquiries([]);
            }}
          >
            <SignOut size={18} />
            {tr("Sign out", "ออกจากระบบ")}
          </button>
        ) : (
          <span className="preview-badge">
            {tr(
              "LOCAL DEMO · no live changes",
              "ตัวอย่างในอุปกรณ์ · ไม่เปลี่ยนข้อมูลจริง",
            )}
          </span>
        )}
      </div>
      {truncated && (
        <p className="notice" role="status">
          {tr(
            "Showing the first 1,000 records. Filter the list to find the rest.",
            "แสดง 1,000 รายการแรก ใช้ตัวกรองเพื่อค้นหารายการที่เหลือ",
          )}
        </p>
      )}
      {!liveMode && (
        <p className="notice">
          {tr(
            "Preview management on this browser only. Listings and inquiries persist locally; no server is connected.",
            "จัดการตัวอย่างในเบราว์เซอร์นี้เท่านั้น รายการและคำถามเก็บในอุปกรณ์ ไม่ได้เชื่อมต่อเซิร์ฟเวอร์",
          )}
        </p>
      )}
      <div className="admin-stats">
        <div>
          <House size={25} />
          <span>{tr("Listings", "รายการ")}</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <ChartBar size={25} />
          <span>{tr("Available", "พร้อมใช้งาน")}</span>
          <strong>{rows.filter((r) => r.status === "available").length}</strong>
        </div>
        <div>
          <ChatCircle size={25} />
          <span>{tr("Inquiries", "คำถาม")}</span>
          <strong>{inquiries.length}</strong>
        </div>
      </div>
      {expiring.length > 0 && (
        <p className="notice" role="status">
          {tr(
            "Expiry reminder: these listings expire within 7 days or have expired. Review availability before renewing.",
            "แจ้งเตือนวันหมดอายุ: รายการเหล่านี้หมดอายุแล้วหรือจะหมดอายุภายใน 7 วัน โปรดตรวจสอบก่อนต่ออายุ",
          )}{" "}
          {expiring.map((p) => p.title[locale]).join(", ")}
        </p>
      )}
      {liveMode && (
        <section
          className="stats-panel"
          aria-label={tr("Daily statistics", "สถิติรายวัน")}
        >
          <h2>
            {tr(
              "Daily statistics · Bangkok time",
              "สถิติรายวัน · เวลากรุงเทพฯ",
            )}
          </h2>
          <div className="form-grid">
            <label>
              {tr("From", "จาก")}
              <input
                type="date"
                value={statsFrom}
                max={statsTo}
                onChange={(e) => setStatsFrom(e.target.value)}
              />
            </label>
            <label>
              {tr("To", "ถึง")}
              <input
                type="date"
                value={statsTo}
                min={statsFrom}
                onChange={(e) => setStatsTo(e.target.value)}
              />
            </label>
          </div>
          <p>
            {tr("Opted-in views", "การดูที่ยินยอม")}:{" "}
            <strong>{totals.views}</strong> ·{" "}
            {tr("Contact clicks", "คลิกติดต่อ")}:{" "}
            <strong>{totals.contact_clicks}</strong> ·{" "}
            {tr("Inquiries", "สอบถาม")}: <strong>{totals.inquiries}</strong>
          </p>
          <button
            className="button secondary"
            disabled={!stats.length}
            onClick={() =>
              download(
                `thaimora-stats-${statsFrom}-${statsTo}.csv`,
                exportCSV(stats.map((row) => ({ ...row }))),
              )
            }
          >
            <DownloadSimple size={18} />
            {tr("Export daily CSV", "ส่งออก CSV รายวัน")}
          </button>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Day",
                    "Property ID",
                    "Views",
                    "Inquiries",
                    "Contact clicks",
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={`${row.day}-${row.property_id}`}>
                    <td>{row.day}</td>
                    <td>
                      {row.property_id ?? tr("All properties", "ทุกรายการ")}
                    </td>
                    <td>{row.views}</td>
                    <td>{row.inquiries}</td>
                    <td>{row.contact_clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <nav
        className="admin-tabs"
        aria-label={tr("Admin sections", "ส่วนการจัดการ")}
      >
        {[
          ["properties", "Listings", "รายการ"],
          ["inquiries", "Inquiries", "คำถาม"],
          ["imports", "Import & export", "นำเข้าและส่งออก"],
          ...(liveMode ? [["content-updates", "Content updates", "อัปเดตเนื้อหา"]] : []),
          ...(liveMode ? [["brokers", "Brokers & contacts", "นายหน้าและผู้รับคำถาม"]] : []),
        ].map(([id, en, th]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {tr(en, th)}
          </button>
        ))}
      </nav>
      {error && !dialog.current?.open && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">{tr("Working…", "กำลังดำเนินการ…")}</p>}
      {tab === "content-updates" && <ContentAutomation token={token} />}
      {tab === "brokers" && <BrokerAdmin token={token} properties={rows} />}
      {tab === "properties" && (
        <>
          <div className="admin-toolbar">
            <input
              aria-label={tr("Search staff listings", "ค้นหารายการเจ้าหน้าที่")}
              placeholder={tr("Search listings…", "ค้นหารายการ…")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="button" onClick={() => startEdit()}>
              <Plus size={18} />
              {tr("Add listing", "เพิ่มรายการ")}
            </button>
          </div>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Property",
                    "Price (THB)",
                    "Status",
                    "Expiry",
                    "Actions",
                  ].map((h, i) => (
                    <th key={h}>
                      {tr(
                        h,
                        [
                          "อสังหาริมทรัพย์",
                          "ราคา (บาท)",
                          "สถานะ",
                          "วันหมดอายุ",
                          "ดำเนินการ",
                        ][i],
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(
                    (p) =>
                      p.title[locale]
                        .toLowerCase()
                        .includes(filter.toLowerCase()) ||
                      p.zone.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.title[locale]}</strong>
                        <small>
                          {p.zone} · {p.type}
                        </small>
                      </td>
                      <td>{p.priceTHB.toLocaleString()}</td>
                      <td>
                        <span className="status-pill">{p.status}</span>
                      </td>
                      <td>
                        {p.expiresAt
                          ? new Date(p.expiresAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`${tr("Edit", "แก้ไข")} ${p.title[locale]}`}
                          onClick={() => startEdit(p)}
                        >
                          <PencilSimple size={19} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`${tr("Delete", "ลบ")} ${p.title[locale]}`}
                          onClick={() => remove(p)}
                        >
                          <Trash size={19} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "inquiries" && (
        <>
          <div className="admin-toolbar">
            <h2>{tr("Property inquiries", "คำถามเกี่ยวกับอสังหาริมทรัพย์")}</h2>
            <button
              className="button secondary"
              disabled={!inquiries.length || liveMode}
              onClick={() =>
                download(
                  "preview-inquiries.csv",
                  exportCSV(inquiries.map((i) => ({ ...i }))),
                )
              }
            >
              <DownloadSimple size={18} />
              {tr("Export local CSV", "ส่งออก CSV ในอุปกรณ์")}
            </button>
          </div>
          {inquiries.length ? (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {[
                      "Name",
                      "Email",
                      "Property ID",
                      "Message",
                      "Delivery",
                    ].map((h, i) => (
                      <th key={h}>
                        {tr(
                          h,
                          ["ชื่อ", "อีเมล", "รหัสรายการ", "ข้อความ", "การส่ง"][
                            i
                          ],
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span>{i.name}</span>
                        <small>{i.country}</small>
                      </td>
                      <td>{i.email}</td>
                      <td>{i.propertyId}</td>
                      <td>{i.message}</td>
                      <td>{i.deliveryStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <ChatCircle size={30} />
              <h2>{tr("No inquiries yet.", "ยังไม่มีคำถาม")}</h2>
              <p>
                {tr(
                  "Inquiries submitted from a property will appear here.",
                  "คำถามที่ส่งจากหน้ารายการจะแสดงที่นี่",
                )}
              </p>
            </div>
          )}
        </>
      )}
      {tab === "imports" && (
        <section className="import-panel">
          <h2>
            {tr(
              "Bring your catalog into one place.",
              "รวมรายการของคุณไว้ในที่เดียว",
            )}
          </h2>
          <p>
            {tr(
              "CSV and XLSX are checked before any changes. Approximate public locations require a radius of at least 300 m.",
              "ตรวจสอบ CSV และ XLSX ก่อนเปลี่ยนข้อมูล ตำแหน่งสาธารณะโดยประมาณต้องมีรัศมีอย่างน้อย 300 เมตร",
            )}
          </p>
          <div className="import-actions">
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
            >
              <UploadSimple size={18} />
              {tr("Choose CSV or XLSX", "เลือก CSV หรือ XLSX")}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  "thaimora-template.csv",
                  exportCSV([propertyToImportRow(rows[0] ?? newProperty())]),
                )
              }
            >
              {tr("Download template", "ดาวน์โหลดตัวอย่าง")}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  "thaimora-public-listings.csv",
                  exportCSV(
                    rows.map((p) => propertyToImportRow(snapshotForExport(p))),
                  ),
                )
              }
            >
              {tr("Export public catalog", "ส่งออกรายการสาธารณะ")}
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void loadImport(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {imported && (
            <>
              <label>
                {tr("Duplicate policy", "นโยบายรายการซ้ำ")}
                <select
                  value={duplicatePolicy}
                  disabled={importDone}
                  onChange={(e) =>
                    setDuplicatePolicy(e.target.value as DuplicatePolicy)
                  }
                >
                  <option value="skip">
                    {tr(
                      "Skip duplicates (default)",
                      "ข้ามรายการซ้ำ (ค่าเริ่มต้น)",
                    )}
                  </option>
                  <option value="update">
                    {tr("Update matching listings", "อัปเดตรายการที่ตรงกัน")}
                  </option>
                  <option value="error">
                    {tr(
                      "Report duplicate row errors",
                      "รายงานข้อผิดพลาดแถวซ้ำ",
                    )}
                  </option>
                </select>
              </label>
              <p className="muted">
                {tr(
                  "Valid rows can be imported while invalid rows remain below. Row numbers refer to your original file. Updates use the existing listing ID.",
                  "สามารถนำเข้าแถวที่ถูกต้องได้ ข้อผิดพลาดแสดงด้านล่าง หมายเลขแถวอ้างอิงไฟล์ต้นฉบับ การอัปเดตใช้รหัสรายการเดิม",
                )}
              </p>
              <h3>{tr("Import preview", "ตัวอย่างการนำเข้า")}</h3>
              <p>
                {imported.items.length} {tr("valid rows", "แถวที่ถูกต้อง")} ·{" "}
                {imported.errors.length} {tr("errors", "ข้อผิดพลาด")}
              </p>
              {imported.errors.map((e, i) => (
                <p role="alert" className="notice error" key={i}>
                  Row {e.row}: {e.message}
                </p>
              ))}
              <div className="table-scroll">
                <table className="admin-table">
                  <tbody>
                    {imported.items.map((p, index) => (
                      <tr key={`${p.id}-${index}`}>
                        <td>
                          {tr("Row", "แถว")} {imported.rowNumbers[index]}
                        </td>
                        <td>{p.title[locale]}</td>
                        <td>{p.priceTHB.toLocaleString()} THB</td>
                        <td>{p.zone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button"
                disabled={busy || importDone || !imported.items.length}
                onClick={commitImport}
              >
                {tr("Confirm import", "ยืนยันการนำเข้า")}
              </button>
            </>
          )}
        </section>
      )}
      <dialog
        ref={dialog}
        className="editor-dialog"
        onClose={() => setEdit(null)}
      >
        {edit && (
          <>
            <div className="dialog-heading">
              <h2>
                {isNew
                  ? tr("Add a listing", "เพิ่มรายการ")
                  : tr("Edit listing", "แก้ไขรายการ")}
              </h2>
              <button
                className="icon-button"
                aria-label={tr("Close editor", "ปิดตัวแก้ไข")}
                onClick={() => dialog.current?.close()}
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                {(["en", "th"] as const).map((lang) => (
                  <label key={lang}>
                    {tr("Title", "ชื่อรายการ")} ({lang.toUpperCase()})
                    <input
                      required
                      value={edit.title[lang]}
                      onChange={(e) =>
                        change("title", {
                          ...edit.title,
                          [lang]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Slug
                  <input
                    required
                    pattern="[a-z0-9-]+"
                    value={edit.slug}
                    onChange={(e) => change("slug", e.target.value)}
                  />
                </label>
                <label>
                  {tr("Transaction", "ประเภทธุรกรรม")}
                  <select
                    value={edit.transaction}
                    onChange={(e) => change("transaction", e.target.value)}
                  >
                    <option value="sale">Sale / ขาย</option>
                    <option value="rent">Rent / เช่า</option>
                  </select>
                </label>
                {(["en", "th"] as const).map((lang) => (
                  <label key={`desc-${lang}`}>
                    {tr("Description", "รายละเอียด")} ({lang.toUpperCase()})
                    <textarea
                      required
                      rows={3}
                      value={edit.description[lang]}
                      onChange={(e) =>
                        change("description", {
                          ...edit.description,
                          [lang]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                {(
                  [
                    ["priceTHB", "Price (THB)", "ราคา (บาท)"],
                    ["areaM2", "Area (m²)", "พื้นที่ (ตร.ม.)"],
                    ["landAreaM2", "Land area (m²)", "พื้นที่ดิน"],
                    ["beds", "Bedrooms", "ห้องนอน"],
                    ["baths", "Bathrooms", "ห้องน้ำ"],
                    ["floor", "Floor", "ชั้น"],
                    ["builtYear", "Built year", "ปีที่สร้าง"],
                  ] as const
                ).map(([key, en, th]) => (
                  <label key={key}>
                    {tr(en, th)}
                    <input
                      type="number"
                      min={0}
                      required={[
                        "priceTHB",
                        "areaM2",
                        "beds",
                        "baths",
                      ].includes(key)}
                      value={edit[key] ?? ""}
                      onChange={(e) =>
                        change(
                          key,
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                ))}
                {(
                  [
                    ["type", ["condo", "house", "villa", "land", "townhouse"]],
                    ["ownership", ["freehold", "leasehold", "unknown"]],
                    [
                      "furnishing",
                      ["furnished", "partly_furnished", "unfurnished"],
                    ],
                    ["status", ["available", "sold", "rented"]],
                  ] as const
                ).map(([key, values]) => (
                  <label key={key}>
                    {key}
                    <select
                      value={edit[key]}
                      onChange={(e) => change(key, e.target.value)}
                    >
                      {values.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  {tr("Public zone", "พื้นที่สาธารณะ")}
                  <input
                    required
                    value={edit.zone}
                    onChange={(e) => change("zone", e.target.value)}
                  />
                </label>
                <label>
                  {tr("Province", "จังหวัด")}
                  <input
                    required
                    value={edit.province}
                    onChange={(e) => change("province", e.target.value)}
                  />
                </label>
                <label>
                  {tr("Approximate latitude", "ละติจูดโดยประมาณ")}
                  <input
                    type="number"
                    step=".001"
                    min={-90}
                    max={90}
                    required
                    value={edit.location.lat}
                    onChange={(e) =>
                      change("location", {
                        ...edit.location,
                        lat: Number(e.target.value),
                        accuracy: "approximate",
                        radiusMeters: 300,
                      })
                    }
                  />
                </label>
                <label>
                  {tr("Approximate longitude", "ลองจิจูดโดยประมาณ")}
                  <input
                    type="number"
                    step=".001"
                    min={-180}
                    max={180}
                    required
                    value={edit.location.lng}
                    onChange={(e) =>
                      change("location", {
                        ...edit.location,
                        lng: Number(e.target.value),
                        accuracy: "approximate",
                        radiusMeters: 300,
                      })
                    }
                  />
                </label>
                <label>
                  {tr("Expires on", "หมดอายุวันที่")}
                  <input
                    type="date"
                    value={edit.expiresAt?.slice(0, 10) || ""}
                    onChange={(e) =>
                      change(
                        "expiresAt",
                        e.target.value
                          ? new Date(
                              `${e.target.value}T23:59:59Z`,
                            ).toISOString()
                          : null,
                      )
                    }
                  />
                </label>
                <label>
                  {tr(
                    "Amenities (separate with |)",
                    "สิ่งอำนวยความสะดวก (คั่นด้วย |)",
                  )}
                  <input
                    value={edit.amenities.join("|")}
                    onChange={(e) =>
                      change(
                        "amenities",
                        e.target.value
                          .split("|")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </label>
              </div>
              <p className="notice">
                {tr(
                  "Only approximate public locations are edited here. Exact location permissions are managed on the protected server.",
                  "แก้ไขตำแหน่งสาธารณะโดยประมาณเท่านั้น การอนุญาตตำแหน่งจริงจัดการบนเซิร์ฟเวอร์ที่ป้องกัน",
                )}
              </p>
              <h3>
                {tr(
                  "Gallery · drag-free image ordering",
                  "แกลเลอรี · จัดลำดับภาพด้วยปุ่ม",
                )}
              </h3>
              <fieldset className="protected-settings">
                <label>
                  {tr("Listing source URL", "URL แหล่งที่มารายการ")}
                  <input
                    type="url"
                    value={publication.source_url}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        source_url: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {tr("Listing rights evidence", "หลักฐานสิทธิ์รายการ")}
                  <textarea
                    value={publication.rights_evidence}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        rights_evidence: e.target.value,
                      })
                    }
                  />
                </label>
                <legend>
                  {tr("Publication and permissions", "การเผยแพร่และการอนุญาต")}
                </legend>
                <div className="form-grid">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={publication.published}
                      onChange={(e) =>
                        setPublication({
                          ...publication,
                          published: e.target.checked,
                        })
                      }
                    />
                    {tr("Publish to public catalog", "เผยแพร่ในรายการสาธารณะ")}
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={publication.demo}
                      onChange={(e) =>
                        setPublication({
                          ...publication,
                          demo: e.target.checked,
                        })
                      }
                    />
                    {tr("Synthetic/demo record", "ข้อมูลจำลอง/ตัวอย่าง")}
                  </label>
                  <label>
                    {tr("Listing rights review", "ตรวจสอบสิทธิ์รายการ")}
                    <select
                      value={publication.rights_status}
                      onChange={(e) =>
                        setPublication({
                          ...publication,
                          rights_status: e.target.value,
                        })
                      }
                    >
                      {["pending", "approved", "rejected"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr(
                      "Ownership / authority evidence",
                      "หลักฐานเจ้าของ / อำนาจ",
                    )}
                    <textarea
                      value={publication.ownership_evidence}
                      onChange={(e) =>
                        setPublication({
                          ...publication,
                          ownership_evidence: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {tr("Protected exact latitude", "ละติจูดจริงที่ป้องกัน")}
                    <input
                      type="number"
                      min={-90}
                      max={90}
                      step="any"
                      value={privateLocation.lat}
                      onChange={(e) =>
                        changeLocation(
                          Number(e.target.value),
                          privateLocation.lng,
                        )
                      }
                    />
                  </label>
                  <label>
                    {tr("Protected exact longitude", "ลองจิจูดจริงที่ป้องกัน")}
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      step="any"
                      value={privateLocation.lng}
                      onChange={(e) =>
                        changeLocation(
                          privateLocation.lat,
                          Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={privateLocation.exact_publication_consent}
                      onChange={(e) =>
                        setPrivateLocation({
                          ...privateLocation,
                          exact_publication_consent: e.target.checked,
                        })
                      }
                    />
                    {tr(
                      "Owner permits exact location publication",
                      "เจ้าของอนุญาตให้เผยแพร่ตำแหน่งจริง",
                    )}
                  </label>
                  <label>
                    {tr("Location consent evidence", "หลักฐานการอนุญาตตำแหน่ง")}
                    <textarea
                      value={privateLocation.consent_evidence}
                      onChange={(e) =>
                        setPrivateLocation({
                          ...privateLocation,
                          consent_evidence: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <p className="muted">
                  {liveMode
                    ? tr(
                        "Protected coordinates and consent evidence are sent only to the authenticated staff API. Public coordinates are projected by the server.",
                        "ส่งตำแหน่งที่ป้องกันและหลักฐานการอนุญาตเฉพาะ API เจ้าหน้าที่ที่ยืนยันตัวตน เซิร์ฟเวอร์สร้างตำแหน่งสาธารณะ",
                      )
                    : tr(
                        "Protected permissions are a form preview and are not saved to the local public catalog.",
                        "การอนุญาตที่ป้องกันเป็นตัวอย่างแบบฟอร์มและไม่บันทึกในรายการสาธารณะของอุปกรณ์",
                      )}
                </p>
              </fieldset>
              <AdminMap
                lat={privateLocation.lat}
                lng={privateLocation.lng}
                onChange={changeLocation}
              />
              <div className="admin-gallery">
                {edit.images.map((img, i) => (
                  <div key={`${i}-${img.url.slice(0, 30)}`}>
                    <img src={img.url} alt={img.alt[locale]} />
                    <label>
                      {tr("Image license", "ใบอนุญาตภาพ")}
                      <input
                        value={imageRights[img.url]?.license ?? ""}
                        onChange={(e) =>
                          setImageRights((value) => ({
                            ...value,
                            [img.url]: {
                              ...value[img.url],
                              rights_status:
                                value[img.url]?.rights_status ?? "pending",
                              rights_evidence:
                                value[img.url]?.rights_evidence ?? "",
                              license: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      {tr("Image rights review", "ตรวจสอบสิทธิ์ภาพ")}
                      <select
                        value={imageRights[img.url]?.rights_status ?? "pending"}
                        onChange={(e) =>
                          setImageRights((v) => ({
                            ...v,
                            [img.url]: {
                              ...v[img.url],
                              rights_status: e.target.value,
                              rights_evidence:
                                v[img.url]?.rights_evidence ?? "",
                            },
                          }))
                        }
                      >
                        {["pending", "approved", "rejected"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Image rights evidence", "หลักฐานสิทธิ์ภาพ")}
                      <textarea
                        value={imageRights[img.url]?.rights_evidence ?? ""}
                        onChange={(e) =>
                          setImageRights((v) => ({
                            ...v,
                            [img.url]: {
                              ...v[img.url],
                              rights_status:
                                v[img.url]?.rights_status ?? "pending",
                              rights_evidence: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      {tr("Image URL", "URL ภาพ")}
                      <input
                        value={img.url}
                        onChange={(e) => {
                          const url = e.target.value;
                          setImageRights((value) => ({
                            ...value,
                            [url]: value[img.url] ?? {
                              rights_status: "pending",
                              rights_evidence: "",
                            },
                          }));
                          change(
                            "images",
                            edit.images.map((v, j) =>
                              j === i ? { ...v, url } : v,
                            ),
                          );
                        }}
                      />
                    </label>
                    {(["en", "th"] as const).map((lang) => (
                      <label key={lang}>
                        Alt ({lang})
                        <input
                          required
                          value={img.alt[lang]}
                          onChange={(e) =>
                            change(
                              "images",
                              edit.images.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      alt: { ...v.alt, [lang]: e.target.value },
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <label>
                      {tr("Credit / rights source", "เครดิต / แหล่งสิทธิ์")}
                      <input
                        value={img.credit || ""}
                        onChange={(e) =>
                          change(
                            "images",
                            edit.images.map((v, j) =>
                              j === i ? { ...v, credit: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      {tr("Source URL", "URL แหล่งภาพ")}
                      <input
                        type="url"
                        value={img.sourceUrl || ""}
                        onChange={(e) =>
                          change(
                            "images",
                            edit.images.map((v, j) =>
                              j === i ? { ...v, sourceUrl: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={tr("Move image earlier", "เลื่อนภาพขึ้น")}
                        disabled={i === 0}
                        onClick={() => reorder(i, -1)}
                      >
                        <ArrowUp size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={tr("Move image later", "เลื่อนภาพลง")}
                        disabled={i === edit.images.length - 1}
                        onClick={() => reorder(i, 1)}
                      >
                        <ArrowDown size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={tr("Remove image", "ลบภาพ")}
                        onClick={() =>
                          change(
                            "images",
                            edit.images.filter((_, j) => i !== j),
                          )
                        }
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="import-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    change("images", [
                      ...edit.images,
                      {
                        url: "",
                        alt: { en: "", th: "" },
                        credit: "",
                        sourceUrl: "",
                      },
                    ])
                  }
                >
                  <Plus size={17} />
                  {tr("Add image URL", "เพิ่ม URL ภาพ")}
                </button>
                <label className="button secondary upload-label">
                  <UploadSimple size={17} />
                  {tr("Upload owned image", "อัปโหลดภาพที่มีสิทธิ์")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void uploadImage(e.target.files[0]);
                    }}
                  />
                </label>
              </div>
              <p className="muted">
                {tr(
                  "Owned uploads are decoded and re-encoded as JPEG to remove source metadata, including EXIF. Upload only authorized images.",
                  "ภาพที่อัปโหลดจะถอดรหัสและสร้าง JPEG ใหม่เพื่อลบข้อมูลต้นฉบับรวมถึง EXIF อัปโหลดเฉพาะภาพที่ได้รับอนุญาต",
                )}
              </p>
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
              <button className="button wide" disabled={busy}>
                {busy
                  ? tr("Saving…", "กำลังบันทึก…")
                  : tr("Save listing", "บันทึกรายการ")}
              </button>
            </form>
          </>
        )}
      </dialog>
    </main>
  );
}
