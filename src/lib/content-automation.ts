export function protectedSourceRecord(row: Record<string, unknown>) {
  return row.admin_override === true && typeof row.id === "string" && !!row.id && typeof row.source === "string" && !!row.source.trim() && !["manual", "local-preview"].includes(row.source.toLowerCase());
}
