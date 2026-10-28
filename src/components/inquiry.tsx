"use client";
import { useRef, useState, useEffect } from "react";
import { X, ArrowRight, ChatCircle } from "@phosphor-icons/react";
import Script from "next/script";
import { useSettings } from "./context";
import {
  inquirySchema,
  type PublicProperty,
  type Inquiry,
} from "@/lib/property";
import { api, liveMode, inquiryDelivery, recordMeasurement } from "@/lib/api";
type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset?: (id: string) => void;
};
export function InquiryButton({ property: p }: { property: PublicProperty }) {
  const { locale, tr, measurementConsent } = useSettings();
  const dialog = useRef<HTMLDialogElement>(null),
    widget = useRef<HTMLDivElement>(null),
    key = useRef(""),
    widgetId = useRef<string | null>(null),
    [open, setOpen] = useState(false),
    [token, setToken] = useState(""),
    [scriptReady, setScriptReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  const [widgetGeneration, setWidgetGeneration] = useState(0);
  useEffect(() => {
    if (!open || !scriptReady || !widget.current) return;
    const t = (window as unknown as { turnstile: Turnstile }).turnstile;
    if (!t) return;
    let active = true;
    const id = t.render(widget.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action: "inquiry",
      callback: (v: string) => {
        if (active) setToken(v);
      },
      "expired-callback": () => {
        if (active) setToken("");
      },
      "error-callback": () => {
        if (active) setToken("");
      },
    });
    widgetId.current = id;
    return () => {
      active = false;
      t.remove(id);
      widgetId.current = null;
    };
  }, [open, scriptReady, widgetGeneration]);
  function show() {
    recordMeasurement(p.id, "contact_click", measurementConsent).catch(
      () => {},
    );
    setOpen(true);
    setToken("");
    setResult("");
    setError("");
    key.current = crypto.randomUUID();
    dialog.current?.showModal();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = inquirySchema.safeParse({
      ...values,
      propertyId: p.id,
      consent: values.consent === "on",
    });
    if (!parsed.success) {
      setError(
        tr(
          "Please enter your name, a valid email, country, a message of at least 10 characters, and agree to the privacy notice.",
          "กรุณากรอกชื่อ อีเมล ประเทศ ข้อความอย่างน้อย 10 ตัวอักษร และยอมรับประกาศความเป็นส่วนตัว",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      if (liveMode) {
        if (values.consentToShare !== "on")
          throw new Error(tr("Please agree to sharing this inquiry with the listing owner.", "กรุณายินยอมให้ส่งคำถามนี้แก่เจ้าของประกาศ"));
        if (!token)
          throw new Error(
            tr(
              "Please complete the security check.",
              "กรุณาทำการตรวจสอบความปลอดภัย",
            ),
          );
        const r = await api<{
          id: string;
          deliveryStatus: "sent" | "pending_retry";
          emailStatus?: string;
          contactStatus?: "queued" | "unavailable";
        }>("/v1/inquiries", {
          method: "POST",
          headers: { "Idempotency-Key": key.current },
          body: JSON.stringify({ ...parsed.data, consentToShare: true, turnstileToken: token }),
        });
        setResult(
          r.contactStatus === "queued"
            ? tr("Your inquiry was recorded. Notifications to the listing owner are queued.", "บันทึกคำถามแล้ว การแจ้งเตือนถึงเจ้าของประกาศอยู่ในคิวส่ง")
            : r.contactStatus === "unavailable"
              ? tr("Your inquiry was recorded. Owner notifications are not available yet; the team can see your request.", "บันทึกคำถามแล้ว ยังไม่พร้อมแจ้งเตือนเจ้าของประกาศ ทีมงานสามารถดูคำขอของคุณได้")
              : inquiryDelivery(r) === "sent"
            ? tr("Your inquiry has been sent.", "ส่งคำถามของคุณแล้ว")
            : tr(
                "Your inquiry was recorded. Email delivery is pending; the team can see your request.",
                "บันทึกคำถามแล้ว กำลังรอส่งอีเมล ทีมงานสามารถดูคำขอของคุณได้",
              ),
        );
      } else {
        const inquiry: Inquiry = {
          ...parsed.data,
          id: key.current,
          createdAt: new Date().toISOString(),
          deliveryStatus: "local_preview",
        };
        const rows: Inquiry[] = JSON.parse(
          localStorage.getItem("thaimora-inquiries") || "[]",
        );
        if (!rows.some((r) => r.id === inquiry.id))
          localStorage.setItem(
            "thaimora-inquiries",
            JSON.stringify([...rows, inquiry]),
          );
        setResult(
          tr(
            "Saved on this device for preview. No email was sent and no agent was contacted.",
            "บันทึกในอุปกรณ์นี้เพื่อทดลองใช้งาน ไม่ได้ส่งอีเมลหรือติดต่อผู้ดูแล",
          ),
        );
      }
    } catch (e) {
      if (liveMode) {
        setToken("");
        const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
        if (t?.reset && widgetId.current) t.reset(widgetId.current);
        else setWidgetGeneration((generation) => generation + 1);
      }
      setError(
        e instanceof Error
          ? e.message
          : tr(
              "Unable to submit. Please try again.",
              "ส่งไม่สำเร็จ กรุณาลองใหม่",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="button inquiry-trigger" onClick={show}>
        <ChatCircle size={20} />
        {tr("Inquire about this home", "สอบถามอสังหาริมทรัพย์นี้")}
        <ArrowRight size={18} />
      </button>
      <dialog
        ref={dialog}
        className="inquiry-dialog"
        onClose={() => setOpen(false)}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">
              {liveMode
                ? tr("CONTACT THAIMORA", "ติดต่อ THAIMORA")
                : tr("LOCAL PREVIEW", "ตัวอย่างในอุปกรณ์")}
            </span>
            <h2>{tr("Let’s find your place.", "ค้นหาที่ที่ใช่สำหรับคุณ")}</h2>
          </div>
          <button
            className="icon-button"
            onClick={() => dialog.current?.close()}
            aria-label={tr("Close inquiry", "ปิดแบบฟอร์ม")}
          >
            <X size={22} />
          </button>
        </div>
        <p className="muted">{p.title[locale]}</p>
        {result ? (
          <div role="status" className="notice success inquiry-result">
            <span>{result}</span>
            <button
              className="button secondary"
              onClick={() => dialog.current?.close()}
            >
              {tr("Done", "เสร็จสิ้น")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                {tr("Full name", "ชื่อและนามสกุล")}
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                {tr("Email", "อีเมล")}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            </div>
            <label>
              {tr("Country of residence", "ประเทศที่พำนัก")}
              <input
                name="country"
                autoComplete="country-name"
                required
                minLength={2}
              />
            </label>
            <label>
              {tr("Your message", "ข้อความ")}
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={3000}
                rows={4}
                defaultValue={tr(
                  "I would like more information about this property.",
                  "ฉันต้องการข้อมูลเพิ่มเติมเกี่ยวกับอสังหาริมทรัพย์นี้",
                )}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="consent" required />
              {tr(
                "I agree to use of my details to respond to this inquiry.",
                "ฉันยินยอมให้ใช้ข้อมูลของฉันเพื่อตอบคำถามนี้",
              )}{" "}
              <a href="/privacy/">
                {tr("Privacy notice", "ประกาศความเป็นส่วนตัว")}
              </a>
            </label>
            {liveMode && <label className="checkbox-label">
              <input type="checkbox" name="consentToShare" required />
              {tr("I agree to sharing my name, email and message with the owner of this listing so they can respond.", "ฉันยินยอมให้ส่งชื่อ อีเมล และข้อความแก่เจ้าของประกาศนี้เพื่อให้ติดต่อกลับ")}
            </label>}
            {liveMode && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                  onReady={() => setScriptReady(true)}
                />
                <div ref={widget} />
              </>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <button className="button wide" disabled={busy}>
              {busy
                ? tr("Sending…", "กำลังส่ง…")
                : liveMode
                  ? tr("Send inquiry", "ส่งคำถาม")
                  : tr("Save preview inquiry", "บันทึกคำถามตัวอย่าง")}
            </button>
          </form>
        )}
        <div className="contact-links">
          {process.env.NEXT_PUBLIC_LINE_URL && (
            <a
              href={process.env.NEXT_PUBLIC_LINE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                recordMeasurement(
                  p.id,
                  "contact_click",
                  measurementConsent,
                ).catch(() => {});
              }}
            >
              LINE
            </a>
          )}
          {process.env.NEXT_PUBLIC_WHATSAPP_URL && (
            <a
              href={process.env.NEXT_PUBLIC_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                recordMeasurement(
                  p.id,
                  "contact_click",
                  measurementConsent,
                ).catch(() => {});
              }}
            >
              WhatsApp
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
