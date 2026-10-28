import { describe, expect, it } from "vitest";
import { brokerReportSchema } from "@/lib/broker-api";
import { bangkokToday, fillDailySeries, formatResponseTime, reportWindow } from "@/lib/broker-report";

describe("reportWindow", () => {
  it("covers the last N days ending today", () => {
    expect(reportWindow("2026-10-27", 7)).toEqual({ from: "2026-10-21", to: "2026-10-27" });
  });
});

describe("bangkokToday", () => {
  it("uses Thailand's date just after UTC midnight boundary", () => {
    expect(bangkokToday(new Date("2026-10-26T18:00:00Z"))).toBe("2026-10-27");
  });
});

describe("fillDailySeries", () => {
  it("fills missing days with zeros in order", () => {
    const out = fillDailySeries([{ day: "2026-10-02", views: 5, inquiries: 1, contactClicks: 0 }], "2026-10-01", "2026-10-03");
    expect(out.map((row) => [row.day, row.views])).toEqual([["2026-10-01", 0], ["2026-10-02", 5], ["2026-10-03", 0]]);
  });
});

describe("formatResponseTime", () => {
  it("formats minutes, hours and days", () => {
    expect(formatResponseTime(null, "en")).toBe("No data yet");
    expect(formatResponseTime(540, "en")).toBe("9 min");
    expect(formatResponseTime(7500, "en")).toBe("2h 5m");
    expect(formatResponseTime(259200, "en")).toBe("3 days");
  });
});

describe("brokerReportSchema", () => {
  it("parses the summary contract", () => {
    const parsed = brokerReportSchema.parse({
      totals: { views: 3, inquiries: 1, contactClicks: 2, leads: 1, newLeads: 1, contactedLeads: 0, closedLeads: 0, respondedLeads: 0, medianResponseSeconds: null },
      daily: [{ day: "2026-10-20", views: 3, inquiries: 1, contactClicks: 2 }],
      listings: [{ propertyId: "11111111-1111-4111-8111-111111111111", title: { en: "Condo", th: "คอนโด" }, slug: "condo", published: true, views: 3, inquiries: 1, contactClicks: 2 }],
    });
    expect(parsed.totals.views).toBe(3);
  });
});
