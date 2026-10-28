const DAY_MS = 86_400_000;

export type ReportPreset = 7 | 30 | 90;
export type DailyRow = { day: string; views: number; inquiries: number; contactClicks: number };

export function reportWindow(today: string, days: ReportPreset): { from: string; to: string } {
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS);
  return { from: start.toISOString().slice(0, 10), to: today };
}

export function bangkokToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fillDailySeries(daily: DailyRow[], from: string, to: string): DailyRow[] {
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const out: DailyRow[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, views: 0, inquiries: 0, contactClicks: 0 });
  }
  return out;
}

export function formatResponseTime(seconds: number | null, locale: "en" | "th"): string {
  if (seconds === null) return locale === "th" ? "ยังไม่มีข้อมูล" : "No data yet";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return locale === "th" ? `${minutes} นาที` : `${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (hours < 48) return locale === "th" ? `${hours} ชม. ${rest} นาที` : `${hours}h ${rest}m`;
  const days = Math.round(hours / 24);
  return locale === "th" ? `${days} วัน` : `${days} days`;
}
