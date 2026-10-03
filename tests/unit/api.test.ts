import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { demoProperties } from "../../src/lib/demo";
import { defaultFilters, publicSnapshot } from "../../src/lib/property";
describe("live API contract", () => {
  it("sends measurements only after explicit opt-in using the actual endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ accepted: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { recordMeasurement } = await import("../../src/lib/api");
    await recordMeasurement(demoProperties[0].id, "view", false);
    expect(fetchMock).not.toHaveBeenCalled();
    await recordMeasurement(demoProperties[0].id, "contact_click", true);
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/analytics/events");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      propertyId: demoProperties[0].id,
      kind: "contact_click",
      consented: true,
    });
  });
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
    vi.stubEnv(
      "NEXT_PUBLIC_API_URL",
      "https://client.example/functions/v1/api",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("loads every cursor page with supported default filters and committed geography", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: demoProperties.slice(0, 20),
            total: 30,
            nextCursor: "page-2",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: demoProperties.slice(20),
            total: 30,
            nextCursor: null,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { getProperties, liveMode } = await import("../../src/lib/api");
    expect(liveMode).toBe(true);
    const rows = await getProperties(defaultFilters, undefined, {
      bounds: [98, 7, 99, 9],
      polygon: [
        [98, 7],
        [99, 7],
        [99, 9],
      ],
      center: [98.33, 7.94],
    });
    expect(rows).toHaveLength(30);
    const first = new URL(fetchMock.mock.calls[0][0]),
      next = new URL(fetchMock.mock.calls[1][0]);
    expect(first.searchParams.get("sort")).toBe("relevance");
    expect(first.searchParams.get("status")).toBe("available");
    expect(first.searchParams.get("limit")).toBe("50");
    expect(first.searchParams.get("bbox")).toBe("98,7,99,9");
    expect(JSON.parse(first.searchParams.get("polygon")!).type).toBe("Polygon");
    expect(first.searchParams.has("favoritesOnly")).toBe(false);
    expect(next.searchParams.get("cursor")).toBe("page-2");
  });
  it("accepts canonical direct detail and transitional wrapper without inventing coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(demoProperties[0])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ property: demoProperties[0] })),
        ),
    );
    const { getProperty } = await import("../../src/lib/api");
    expect(
      publicSnapshot(await getProperty(demoProperties[0].id)).location.accuracy,
    ).toBe("approximate");
    expect((await getProperty(demoProperties[0].id)).id).toBe(
      demoProperties[0].id,
    );
  });
  it("fails on a repeated cursor rather than silently dropping inventory", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ items: [], nextCursor: "same" })),
        ),
    );
    const { getProperties } = await import("../../src/lib/api");
    await expect(getProperties(defaultFilters)).rejects.toThrow();
  });
  it("surfaces server validation failures and preserves abort signal", async () => {
    const controller = new AbortController(),
      fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Invalid search geometry" } }),
            { status: 422 },
          ),
        );
    vi.stubGlobal("fetch", fetchMock);
    const { getProperties } = await import("../../src/lib/api");
    await expect(
      getProperties(defaultFilters, controller.signal),
    ).rejects.toThrow("Invalid search geometry");
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
