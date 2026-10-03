export function paginate<T>(items: T[], requested: number, size = 48) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(0, Math.min(pageCount - 1, Number.isFinite(requested) ? Math.trunc(requested) : 0));
  const offset = page * size;
  return { items: items.slice(offset, offset + size), page, pageCount, total: items.length, start: items.length ? offset + 1 : 0, end: Math.min(offset + size, items.length) };
}
