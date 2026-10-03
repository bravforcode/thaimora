import { expect, it } from "vitest";
import { decodeLocalContent } from "../../src/lib/pois";
it("preserves exclusive event end and nullable source provenance from the actual DTO", () => {
  const event = { id: "event", name: { en: "Synthetic event", th: "กิจกรรมสำหรับทดสอบ" }, startsAt: "2026-10-04T00:00:00Z", endsAt: "2026-10-04T01:00:00Z", sourceUpdatedAt: null, source_url: null };
  const content = decodeLocalContent({ pois: [], events: [event] });
  expect(content.events[0].endsAt).toBe(event.endsAt);
  expect(content.events[0].sourceUpdatedAt).toBeUndefined();
});
it("rejects malformed bilingual titles instead of rendering an invalid feed", () => {
  expect(() => decodeLocalContent({ pois: [], events: [{ id: "event", title: "bad", date: "2026-10-04" }] })).toThrow();
});
