"use client";
import { useSettings } from "./context";
export type SourceMetadata = {
  sourceUrl?: string;
  sourceId?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  fetchedAt?: string;
  sourceUpdatedAt?: string;
};
export function SourceNotes({
  value,
  compact = false,
}: {
  value: SourceMetadata;
  compact?: boolean;
}) {
  const { locale, tr } = useSettings();
  if (
    ![
      value.sourceUrl,
      value.sourceId,
      value.license,
      value.attribution,
      value.fetchedAt,
      value.sourceUpdatedAt,
    ].some(Boolean)
  )
    return null;
  const date = (value: string) => {
    const time = new Date(value);
    return Number.isNaN(time.getTime())
      ? value
      : time.toLocaleDateString(locale === "th" ? "th-TH" : "en-GB");
  };
  const notes = (
    <div className="source-notes">
      {value.attribution && <span>{value.attribution}</span>}
      {value.sourceUrl && /^https?:\/\//.test(value.sourceUrl) && (
        <a href={value.sourceUrl} target="_blank" rel="noreferrer">
          {tr("Source", "แหล่งที่มา")}
        </a>
      )}
      {value.sourceId && (
        <span>
          {tr("Source ID", "รหัสแหล่งที่มา")}: {value.sourceId}
        </span>
      )}
      {value.license &&
        (value.licenseUrl && /^https?:\/\//.test(value.licenseUrl) ? (
          <a href={value.licenseUrl} target="_blank" rel="noreferrer">
            {value.license}
          </a>
        ) : (
          <span>
            {tr("License", "ใบอนุญาต")}: {value.license}
          </span>
        ))}
      {value.fetchedAt && (
        <span>
          {tr("Fetched", "ดึงข้อมูล")}: {date(value.fetchedAt)}
        </span>
      )}
      {value.sourceUpdatedAt && (
        <span>
          {tr("Source updated", "แหล่งข้อมูลอัปเดต")}:{" "}
          {date(value.sourceUpdatedAt)}
        </span>
      )}
    </div>
  );
  return compact ? (
    <details className="source-details">
      <summary>{tr("Sources & updates", "แหล่งข้อมูลและการอัปเดต")}</summary>
      {notes}
    </details>
  ) : (
    notes
  );
}
