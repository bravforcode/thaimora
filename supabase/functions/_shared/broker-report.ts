import { ApiError, safeCsvCell } from "./domain.ts";

const DAY_MS = 86_400_000;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string | null): string {
  if (!value || !isoDay.test(value)) throw new ApiError(422, "report_range_invalid");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ApiError(422, "report_range_invalid");
  return value;
}

export function reportWindow(url: URL): { from: string; to: string } {
  const from = validDay(url.searchParams.get("from")), to = validDay(url.searchParams.get("to"));
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
  if (days < 0 || days > 365) throw new ApiError(422, "report_range_invalid");
  return { from, to };
}

export function leadPage(url: URL): { before: string | null; limit: number } {
  const before = url.searchParams.get("before");
  if (before !== null && Number.isNaN(Date.parse(before))) throw new ApiError(422, "invalid_cursor");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ApiError(422, "invalid_limit");
  return { before, limit };
}

export function csvText(rows: Record<string, unknown>[], keys: string[]): string {
  return [keys.map(safeCsvCell).join(","), ...rows.map((row) => keys.map((key) => safeCsvCell(row[key])).join(","))].join("\r\n");
}

// BOM lets Thai text open correctly in Excel.
export function csvResponse(body: string, filename: string): Response {
  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
