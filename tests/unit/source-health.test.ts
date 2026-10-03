import { afterEach, expect, it, vi } from "vitest";
import { eventSourceHealth } from "../../src/lib/source-health";
import { createPublicContentClient } from "../../src/lib/public-content-client";
afterEach(() => { vi.unstubAllGlobals(); });
it("distinguishes disconnected, failed, awaiting and successful upstream feeds", () => {
  expect(eventSourceHealth(null)).toBe("unknown");
  expect(eventSourceHealth({ sources: [] })).toBe("disconnected");
  const source = { kind: "events", enabled: true, status: "error", lastSuccessAt: "2026-10-03T00:00:00Z" };
  expect(eventSourceHealth({ sources: [source] })).toBe("error");
  expect(eventSourceHealth({ sources: [{ ...source, status: "stale" }] })).toBe("error");
  expect(eventSourceHealth({ sources: [{ ...source, status: "idle", lastSuccessAt: null }] })).toBe("awaiting");
  expect(eventSourceHealth({ sources: [{ ...source, status: "license_pending" }] })).toBe("awaiting");
  expect(eventSourceHealth({ sources: [{ ...source, status: "ok" }] })).toBe("ok");
});
it("does not hide an upstream error after successful API200 and304 checks", async () => {
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("navigator", { onLine: true });
  const body = { pois: [], events: [], meta: { revision: "r", poisVersion: "p", eventsVersion: "e", homeVersion: "h", sources: [{ kind: "events", enabled: true, status: "error", lastSuccessAt: "2026-10-03T00:00:00Z" }] } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body), { headers: { etag: '"full"' } })).mockResolvedValueOnce(new Response(JSON.stringify({ events: [], meta: body.meta }), { headers: { etag: '"events"' } })).mockResolvedValueOnce(new Response(null, { status: 304 })));
  const resource = createPublicContentClient("https://api.example/v1/content", data => data as typeof body);
  const stop = resource.subscribe(() => {});
  try {
    await resource.refresh(); await resource.refresh(); await resource.refresh();
    expect(resource.getSnapshot().error).toBeNull();
    expect(eventSourceHealth(resource.getSnapshot().meta)).toBe("error");
    expect(fetch).toHaveBeenCalledTimes(3);
  } finally { stop(); }
});
