import {
  propertySchema,
  publicSnapshot,
  type PublicProperty,
} from "./property";
export function parseCSV(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseImportRows(
  rows: unknown[][],
  options: { live?: boolean } = {},
) {
  const items: PublicProperty[] = [],
    errors: { row: number; message: string }[] = [],
    records: Record<string, unknown>[] = [];
  const rowNumbers: number[] = [];
  if (rows.length < 2)
    return {
      items,
      records,
      rowNumbers,
      errors: [
        {
          row: 1,
          message: "A header and at least one property row are required.",
        },
      ],
    };
  const headers = rows[0].map((v) => String(v ?? "").trim());
  if (new Set(headers).size !== headers.length)
    return {
      items,
      records,
      rowNumbers,
      errors: [
        { row: 1, message: "Duplicate column headers are not allowed." },
      ],
    };
  rows.slice(1).forEach((cells, index) => {
    const r = Object.fromEntries(headers.map((key, i) => [key, cells[i]]));
    const value = (key: string, legacy?: string) =>
      r[key] ?? (legacy ? r[legacy] : undefined);
    const numeric = (key: string, nullable = false) =>
      r[key] === "" || r[key] === undefined || r[key] === null
        ? nullable
          ? null
          : NaN
        : Number(r[key]);
    try {
      for (const [canonical, legacy] of [
        ["price_thb", "priceTHB"],
        ["area_m2", "areaM2"],
        ["land_area_m2", "landAreaM2"],
        ["built_year", "builtYear"],
        ["updated_at", "updatedAt"],
        ["expires_at", "expiresAt"],
      ])
        r[canonical] = value(canonical, legacy);
      if (options.live) {
        r.rights_evidence = r.rights_evidence || r.rights_evidence_url;
        const required = [
          "source_url",
          "license",
          "rights_evidence",
          "ownership_evidence_url",
          "image_url",
          "image_source_url",
          "image_license",
          "image_rights_evidence_url",
        ];
        r.ownership_evidence_url =
          r.ownership_evidence_url || r.ownership_evidence;
        r.image_rights_evidence_url =
          r.image_rights_evidence_url || r.image_rights_evidence;
        for (const key of required) {
          if (!String(r[key] ?? "").trim())
            throw new Error(`${key} is required for a live import.`);
          if (key.endsWith("_url") && !/^https:\/\//.test(String(r[key])))
            throw new Error(`${key} must be an HTTPS URL.`);
        }
        if (r.exact_publication_consent === "true" && !r.consent_evidence)
          throw new Error(
            "consent_evidence is required for exact location consent.",
          );
      }
      const p = propertySchema.parse({
        id: r.id || crypto.randomUUID(),
        slug: r.slug,
        title: { en: r.title_en, th: r.title_th },
        description: { en: r.description_en, th: r.description_th },
        transaction: r.transaction,
        type: r.type,
        priceTHB: numeric("price_thb"),
        areaM2: numeric("area_m2"),
        landAreaM2: numeric("land_area_m2", true),
        beds: numeric("beds"),
        baths: numeric("baths"),
        floor: numeric("floor", true),
        builtYear: numeric("built_year", true),
        ownership: r.ownership,
        furnishing: r.furnishing,
        status: r.status || "available",
        location: {
          lat: options.live
            ? Math.round(Number(numeric("lat")) / 0.002) * 0.002
            : numeric("lat"),
          lng: options.live
            ? Math.round(Number(numeric("lng")) / 0.002) * 0.002
            : numeric("lng"),
          accuracy: options.live ? "approximate" : r.accuracy || "approximate",
          radiusMeters: options.live
            ? 300
            : r.radiusMeters
              ? numeric("radiusMeters")
              : 300,
        },
        zone: r.zone,
        province: r.province,
        images: r.images
          ? JSON.parse(String(r.images))
          : r.image_url
            ? [
                {
                  url: r.image_url,
                  alt: { en: r.title_en, th: r.title_th },
                  sourceUrl: r.image_source_url,
                  credit: r.image_credit,
                },
              ]
            : [],
        amenities: r.amenities ? String(r.amenities).split("|") : [],
        updatedAt: r.updated_at || new Date().toISOString(),
        expiresAt: r.expires_at || null,
      });
      items.push(publicSnapshot(p));
      records.push(r);
      rowNumbers.push(index + 2);
    } catch (e) {
      errors.push({
        row: index + 2,
        message: e instanceof Error ? e.message : "Invalid row",
      });
    }
  });
  return { items, records, rowNumbers, errors };
}
export type DuplicatePolicy = "skip" | "update" | "error";
export function applyPreviewImport(
  existing: PublicProperty[],
  incoming: PublicProperty[],
  rowNumbers: number[],
  policy: DuplicatePolicy,
  records: Record<string, unknown>[] = [],
) {
  const items = [...existing],
    errors: { row: number; message: string }[] = [];
  let written = 0,
    skipped = 0;
  incoming.forEach((property, index) => {
    const match = items.findIndex(
      (p) => p.id === property.id || p.slug === property.slug,
    );
    if (match >= 0) {
      if (policy === "skip") {
        skipped++;
        return;
      }
      if (policy === "error") {
        errors.push({
          row: rowNumbers[index],
          message: `Duplicate id or slug: ${property.slug}`,
        });
        return;
      }
      const previous = items[match],
        record = records[index] ?? {};
      const provided = (key: string) => String(record[key] ?? "").trim() !== "";
      items[match] = {
        ...property,
        id: previous.id,
        expiresAt: provided("expires_at")
          ? property.expiresAt
          : previous.expiresAt,
        status: provided("status") ? property.status : previous.status,
        floor: provided("floor") ? property.floor : previous.floor,
        builtYear: provided("built_year")
          ? property.builtYear
          : previous.builtYear,
        landAreaM2: provided("land_area_m2")
          ? property.landAreaM2
          : previous.landAreaM2,
        amenities: provided("amenities")
          ? property.amenities
          : previous.amenities,
      };
    } else items.unshift(property);
    written++;
  });
  return { items, written, skipped, errors };
}
export function exportCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    keys.map(cell).join(","),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(",")),
  ].join("\r\n");
}
export function propertyToImportRow(p: PublicProperty) {
  return {
    id: p.id,
    slug: p.slug,
    title_en: p.title.en,
    title_th: p.title.th,
    description_en: p.description.en,
    description_th: p.description.th,
    transaction: p.transaction,
    type: p.type,
    price_thb: p.priceTHB,
    area_m2: p.areaM2,
    land_area_m2: p.landAreaM2,
    beds: p.beds,
    baths: p.baths,
    floor: p.floor,
    built_year: p.builtYear,
    ownership: p.ownership,
    furnishing: p.furnishing,
    status: p.status,
    lat: p.location.lat,
    lng: p.location.lng,
    accuracy: p.location.accuracy,
    radiusMeters: p.location.radiusMeters,
    zone: p.zone,
    province: p.province,
    images: JSON.stringify(p.images),
    amenities: p.amenities.join("|"),
    updated_at: p.updatedAt,
    expires_at: p.expiresAt,
    source_url: "",
    license: "",
    rights_evidence: "",
    ownership_evidence_url: "",
    image_url: p.images[0]?.url ?? "",
    image_source_url: p.images[0]?.sourceUrl ?? "",
    image_license: "",
    image_rights_evidence_url: "",
    exact_publication_consent: "false",
    consent_evidence: "",
  };
}
