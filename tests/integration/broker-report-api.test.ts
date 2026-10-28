import { describe, expect, it } from "vitest";
import { csvText, leadPage, reportWindow } from "../../supabase/functions/_shared/broker-report.ts";

const url = (query: string) => new URL(`https://api.test/v1/broker/reports/summary?${query}`);

describe("reportWindow", () => {
  it("accepts a full 365 day window", () => {
    expect(reportWindow(url("from=2026-01-01&to=2026-12-31"))).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("rejects impossible calendar dates", () => {
    expect(() => reportWindow(url("from=2026-02-30&to=2026-03-01"))).toThrow();
  });
  it("rejects reversed or oversized ranges", () => {
    expect(() => reportWindow(url("from=2026-10-27&to=2026-10-01"))).toThrow();
    expect(() => reportWindow(url("from=2025-01-01&to=2026-10-27"))).toThrow();
  });
});

describe("leadPage", () => {
  it("caps limit at 200", () => {
    expect(() => leadPage(new URL("https://api.test/v1/broker/reports/leads?limit=201"))).toThrow();
    expect(leadPage(new URL("https://api.test/v1/broker/reports/leads"))).toEqual({ before: null, limit: 50 });
  });
});

describe("csvText", () => {
  it("quotes values and neutralises formula cells", () => {
    expect(csvText([{ name: '=HYPERLINK("x")', message: 'a"b' }], ["name", "message"])).toBe(
      '"name","message"\r\n"\'=HYPERLINK(""x"")","a""b"',
    );
  });
});
