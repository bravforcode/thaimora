type Source = Record<string, unknown>;
const record = (value: unknown): value is Source => !!value && typeof value === "object";
/** Upstream freshness is independent of a successful read of our public API. */
export function eventSourceHealth(meta: unknown): "unknown" | "disconnected" | "awaiting" | "error" | "ok" {
  if (!record(meta) || !Array.isArray(meta.sources)) return "unknown";
  const enabled = meta.sources.filter(source => record(source) && source.kind === "events" && source.enabled === true) as Source[];
  if (!enabled.length) return "disconnected";
  if (enabled.some(source => ["error", "failed", "degraded", "stale"].includes(String(source.status)))) return "error";
  if (enabled.some(source => source.status === "license_pending" || typeof source.lastSuccessAt !== "string" || !Number.isFinite(Date.parse(source.lastSuccessAt)))) return "awaiting";
  return "ok";
}
