import { expect, it } from "vitest";
import { protectedSourceRecord } from "../../src/lib/content-automation";
it("exposes release only for existing protected source records", () => {
  expect(protectedSourceRecord({ id: "source-row", source: "OSM", admin_override: true })).toBe(true);
  expect(protectedSourceRecord({ id: "source-row", source: "TAT", admin_override: false })).toBe(false);
  expect(protectedSourceRecord({ id: "manual-row", source: "manual", admin_override: true })).toBe(false);
  expect(protectedSourceRecord({ id: "preview-row", source: "local-preview", admin_override: true })).toBe(false);
  expect(protectedSourceRecord({ source: "OSM", admin_override: true })).toBe(false);
});
