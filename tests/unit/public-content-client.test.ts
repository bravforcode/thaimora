import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicContentClient, currentEvents, nextEventCheck } from "../../src/lib/public-content-client";

const meta = { revision: "r1", poisVersion: "p1", eventsVersion: "e1", homeVersion: "h1" };
const full = { pois: [{ id: "place" }], events: [] as { id: string }[], homeSettings: { heading: "old" }, meta };
const json = (body: unknown, etag = '"full-1"') => new Response(JSON.stringify(body), { headers: { etag } });
let documentTarget: EventTarget & { visibilityState: string };
let windowTarget: EventTarget;
let network: { onLine: boolean };
const stops: (() => void)[] = [];
function client() {
  const resource = createPublicContentClient("https://api.example/v1/content", (body: unknown) => {
    const value = body as typeof full;
    if (!Array.isArray(value.pois) || !Array.isArray(value.events)) throw new Error("invalid");
    return value;
  });
  stops.push(resource.subscribe(() => {}));
  return resource;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
  documentTarget = Object.assign(new EventTarget(), { visibilityState: "visible" });
  windowTarget = new EventTarget(); network = { onLine: true };
  vi.stubGlobal("document", documentTarget); vi.stubGlobal("window", windowTarget); vi.stubGlobal("navigator", network);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("public content refresh", () => {
  it("deduplicates subscribers and concurrent retries", async () => {
    vi.mocked(fetch).mockResolvedValue(json(full));
    const resource = client(); stops.push(resource.subscribe(() => {}));
    await Promise.all([resource.refresh(), resource.refresh()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(resource.getSnapshot().data?.pois).toEqual(full.pois);
  });
  it("polls only events after a full load and keeps independent conditional tags", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json({ events: [{ id: "new" }], meta: { ...meta, eventsVersion: "e2" } }, '"events-2"')).mockResolvedValueOnce(new Response(null, { status: 304 }));
    const resource = client(); await vi.advanceTimersByTimeAsync(0);
    const data = resource.getSnapshot().data;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.example/v1/content?scope=events", expect.objectContaining({ headers: { Accept: "application/json" } }));
    expect(resource.getSnapshot().data?.pois).toBe(data?.pois);
    expect(resource.getSnapshot().data?.events).toEqual([{ id: "new" }]);
    const checked = resource.getSnapshot().checkedAt;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenNthCalledWith(3, expect.any(String), expect.objectContaining({ headers: { Accept: "application/json", "If-None-Match": '"events-2"' }, cache: "no-store", credentials: "omit" }));
    expect(resource.getSnapshot().checkedAt).toBeGreaterThan(checked!);
    expect(resource.getSnapshot().meta?.eventsVersion).toBe("e2");
  });
  it("fetches full data once when a POI/home version changes", async () => {
    const changed = { ...meta, revision: "r2", poisVersion: "p2", homeVersion: "h2" };
    vi.mocked(fetch).mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json({ events: [], meta: changed }, '"events-2"')).mockResolvedValueOnce(json({ ...full, pois: [{ id: "replacement" }], meta: changed }, '"full-2"'));
    const resource = client(); await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(3, "https://api.example/v1/content", expect.objectContaining({ headers: { Accept: "application/json", "If-None-Match": '"full-1"' } }));
    expect(resource.getSnapshot().data?.pois[0].id).toBe("replacement");
  });
  it("validates new events without normalizing cached POIs again", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json({ events: [], meta: { ...meta, eventsVersion: "e2" } }, '"events-2"'));
    const decodedPoiCounts: number[] = [];
    const resource = createPublicContentClient("https://api.example/v1/content", body => {
      const content = body as typeof full;
      decodedPoiCounts.push(content.pois.length);
      return { ...content, pois: content.pois.map(poi => ({ ...poi })) };
    });
    stops.push(resource.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0); const pois = resource.getSnapshot().data?.pois;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(resource.getSnapshot().data?.pois).toBe(pois);
    expect(decodedPoiCounts).toEqual([1, 0]);
  });
  it("does not commit an events tag when its required full refresh fails", async () => {
    const changed = { ...meta, poisVersion: "p2" };
    vi.mocked(fetch).mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json({ events: [], meta: changed }, '"events-2"')).mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(json({ events: [], meta: changed }, '"events-2"')).mockResolvedValueOnce(json({ ...full, meta: changed }, '"full-2"'));
    const resource = client(); await vi.advanceTimersByTimeAsync(60_000);
    expect(resource.getSnapshot().meta?.poisVersion).toBe("p1");
    await resource.refresh();
    expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining("scope=events"), expect.objectContaining({ headers: { Accept: "application/json" } }));
    expect(resource.getSnapshot().meta?.poisVersion).toBe("p2");
  });
  it("remains compatible with servers without revision metadata", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ pois: [], events: [] })).mockResolvedValueOnce(new Response(null, { status: 304 }));
    const resource = client(); await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.example/v1/content", expect.objectContaining({ headers: { Accept: "application/json", "If-None-Match": '"full-1"' } }));
    expect(resource.getSnapshot().error).toBeNull();
  });
  it("rejects a 304 without any validated body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 304 }));
    const resource = client(); await vi.advanceTimersByTimeAsync(0);
    expect(resource.getSnapshot().data).toBeNull(); expect(resource.getSnapshot().error).toBeTruthy();
  });
  it("pauses while hidden/offline and resumes overdue checks", async () => {
    vi.mocked(fetch).mockResolvedValue(json(full)); client(); await vi.advanceTimersByTimeAsync(0);
    documentTarget.visibilityState = "hidden"; documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(180_000); expect(fetch).toHaveBeenCalledTimes(1);
    documentTarget.visibilityState = "visible"; network.onLine = false; documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000); expect(fetch).toHaveBeenCalledTimes(1);
    network.onLine = true; windowTarget.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("aborts when the final subscriber leaves and schedules no further reads", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => { signal = options?.signal as AbortSignal; signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError"))); }));
    const resource = client(); await vi.advanceTimersByTimeAsync(0); stops.splice(0).forEach(stop => stop());
    expect(signal?.aborted).toBe(true); await vi.advanceTimersByTimeAsync(300_000);
    expect(fetch).toHaveBeenCalledTimes(1); expect(resource.getSnapshot().error).toBeNull();
  });
  it("aborts a 12-second timeout and backs off before another read", async () => {
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("deadline", "AbortError")))));
    const resource = client(); await vi.advanceTimersByTimeAsync(12_000);
    expect(resource.getSnapshot().error).toContain("timed out");
    await vi.advanceTimersByTimeAsync(119_999); expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("retains last validated data and time after malformed content, then recovers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json({ events: null, meta })).mockResolvedValueOnce(json({ events: [], meta }));
    const resource = client(); await vi.advanceTimersByTimeAsync(0); const before = resource.getSnapshot();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(resource.getSnapshot().data).toBe(before.data); expect(resource.getSnapshot().checkedAt).toBe(before.checkedAt); expect(resource.getSnapshot().error).toBeTruthy();
    await resource.refresh(); expect(resource.getSnapshot().error).toBeNull();
  });
});
describe("exclusive event expiration", () => {
  it("keeps ongoing/future intervals and removes ended, missing or invalid ones", () => {
    const start = "2026-10-04T00:00:00Z", end = "2026-10-04T00:01:00Z";
    const upcoming = { id: "valid", startsAt: start, endsAt: end };
    expect(currentEvents([upcoming, { startsAt: start }, { startsAt: "bad", endsAt: end }], Date.parse(start))).toEqual([upcoming]);
    expect(currentEvents([upcoming], Date.parse(end))).toEqual([]);
  });
  it("checks exactly after the next end, bounded to one minute for clock changes", () => {
    const now = Date.parse("2026-10-04T00:00:00Z");
    expect(nextEventCheck([{ endsAt: "2026-10-04T00:00:05Z" }], now)).toBe(5001);
    expect(nextEventCheck([{ endsAt: "2026-10-05T00:00:00Z" }], now)).toBe(60_000);
  });
});
