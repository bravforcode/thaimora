import { expect, it } from "vitest";
import { paginate } from "../../src/lib/pagination";
it("bounds initial DOM pages and preserves access to every source record", () => {
  const rows = Array.from({ length: 1868 }, (_, id) => id);
  const first = paginate(rows, 0); expect(first.items).toHaveLength(48); expect(first.total).toBe(1868);
  const all = Array.from({ length: first.pageCount }, (_, page) => paginate(rows, page).items).flat();
  expect(all).toEqual(rows); expect(paginate(rows, 999).end).toBe(1868);
});
it("clamps to a valid page when live records shrink or filters empty the list", () => {
  expect(paginate([1, 2], 10)).toMatchObject({ page: 0, start: 1, end: 2, total: 2 });
  expect(paginate([], 10)).toMatchObject({ page: 0, start: 0, end: 0, total: 0 });
  expect(paginate([1], Number.NaN).page).toBe(0);
});
